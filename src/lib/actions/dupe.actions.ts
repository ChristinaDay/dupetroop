'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function submitDupe(formData: {
  polishAId: string
  polishBId: string
  notes?: string
}): Promise<{ dupeId: string } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to submit a dupe.' }

  const { data, error } = await supabase
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
    if (error.code === '23505') {
      return { error: 'This dupe pair has already been submitted.' }
    }
    return { error: error.message }
  }

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
