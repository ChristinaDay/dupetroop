import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PolishWithBrand, Brand } from '@/lib/types/app.types'

export interface SearchResults {
  polishes: PolishWithBrand[]
  brands: Brand[]
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json<SearchResults>({ polishes: [], brands: [] })
  }

  const supabase = await createClient()
  const pattern = `%${q}%`

  const [polishRes, brandRes] = await Promise.all([
    supabase
      .from('polishes')
      .select('*, brand:brands(*), collection:collections(*)')
      .eq('is_verified', true)
      .ilike('name', pattern)
      .order('dupe_count', { ascending: false })
      .limit(6),
    supabase
      .from('brands')
      .select('*')
      .eq('is_active', true)
      .ilike('name', pattern)
      .order('name')
      .limit(4),
  ])

  return NextResponse.json<SearchResults>({
    polishes: (polishRes.data as unknown as PolishWithBrand[]) ?? [],
    brands: (brandRes.data as Brand[]) ?? [],
  })
}
