import { createClient } from '@/lib/supabase/server'
import type { StashItemWithPolish } from '@/lib/types/app.types'

const POLISH_SELECT = `*, brand:brands(*), collection:collections(*)`

const STASH_SELECT = `
  *,
  polish:polishes(${POLISH_SELECT})
`

const PAGE_SIZE = 24

export async function getUserStash(
  userId: string,
  page = 1
): Promise<{ items: StashItemWithPolish[]; total: number }> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, count, error } = await db
    .from('stash_items')
    .select(STASH_SELECT, { count: 'exact' })
    .eq('user_id', userId)
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error

  return {
    items: (data ?? []) as unknown as StashItemWithPolish[],
    total: count ?? 0,
  }
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
