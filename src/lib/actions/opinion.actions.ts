'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type OpinionInput = {
  dupeId: string
  colorAccuracy: number
  finishAccuracy: number
  formulaAccuracy: number
  colorNotes?: string
  finishNotes?: string
  formulaNotes?: string
  ownsBoth: boolean
}

export async function upsertOpinion(
  input: OpinionInput
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to leave a rating.' }

  const { data, error } = await supabase
    .from('dupe_opinions')
    .upsert(
      {
        dupe_id: input.dupeId,
        user_id: user.id,
        color_accuracy: input.colorAccuracy,
        finish_accuracy: input.finishAccuracy,
        formula_accuracy: input.formulaAccuracy,
        color_notes: input.colorNotes ?? null,
        finish_notes: input.finishNotes ?? null,
        formula_notes: input.formulaNotes ?? null,
        owns_both: input.ownsBoth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'dupe_id,user_id' }
    )
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/dupes/${input.dupeId}`)
  return { id: data.id }
}

export async function deleteOpinion(
  opinionId: string,
  dupeId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('dupe_opinions')
    .delete()
    .eq('id', opinionId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dupes/${dupeId}`)
  return {}
}

export type ReportReason = 'spam' | 'inaccurate' | 'offensive' | 'other'

export async function reportOpinion(
  opinionId: string,
  reason: ReportReason,
  notes?: string
): Promise<{ error?: string; alreadyReported?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to report an opinion.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('opinion_reports').insert({
    opinion_id: opinionId,
    reporter_id: user.id,
    reason,
    notes: notes ?? null,
  })

  if (error) {
    if (error.code === '23505') return { alreadyReported: true }
    return { error: error.message }
  }

  return {}
}

export async function dismissReport(
  reportId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('opinion_reports')
    .update({ status: 'dismissed' })
    .eq('id', reportId)

  if (error) return { error: error.message }
  revalidatePath('/admin/reports')
  return {}
}

export async function removeOpinion(
  reportId: string,
  opinionId: string,
  dupeId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Delete the opinion (cascade removes votes + reports)
  const { error: opError } = await supabase
    .from('dupe_opinions')
    .delete()
    .eq('id', opinionId)

  if (opError) return { error: opError.message }

  // Mark report reviewed (in case cascade didn't clean it up)
  await db.from('opinion_reports').update({ status: 'reviewed' }).eq('id', reportId)

  revalidatePath(`/dupes/${dupeId}`)
  revalidatePath('/admin/reports')
  return {}
}

export async function toggleHelpfulVote(
  opinionId: string,
  isHelpful: boolean,
  dupeId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to vote.' }

  // Check for existing vote
  const { data: existing } = await supabase
    .from('opinion_votes')
    .select('is_helpful')
    .eq('opinion_id', opinionId)
    .eq('user_id', user.id)
    .single()

  if (existing && existing.is_helpful === isHelpful) {
    // Clicking same vote removes it
    await supabase
      .from('opinion_votes')
      .delete()
      .eq('opinion_id', opinionId)
      .eq('user_id', user.id)
  } else {
    await supabase.from('opinion_votes').upsert(
      { opinion_id: opinionId, user_id: user.id, is_helpful: isHelpful },
      { onConflict: 'opinion_id,user_id' }
    )
  }

  revalidatePath(`/dupes/${dupeId}`)
  return {}
}
