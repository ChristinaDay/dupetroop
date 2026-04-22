import { createClient } from '@/lib/supabase/server'
import type { PolishWithBrand, FeaturedPolish, PolishFilters } from '@/lib/types/app.types'

const POLISH_SELECT = `
  *,
  brand:brands(*),
  collection:collections(*),
  tags:polish_tags(tag:tags(slug, name))
`

const PAGE_SIZE = 24

export async function getPolishes(filters: PolishFilters = {}): Promise<{
  polishes: PolishWithBrand[]
  total: number
}> {
  const supabase = await createClient()
  const page = filters.page ?? 1
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('polishes')
    .select(POLISH_SELECT, { count: 'exact' })
    .eq('is_verified', true)

  if (filters.discontinued === false) {
    query = query.eq('is_discontinued', false)
  }

  if (filters.brand) {
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', filters.brand)
      .single()
    if (brand) query = query.eq('brand_id', brand.id)
  }

  if (filters.finish) {
    query = query.eq('finish_category', filters.finish)
  }

  if (filters.color) {
    query = query.eq('color_family', filters.color)
  }

  if (filters.q) {
    query = query.textSearch('name', filters.q, { type: 'websearch' })
  }

  switch (filters.sort) {
    case 'most_dupes':
      query = query.order('dupe_count', { ascending: false })
      break
    case 'name_asc':
      query = query.order('name')
      break
    default:
      query = query.order('created_at', { ascending: false })
  }

  query = query.range(from, to)

  const { data, count, error } = await query
  if (error) throw error

  return {
    polishes: (data as unknown as PolishWithBrand[]) ?? [],
    total: count ?? 0,
  }
}

export async function getPolishBySlug(
  brandSlug: string,
  polishSlug: string
): Promise<PolishWithBrand | null> {
  const supabase = await createClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('slug', brandSlug)
    .single()

  if (!brand) return null

  const { data } = await supabase
    .from('polishes')
    .select(POLISH_SELECT)
    .eq('brand_id', brand.id)
    .eq('slug', polishSlug)
    .single()

  return data as unknown as PolishWithBrand | null
}

export async function getFeaturedPolishes(limit = 6): Promise<FeaturedPolish[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('polishes')
    .select(POLISH_SELECT)
    .eq('is_verified', true)
    .eq('is_featured', true)
    .order('featured_rank', { ascending: true, nullsFirst: false })
    .limit(limit)

  return (data as unknown as FeaturedPolish[]) ?? []
}

export async function searchPolishes(q: string): Promise<PolishWithBrand[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('polishes')
    .select(POLISH_SELECT)
    .eq('is_verified', true)
    .or(`name.ilike.%${q}%`)
    .order('name')
    .limit(10)

  return (data as unknown as PolishWithBrand[]) ?? []
}

export async function getPolishRatings(polishId: string): Promise<{
  ownerRating: {
    avg: number
    avgColor: number | null
    avgFinish: number | null
    avgFormula: number | null
    count: number
  } | null
  externalRatings: import('@/lib/types/app.types').ExternalRating[]
}> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [polishResult, externalResult] = await Promise.all([
    db
      .from('polishes')
      .select('avg_rating, avg_color_rating, avg_finish_rating, avg_formula_rating, rating_count')
      .eq('id', polishId)
      .single(),
    db
      .from('polish_external_ratings')
      .select('*')
      .eq('polish_id', polishId)
      .order('review_count', { ascending: false, nullsFirst: false }),
  ])

  const p = polishResult.data
  const ownerRating = p?.rating_count > 0 && p?.avg_rating != null
    ? {
        avg: Number(p.avg_rating),
        avgColor: p.avg_color_rating != null ? Number(p.avg_color_rating) : null,
        avgFinish: p.avg_finish_rating != null ? Number(p.avg_finish_rating) : null,
        avgFormula: p.avg_formula_rating != null ? Number(p.avg_formula_rating) : null,
        count: p.rating_count,
      }
    : null

  return {
    ownerRating,
    externalRatings: externalResult.data ?? [],
  }
}
