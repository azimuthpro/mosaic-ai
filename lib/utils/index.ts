export { cn } from './cn'

// Format date for display
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

// Format date with time
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}d ago`
  }

  return formatDate(date)
}

// Parse cron expression to human readable schedule
export function cronToSchedule(cron: string | null): string {
  if (!cron) return 'Manual'

  // Common patterns
  if (cron === '0 9 * * *') return 'Daily at 9 AM'
  if (cron === '0 0 * * *') return 'Daily at midnight'
  if (cron === '0 9 * * 1') return 'Weekly on Monday'
  if (cron === '0 9 * * 1-5') return 'Weekdays at 9 AM'

  // Parse parts
  const parts = cron.split(' ')
  if (parts.length !== 5) return 'Custom schedule'

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  if (dayOfMonth === '*' && month === '*') {
    if (dayOfWeek === '*') {
      return `Daily at ${formatHour(hour, minute)}`
    }
    if (dayOfWeek === '1') {
      return `Weekly on Monday at ${formatHour(hour, minute)}`
    }
    if (dayOfWeek === '0') {
      return `Weekly on Sunday at ${formatHour(hour, minute)}`
    }
  }

  return 'Custom schedule'
}

function formatHour(hour: string, minute: string): string {
  const h = parseInt(hour, 10)
  const m = parseInt(minute, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  const displayMinute = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`
  return `${displayHour}${displayMinute} ${period}`
}

export type ScheduleOption = {
  label: string
  value: string
}

// Generate schedule options for the picker
export function getScheduleOptions(): ScheduleOption[] {
  return [
    { label: 'Daily at 9 AM', value: '0 9 * * *' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
    { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
    { label: 'Weekly on Monday at 9 AM', value: '0 9 * * 1' },
    { label: 'Weekly on Sunday at 9 AM', value: '0 9 * * 0' },
    { label: 'Manual only', value: '' },
  ]
}

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

// Extract domain from URL
export function getDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace('www.', '')
  } catch {
    return url
  }
}
