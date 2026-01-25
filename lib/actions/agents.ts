'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient, getUser } from '@/lib/supabase/server'
import type { Agent, AgentInsert, AgentUpdate, Source, SourceInsert, OutputFormat } from '@/types/database'

export type AgentWithSources = Agent & { sources: Source[] }

type SourceWithAgent = {
  id: string
  agent_id: string
  agents: { owner_id: string }
}

export async function getAgents(): Promise<AgentWithSources[]> {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('agents')
    .select(`
      *,
      sources (*)
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching agents:', error)
    return []
  }

  return (data || []) as AgentWithSources[]
}

export async function getAgent(id: string): Promise<AgentWithSources | null> {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('agents')
    .select(`
      *,
      sources (*)
    `)
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching agent:', error)
    return null
  }

  return data as AgentWithSources
}

export async function createAgent(formData: FormData) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const systemPrompt = formData.get('systemPrompt') as string
  const outputFormat = (formData.get('outputFormat') as OutputFormat) || 'text'
  const scheduleCron = formData.get('scheduleCron') as string | null
  const sourcesJson = formData.get('sources') as string

  // Parse sources
  let sources: { url: string; name?: string }[] = []
  try {
    sources = JSON.parse(sourcesJson || '[]')
  } catch {
    return { error: 'Invalid sources format' }
  }

  // Create agent
  const agentInsert: AgentInsert = {
    owner_id: user.id,
    name,
    description: description || null,
    system_prompt: systemPrompt,
    output_format: outputFormat,
    schedule_cron: scheduleCron || null,
    is_active: true,
  }

  const { data: agentData, error: agentError } = await supabase
    .from('agents')
    .insert(agentInsert as never)
    .select()
    .single()

  const agent = agentData as Agent | null

  if (agentError || !agent) {
    console.error('Error creating agent:', agentError)
    return { error: 'Failed to create agent' }
  }

  // Create sources
  if (sources.length > 0) {
    const sourceData: SourceInsert[] = sources.map((s) => ({
      agent_id: agent.id,
      url: s.url,
      name: s.name || null,
    }))

    const { error: sourcesError } = await supabase
      .from('sources')
      .insert(sourceData as never)

    if (sourcesError) {
      console.error('Error creating sources:', sourcesError)
      // Don't fail the whole operation, agent was created
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/agents')
  redirect(`/agents/${agent.id}`)
}

export async function updateAgent(id: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const systemPrompt = formData.get('systemPrompt') as string
  const outputFormat = (formData.get('outputFormat') as OutputFormat) || 'text'
  const scheduleCron = formData.get('scheduleCron') as string | null
  const isActive = formData.get('isActive') === 'true'

  const updateData: AgentUpdate = {
    name,
    description: description || null,
    system_prompt: systemPrompt,
    output_format: outputFormat,
    schedule_cron: scheduleCron || null,
    is_active: isActive,
  }

  const { error } = await supabase
    .from('agents')
    .update(updateData as never)
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('Error updating agent:', error)
    return { error: 'Failed to update agent' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/agents')
  revalidatePath(`/agents/${id}`)

  return { success: true }
}

export async function deleteAgent(id: string) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('Error deleting agent:', error)
    return { error: 'Failed to delete agent' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/agents')
  redirect('/dashboard')
}

export async function toggleAgentActive(id: string) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get current state
  const { data: agentData, error: fetchError } = await supabase
    .from('agents')
    .select('is_active')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  const agent = agentData as { is_active: boolean } | null

  if (fetchError || !agent) {
    return { error: 'Agent not found' }
  }

  const newIsActive = !agent.is_active

  // Toggle
  const { error } = await supabase
    .from('agents')
    .update({ is_active: newIsActive } as never)
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('Error toggling agent:', error)
    return { error: 'Failed to toggle agent' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/agents')
  revalidatePath(`/agents/${id}`)

  return { success: true, isActive: newIsActive }
}

// Source management
export async function addSource(agentId: string, url: string, name?: string) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify agent ownership
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('owner_id', user.id)
    .single()

  if (!agent) {
    return { error: 'Agent not found' }
  }

  const sourceInsert: SourceInsert = {
    agent_id: agentId,
    url,
    name: name || null,
  }

  const { data, error } = await supabase
    .from('sources')
    .insert(sourceInsert as never)
    .select()
    .single()

  if (error) {
    console.error('Error adding source:', error)
    return { error: 'Failed to add source' }
  }

  revalidatePath(`/agents/${agentId}`)
  return { success: true, source: data }
}

export async function deleteSource(sourceId: string) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get source and verify ownership through agent
  const { data: source } = await supabase
    .from('sources')
    .select(`
      id,
      agent_id,
      agents!inner (owner_id)
    `)
    .eq('id', sourceId)
    .single()

  const typedSource = source as SourceWithAgent | null

  if (!typedSource || typedSource.agents.owner_id !== user.id) {
    return { error: 'Source not found' }
  }

  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('id', sourceId)

  if (error) {
    console.error('Error deleting source:', error)
    return { error: 'Failed to delete source' }
  }

  revalidatePath(`/agents/${typedSource.agent_id}`)
  return { success: true }
}
