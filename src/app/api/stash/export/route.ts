import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { StashItemWithPolish } from '@/lib/types/app.types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('stash_items')
    .select('*, polish:polishes(*, brand:brands(*), collection:collections(*))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = (data ?? []) as unknown as StashItemWithPolish[]

  const header = 'brand,name,finish,hex_color,msrp_usd,notes,added_date'
  const rows = items.map(item => {
    const p = item.polish
    const escape = (v: string | null | undefined) =>
      v ? `"${String(v).replace(/"/g, '""')}"` : ''
    return [
      escape(p.brand?.name),
      escape(p.name),
      p.finish_category ?? '',
      p.hex_color ?? '',
      p.msrp_usd ?? '',
      escape(item.notes),
      item.created_at.slice(0, 10),
    ].join(',')
  })

  const csv = [header, ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="my-stash.csv"',
    },
  })
}
