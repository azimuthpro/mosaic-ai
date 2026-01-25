'use server'

import { createClient, getUser } from '@/lib/supabase/server'
import type { Job, JobInsert, Agent } from '@/types/database'

export async function getRecentJobs(limit: number = 10): Promise<(Job & { agent: Agent | null })[]> {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      agent:agents (*)
    `)
    .eq('agents.owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching jobs:', error)
    return []
  }

  return data as (Job & { agent: Agent | null })[]
}

export async function getJobsForAgent(agentId: string): Promise<Job[]> {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return []
  }

  // Verify ownership
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('owner_id', user.id)
    .single()

  if (!agent) {
    return []
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching jobs:', error)
    return []
  }

  return (data || []) as Job[]
}

export async function createJob(agentId: string): Promise<Job | null> {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return null
  }

  // Verify ownership
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('owner_id', user.id)
    .single()

  if (!agent) {
    return null
  }

  const jobInsert: JobInsert = {
    agent_id: agentId,
    status: 'pending',
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert(jobInsert as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating job:', error)
    return null
  }

  return data
}
