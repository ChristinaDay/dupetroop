import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    redirect('/')
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-black">Admin</h1>
        <nav className="flex gap-2 ml-4">
          <Link href="/admin/dupes" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">Dupes</Link>
          <Link href="/admin/polishes" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">Polishes</Link>
          <Link href="/admin/brands" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">Brands</Link>
        </nav>
      </div>
      {children}
    </div>
  )
}
