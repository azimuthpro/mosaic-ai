'use server'

import { addToAllowlist } from '@/lib/supabase/admin'

export async function requestInvite(email: string) {
  if (!email || !email.includes('@')) {
    return { error: 'Invalid email address' }
  }

  const { error } = await addToAllowlist(email)

  if (error) {
    if (error.code === '23505') {
      return { error: 'This email has already requested an invite.' }
    }
    return { error: 'Failed to request invite. Please try again later.' }
  }

  return { success: true }
}
