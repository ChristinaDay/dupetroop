import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PolishWithBrand, Brand, FinishCategory, ColorFamily } from '@/lib/types/app.types'

export interface SearchResults {
  polishes: PolishWithBrand[]
  brands: Brand[]
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const q = params.get('q')?.trim()
  const finish = params.get('finish') as FinishCategory | null
  const color = params.get('color') as ColorFamily | null

  if ((!q || q.length < 2) && !finish && !color) {
    return NextResponse.json<SearchResults>({ polishes: [], brands: [] })
  }

  const supabase = await createClient()

  let polishQuery = supabase
    .from('polishes')
    .select('*, brand:brands(*), collection:collections(*)')
    .eq('is_verified', true)
    .order('dupe_count', { ascending: false })
    .limit(6)

  if (q && q.length >= 2) polishQuery = polishQuery.ilike('name', `%${q}%`)
  if (finish) polishQuery = polishQuery.eq('finish_category', finish)
  if (color) polishQuery = polishQuery.eq('color_family', color)

  // Brands are only searched by name text — filter chips don't apply
  const brandQueryBase = supabase
    .from('brands')
    .select('*')
    .eq('is_active', true)
    .order('name')
    .limit(4)

  const brandQuery = q && q.length >= 2
    ? brandQueryBase.ilike('name', `%${q}%`)
    : brandQueryBase.limit(0)

  const [polishRes, brandRes] = await Promise.all([polishQuery, brandQuery])

  return NextResponse.json<SearchResults>({
    polishes: (polishRes.data as unknown as PolishWithBrand[]) ?? [],
    brands: (brandRes.data as Brand[]) ?? [],
  })
}
