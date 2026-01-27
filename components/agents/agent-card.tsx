'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toggleAgentActive } from '@/lib/actions/agents'
import { formatRelativeTime, cronToSchedule } from '@/lib/utils'
import type { AgentWithSources } from '@/lib/actions/agents'

interface AgentCardProps {
  agent: AgentWithSources
}

export function AgentCard({ agent }: AgentCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [optimisticIsActive, setOptimisticIsActive] = useState(agent.is_active)

  function handleCardClick(): void {
    router.push(`/agents/${agent.id}`)
  }

  function handleToggle(checked: boolean): void {
    setOptimisticIsActive(checked)
    startTransition(async () => {
      const result = await toggleAgentActive(agent.id)
      if (result.error) {
        setOptimisticIsActive(!checked)
      }
    })
  }

  function stopPropagation(e: React.MouseEvent): void {
    e.stopPropagation()
  }

  return (
    <Card
      className="h-full cursor-pointer transition-colors hover:bg-muted/50"
      onClick={handleCardClick}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{agent.name}</CardTitle>
          <div className="flex items-center gap-2" onClick={stopPropagation}>
            <span className="text-xs text-muted-foreground">
              {optimisticIsActive ? 'Active' : 'Paused'}
            </span>
            <Switch
              checked={optimisticIsActive}
              onCheckedChange={handleToggle}
              disabled={isPending}
              aria-label={`Toggle ${agent.name} ${optimisticIsActive ? 'off' : 'on'}`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{agent.sources?.length || 0} sources</span>
          <span>{cronToSchedule(agent.schedule_cron)}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Created {formatRelativeTime(agent.created_at)}
        </p>
      </CardContent>
    </Card>
  )
}
