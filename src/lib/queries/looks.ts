import { createClient } from '@/lib/supabase/server'
import type {
  Look,
  LookWithComponents,
  LookComponent,
  PolishWithBrand,
} from '@/lib/types/app.types'

const POLISH_SELECT = `*, brand:brands(*), collection:collections(*)`

// Minimal look select — used for cards (no components)
const LOOK_SELECT = `
  *,
  target_polish:polishes!target_polish_id(${POLISH_SELECT})
`

// Full look select with ordered components
const LOOK_DETAIL_SELECT = `
  *,
  target_polish:polishes!target_polish_id(${POLISH_SELECT}),
  look_components(
    *,
    polish:polishes(${POLISH_SELECT})
  )
`

export type LookCard = Look & {
  target_polish: PolishWithBrand | null
}

export async function getFeaturedLooks(limit = 6): Promise<LookCard[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('looks')
    .select(LOOK_SELECT)
    .eq('status', 'approved')
    .eq('is_featured', true)
    .order('featured_rank', { ascending: true, nullsFirst: false })
    .limit(limit)

  return (data as unknown as LookCard[]) ?? []
}

export async function getLooks(limit = 20, offset = 0): Promise<LookCard[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('looks')
    .select(LOOK_SELECT)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  return (data as unknown as LookCard[]) ?? []
}

export async function getLooksForPolish(polishId: string): Promise<LookCard[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // 1. Looks that target this polish directly
  const { data: asTarget } = await db
    .from('looks')
    .select(LOOK_SELECT)
    .eq('status', 'approved')
    .eq('target_polish_id', polishId)
    .order('is_featured', { ascending: false })
    .limit(10)

  // 2. Looks where this polish is a component (it's used in the recipe)
  const { data: componentRows } = await db
    .from('look_components')
    .select('look_id')
    .eq('polish_id', polishId)

  let asComponent: LookCard[] = []
  if (componentRows && componentRows.length > 0) {
    const lookIds = componentRows.map((r: { look_id: string }) => r.look_id)
    const { data } = await db
      .from('looks')
      .select(LOOK_SELECT)
      .eq('status', 'approved')
      .in('id', lookIds)
      .order('is_featured', { ascending: false })
      .limit(10)
    asComponent = (data as unknown as LookCard[]) ?? []
  }

  // Merge, deduplicate by id, target-first items first
  const seen = new Set<string>()
  const merged: LookCard[] = []
  for (const look of [...(asTarget ?? []), ...asComponent]) {
    if (!seen.has(look.id)) {
      seen.add(look.id)
      merged.push(look)
    }
  }
  return merged
}

export async function getLookById(id: string): Promise<LookWithComponents | null> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: raw } = await db
    .from('looks')
    .select(LOOK_DETAIL_SELECT)
    .eq('id', id)
    .single()

  if (!raw) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const look = raw as any

  // For each component, find the cheapest approved 1:1 dupe of that polish
  const componentsRaw: Array<{
    id: string
    look_id: string
    polish_id: string
    step_order: number
    role: string
    notes: string | null
    polish: PolishWithBrand
  }> = (look.look_components ?? []).sort(
    (a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order
  )

  const components: LookComponent[] = await Promise.all(
    componentsRaw.map(async (comp) => {
      // Find cheapest alternative: a dupe of this polish with the lowest MSRP on the other side
      const { data: dupeRows } = await db
        .from('dupes')
        .select(`
          polish_a:polishes!polish_a_id(${POLISH_SELECT}),
          polish_b:polishes!polish_b_id(${POLISH_SELECT})
        `)
        .eq('status', 'approved')
        .or(`polish_a_id.eq.${comp.polish_id},polish_b_id.eq.${comp.polish_id}`)
        .limit(20)

      let bestDupe: PolishWithBrand | null = null
      let bestPrice = Infinity

      for (const row of dupeRows ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any
        // The "other" side is the alternative polish
        const alt: PolishWithBrand =
          r.polish_a?.id === comp.polish_id ? r.polish_b : r.polish_a
        if (!alt) continue
        const price = alt.msrp_usd ?? Infinity
        if (price < bestPrice) {
          bestPrice = price
          bestDupe = alt
        }
      }

      return {
        id: comp.id,
        look_id: comp.look_id,
        polish_id: comp.polish_id,
        step_order: comp.step_order,
        role: comp.role as LookComponent['role'],
        notes: comp.notes,
        polish: comp.polish,
        best_dupe: bestDupe,
      }
    })
  )

  return {
    ...look,
    target_polish: look.target_polish ?? null,
    components,
  } as LookWithComponents
}

export async function getPendingLooks(): Promise<LookCard[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('looks')
    .select(LOOK_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (data as unknown as LookCard[]) ?? []
}
