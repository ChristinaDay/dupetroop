'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function submitDupe(formData: {
  polishAId: string
  polishBId: string
  notes?: string
}): Promise<{ dupeId: string } | { error: string }> {
  // Auth check with regular client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to submit a dupe.' }

  // Use admin client for the write so the post-insert SELECT isn't blocked by
  // the dupes_select RLS policy (which only surfaces approved rows or the
  // submitter's own rows — and the submitter check can fail if the JWT isn't
  // forwarded correctly to PostgREST).
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data, error } = await db
    .from('dupes')
    .insert({
      polish_a_id: formData.polishAId,
      polish_b_id: formData.polishBId,
      notes: formData.notes ?? null,
      submitted_by: user.id,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.error('submitDupe insert error:', error)
    if (error.code === '23505') {
      return { error: 'This dupe pair has already been submitted.' }
    }
    return { error: error.message }
  }

  if (!data) return { error: 'Failed to save dupe. Please try again.' }

  revalidatePath('/admin/dupes')
  return { dupeId: data.id }
}

export async function approveDupe(dupeId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('dupes')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', dupeId)

  if (error) return { error: error.message }

  // Increment dupe_count on both polishes
  const { data: dupe } = await supabase
    .from('dupes')
    .select('polish_a_id, polish_b_id')
    .eq('id', dupeId)
    .single()

  if (dupe) {
    await Promise.all([
      supabase.rpc('increment_dupe_count', { polish_id: dupe.polish_a_id }),
      supabase.rpc('increment_dupe_count', { polish_id: dupe.polish_b_id }),
    ])
  }

  revalidatePath('/admin/dupes')
  revalidatePath('/dupes')
  return {}
}

export async function bulkApproveDupes(dupeIds: string[]): Promise<{ approved: number; error?: string }> {
  if (dupeIds.length === 0) return { approved: 0 }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { approved: 0, error: 'Unauthorized' }

  const now = new Date().toISOString()

  const { data: dupes, error: fetchError } = await supabase
    .from('dupes')
    .select('id, polish_a_id, polish_b_id')
    .in('id', dupeIds)
    .eq('status', 'pending')

  if (fetchError) return { approved: 0, error: fetchError.message }

  const { error: updateError } = await supabase
    .from('dupes')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: now })
    .in('id', dupeIds)

  if (updateError) return { approved: 0, error: updateError.message }

  // Increment dupe_count for all affected polishes
  const polishIds = [...new Set(dupes?.flatMap(d => [d.polish_a_id, d.polish_b_id]) ?? [])]
  await Promise.all(polishIds.map(id => supabase.rpc('increment_dupe_count', { polish_id: id })))

  revalidatePath('/admin/dupes')
  revalidatePath('/dupes')

  return { approved: dupes?.length ?? 0 }
}

export async function createApprovedDupe(formData: {
  polishAId: string
  polishBId: string
  notes?: string
}): Promise<{ dupeId: string } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('dupes')
    .insert({
      polish_a_id: formData.polishAId,
      polish_b_id: formData.polishBId,
      notes: formData.notes ?? null,
      submitted_by: user.id,
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'This dupe pair already exists.' }
    return { error: error.message }
  }

  await Promise.all([
    supabase.rpc('increment_dupe_count', { polish_id: formData.polishAId }),
    supabase.rpc('increment_dupe_count', { polish_id: formData.polishBId }),
  ])

  revalidatePath('/dupes')
  revalidatePath('/admin/dupes')
  return { dupeId: data.id }
}

export async function deleteDupe(dupeId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    return { error: 'Unauthorized' }
  }

  // Fetch polish IDs and current dupe_count before deleting
  const { data: dupe } = await supabase
    .from('dupes')
    .select('polish_a_id, polish_b_id, status')
    .eq('id', dupeId)
    .single()

  if (!dupe) return { error: 'Dupe not found' }

  // Use service role client to bypass RLS for the delete
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('dupes').delete().eq('id', dupeId)
  if (error) return { error: error.message }

  // Decrement dupe_count on both polishes if this was an approved pair
  if (dupe.status === 'approved') {
    await Promise.all([
      supabase.rpc('decrement_dupe_count', { polish_id: dupe.polish_a_id }),
      supabase.rpc('decrement_dupe_count', { polish_id: dupe.polish_b_id }),
    ])
  }

  revalidatePath('/dupes')
  revalidatePath('/admin/dupes')
  return {}
}

export async function rejectDupe(
  dupeId: string,
  reason: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('dupes')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', dupeId)

  if (error) return { error: error.message }

  revalidatePath('/admin/dupes')
  return {}
}
