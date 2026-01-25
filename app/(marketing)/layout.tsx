export const dynamic = 'force-dynamic'

import { getUser } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  return (
    <div className="flex min-h-screen flex-col">
      <Header user={user} />
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built with Next.js and Supabase. Powered by AI.
          </p>
        </div>
      </footer>
    </div>
  )
}
