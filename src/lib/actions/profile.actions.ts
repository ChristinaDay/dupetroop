'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ProfileInput = {
  displayName: string
  username: string
  bio: string
  avatarUrl: string | null
}

export async function updateProfile(
  input: ProfileInput
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in.' }

  const username = input.username.trim().toLowerCase()

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return { error: 'Username must be 3–30 characters: letters, numbers, and underscores only.' }
  }

  // Check username uniqueness (excluding current user)
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .maybeSingle()

  if (existing) return { error: 'That username is already taken.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: input.displayName.trim() || null,
      username,
      bio: input.bio.trim() || null,
      avatar_url: input.avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return {}
}
