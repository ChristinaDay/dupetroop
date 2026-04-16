import { createClient } from '@/lib/supabase/server'
import type { StashItemWithPolish, StashSummary, StashStatus } from '@/lib/types/app.types'

const POLISH_SELECT = `*, brand:brands(*), collection:collections(*)`

const STASH_SELECT = `
  *,
  polish:polishes(${POLISH_SELECT})
`

export async function getUserStashSummary(userId: string): Promise<StashSummary> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data, error } = await db
    .from('stash_items')
    .select(STASH_SELECT)
    .eq('user_id', userId)
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  const all = (data ?? []) as unknown as StashItemWithPolish[]

  const bucket = (status: 'owned' | 'wishlist' | 'bookmarked' | 'destashed') => {
    const items = all.filter(i => i.status === status)
    let value = 0
    let unknownCount = 0
    for (const item of items) {
      const price = item.polish.msrp_usd
      if (price != null) value += price
      else unknownCount++
    }
    return { items, value, unknownCount }
  }

  return {
    owned: bucket('owned'),
    wishlist: bucket('wishlist'),
    bookmarked: bucket('bookmarked'),
    destashed: bucket('destashed'),
  }
}

// Legacy: used by export route and CSV import flow
export async function getUserStash(
  userId: string,
): Promise<{ items: StashItemWithPolish[]; total: number }> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data, count, error } = await db
    .from('stash_items')
    .select(STASH_SELECT, { count: 'exact' })
    .eq('user_id', userId)
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  return {
    items: (data ?? []) as unknown as StashItemWithPolish[],
    total: count ?? 0,
  }
}

// Returns a map of polish_id → { id, status } for lightweight bulk stash checks.
// Used to render stash icon buttons on browse grids.
export async function getUserStashMap(
  userId: string,
): Promise<Record<string, { id: string; status: StashStatus }>> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data, error } = await db
    .from('stash_items')
    .select('id, polish_id, status')
    .eq('user_id', userId)

  if (error) throw error

  const map: Record<string, { id: string; status: StashStatus }> = {}
  for (const row of data ?? []) {
    map[row.polish_id] = { id: row.id, status: row.status as StashStatus }
  }
  return map
}

// Returns the set of polish IDs in a user's stash — used for bulk ownership
// checks on Look detail pages without fetching full stash data.
export async function getStashedPolishIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data, error } = await db
    .from('stash_items')
    .select('polish_id')
    .eq('user_id', userId)

  if (error) throw error

  return new Set((data ?? []).map((row: { polish_id: string }) => row.polish_id))
}
