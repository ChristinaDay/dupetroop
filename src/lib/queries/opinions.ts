import { createClient } from '@/lib/supabase/server'
import type { OpinionWithProfile } from '@/lib/types/app.types'

const OPINION_SELECT = `
  *,
  profile:profiles!user_id(username, display_name, avatar_url)
`

export async function getOpinionsForDupe(
  dupeId: string,
  viewerUserId?: string
): Promise<OpinionWithProfile[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dupe_opinions')
    .select(OPINION_SELECT)
    .eq('dupe_id', dupeId)
    .order('owns_both', { ascending: false })
    .order('helpful_votes', { ascending: false })

  const opinions = (data as unknown as OpinionWithProfile[]) ?? []

  // If viewer is logged in, fetch their votes to annotate
  if (viewerUserId && opinions.length > 0) {
    const opinionIds = opinions.map(o => o.id)
    const { data: votes } = await supabase
      .from('opinion_votes')
      .select('opinion_id, is_helpful')
      .eq('user_id', viewerUserId)
      .in('opinion_id', opinionIds)

    const voteMap = new Map(votes?.map(v => [v.opinion_id, v.is_helpful]) ?? [])
    return opinions.map(o => ({ ...o, user_vote: voteMap.get(o.id) ?? null }))
  }

  return opinions.map(o => ({ ...o, user_vote: null }))
}

export async function getUserOpinionForDupe(
  dupeId: string,
  userId: string
): Promise<OpinionWithProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dupe_opinions')
    .select(OPINION_SELECT)
    .eq('dupe_id', dupeId)
    .eq('user_id', userId)
    .single()

  if (!data) return null
  return { ...(data as unknown as OpinionWithProfile), user_vote: null }
}
