import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { createClient, getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scrapeUrls } from '@/lib/firecrawl/client'
import { analyzeContent } from '@/lib/ai/gemini'
import type { Agent, Source, Job, JobInsert, JobUpdate, ReportInsert } from '@/types/database'

type AgentWithSources = Agent & { sources: Source[] }

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { agentId } = await request.json()

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch agent with sources
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select(`
        *,
        sources (*)
      `)
      .eq('id', agentId)
      .eq('owner_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const typedAgent = agent as AgentWithSources

    if (!typedAgent.sources || typedAgent.sources.length === 0) {
      return NextResponse.json({ error: 'Agent has no sources configured' }, { status: 400 })
    }

    // Use admin client for job/report creation to bypass RLS
    const adminClient = createAdminClient()

    // Create a job
    const jobInsert: JobInsert = {
      agent_id: agentId,
      status: 'processing',
      started_at: new Date().toISOString(),
    }

    const { data: jobData, error: jobError } = await adminClient
      .from('jobs')
      .insert(jobInsert as never)
      .select()
      .single()

    const job = jobData as Job | null

    if (jobError || !job) {
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }

    try {
      // Scrape all sources
      const activeSourceUrls = typedAgent.sources
        .filter((s) => s.is_active)
        .map((s) => s.url)

      const scrapeResults = await scrapeUrls(activeSourceUrls)

      // Update source last_scraped_at
      const now = new Date().toISOString()
      await Promise.all(
        typedAgent.sources.map((source) =>
          adminClient
            .from('sources')
            .update({ last_scraped_at: now } as never)
            .eq('id', source.id)
        )
      )

      // Collect successful scrapes
      const successfulScrapes = scrapeResults.filter((r) => r.success && r.content)
      const scrapedContent = successfulScrapes.map((r) => r.content!)

      if (scrapedContent.length === 0) {
        throw new Error('No content could be scraped from sources')
      }

      // Analyze with AI
      const analysis = await analyzeContent(
        scrapedContent,
        typedAgent.system_prompt,
        typedAgent.output_format
      )

      if (!analysis.success) {
        throw new Error(analysis.error || 'AI analysis failed')
      }

      // Create report
      const reportInsert: ReportInsert = {
        job_id: job.id,
        agent_id: agentId,
        content: analysis.content,
        format: typedAgent.output_format,
        source_urls: activeSourceUrls,
      }

      const { error: reportError } = await adminClient
        .from('reports')
        .insert(reportInsert as never)

      if (reportError) {
        throw new Error('Failed to save report')
      }

      // Update job as completed
      const completedUpdate: JobUpdate = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        metadata: {
          sources_scraped: successfulScrapes.length,
          sources_failed: scrapeResults.length - successfulScrapes.length,
        },
      }

      await adminClient
        .from('jobs')
        .update(completedUpdate as never)
        .eq('id', job.id)

      revalidatePath(`/agents/${agentId}`)
      revalidatePath('/dashboard')

      return NextResponse.json({ success: true, jobId: job.id })
    } catch (processError) {
      // Update job as failed
      const errorMessage = getErrorMessage(processError)

      const failedUpdate: JobUpdate = {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      }

      await adminClient
        .from('jobs')
        .update(failedUpdate as never)
        .eq('id', job.id)

      revalidatePath(`/agents/${agentId}`)

      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
