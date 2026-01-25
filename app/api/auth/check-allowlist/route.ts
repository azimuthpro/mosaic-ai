import { NextResponse } from 'next/server'
import { isEmailAllowed } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { allowed: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    const allowed = await isEmailAllowed(email)
    return NextResponse.json({ allowed })
  } catch {
    return NextResponse.json(
      { allowed: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
