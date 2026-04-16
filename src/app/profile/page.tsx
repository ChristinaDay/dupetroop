import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/profile')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const initials = (profile.display_name ?? profile.username ?? '?')
    .slice(0, 2)
    .toUpperCase()

  const handleSignOut = async () => {
    'use server'
    const { createClient: sc } = await import('@/lib/supabase/server')
    const supabase = await sc()
    await supabase.auth.signOut()
    const { redirect: r } = await import('next/navigation')
    r('/')
  }

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
      <div className="flex items-center gap-4 mb-8">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl font-black">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-black">{profile.display_name ?? profile.username}</h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border border-border rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-primary">{profile.dupe_count}</p>
          <p className="text-sm text-muted-foreground">Dupes submitted</p>
        </div>
        <div className="border border-border rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-primary">{profile.polish_count}</p>
          <p className="text-sm text-muted-foreground">Polishes submitted</p>
        </div>
      </div>

      <div className="space-y-3">
        <Button asChild variant="outline" className="w-full">
          <Link href="/profile/edit">Edit profile</Link>
        </Button>
        {profile.role !== 'user' && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/admin">Admin panel</Link>
          </Button>
        )}
        <form action={handleSignOut}>
          <Button type="submit" variant="outline" className="w-full text-destructive border-destructive hover:bg-destructive/10">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  )
}
