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
