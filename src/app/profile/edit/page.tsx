import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileEditForm } from './ProfileEditForm'

export const metadata = { title: 'Edit Profile' }

export default async function ProfileEditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/profile/edit')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">Edit profile</h1>
        <p className="text-muted-foreground mt-1 text-sm">{user.email}</p>
      </div>
      <ProfileEditForm profile={profile} userId={user.id} />
    </div>
  )
}
