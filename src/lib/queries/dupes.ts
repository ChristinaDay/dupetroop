import { createClient } from '@/lib/supabase/server'
import type { DupeWithPolishes, DupeFilters } from '@/lib/types/app.types'

const DUPE_SELECT = `
  *,
  polish_a:polishes!polish_a_id(*, brand:brands(*), collection:collections(*)),
  polish_b:polishes!polish_b_id(*, brand:brands(*), collection:collections(*)),
  submitter:profiles!submitted_by(username, display_name, avatar_url)
`

const PAGE_SIZE = 20

export async function getDupes(filters: DupeFilters = {}): Promise<{
  dupes: DupeWithPolishes[]
  total: number
}> {
  const supabase = await createClient()
  const page = filters.page ?? 1
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('dupes')
    .select(DUPE_SELECT, { count: 'exact' })
    .eq('status', 'approved')

  if (filters.minScore) {
    query = query.gte('avg_overall', filters.minScore)
  }

  switch (filters.sort) {
    case 'top_rated':
      query = query.order('avg_overall', { ascending: false, nullsFirst: false })
      break
    case 'most_opinions':
      query = query.order('opinion_count', { ascending: false })
      break
    default:
      query = query.order('created_at', { ascending: false })
  }

  query = query.range(from, to)

  const { data, count, error } = await query
  if (error) {
    console.error('getDupes error:', error)
    return { dupes: [], total: 0 }
  }

  const dupes = ((data as unknown as DupeWithPolishes[]) ?? [])
  return {
    dupes,
    total: count ?? 0,
  }
}

export async function getDupeById(id: string): Promise<DupeWithPolishes | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dupes')
    .select(DUPE_SELECT)
    .eq('id', id)
    .single()

  return data as unknown as DupeWithPolishes | null
}

export async function getRelatedDupes(dupeId: string, polishAId: string, polishBId: string, limit = 6): Promise<DupeWithPolishes[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dupes')
    .select(DUPE_SELECT)
    .eq('status', 'approved')
    .neq('id', dupeId)
    .or(`polish_a_id.eq.${polishAId},polish_b_id.eq.${polishAId},polish_a_id.eq.${polishBId},polish_b_id.eq.${polishBId}`)
    .order('avg_overall', { ascending: false, nullsFirst: false })
    .limit(limit)

  return (data as unknown as DupeWithPolishes[]) ?? []
}

export async function getDupesForPolish(polishId: string): Promise<DupeWithPolishes[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dupes')
    .select(DUPE_SELECT)
    .eq('status', 'approved')
    .or(`polish_a_id.eq.${polishId},polish_b_id.eq.${polishId}`)
    .order('avg_overall', { ascending: false, nullsFirst: false })

  return (data as unknown as DupeWithPolishes[]) ?? []
}

export async function getFeaturedDupes(limit = 6): Promise<DupeWithPolishes[]> {
  const supabase = await createClient()

  // Prefer rated dupes; fall back to recently approved if the community is new
  const { data: rated } = await supabase
    .from('dupes')
    .select(DUPE_SELECT)
    .eq('status', 'approved')
    .gte('opinion_count', 1)
    .order('avg_overall', { ascending: false, nullsFirst: false })
    .limit(limit)

  const ratedFiltered = ((rated as unknown as DupeWithPolishes[]) ?? [])
  if (ratedFiltered.length >= 3) return ratedFiltered

  const { data: recent } = await supabase
    .from('dupes')
    .select(DUPE_SELECT)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit)

  return (recent as unknown as DupeWithPolishes[]) ?? []
}

export async function getRecentDupes(limit = 10): Promise<DupeWithPolishes[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dupes')
    .select(DUPE_SELECT)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data as unknown as DupeWithPolishes[]) ?? []
}

export async function getPendingDupes(): Promise<DupeWithPolishes[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dupes')
    .select(DUPE_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (data as unknown as DupeWithPolishes[]) ?? []
}

export async function getTrendingDupes(limit = 6): Promise<DupeWithPolishes[]> {
  const supabase = await createClient()
  // is_featured added via migration 002 — cast until types are regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('dupes')
    .select(DUPE_SELECT)
    .eq('status', 'approved')
    .eq('is_featured', true)
    .order('featured_rank', { ascending: true, nullsFirst: false })
    .limit(limit)

  return (data as unknown as DupeWithPolishes[]) ?? []
}

export async function checkDupeExists(
  polishAId: string,
  polishBId: string
): Promise<string | null> {
  const supabase = await createClient()
  const ids = [polishAId, polishBId].sort()
  const { data } = await supabase
    .from('dupes')
    .select('id, status')
    .or(
      `and(polish_a_id.eq.${ids[0]},polish_b_id.eq.${ids[1]}),and(polish_a_id.eq.${ids[1]},polish_b_id.eq.${ids[0]})`
    )
    .single()

  return data?.id ?? null
}
