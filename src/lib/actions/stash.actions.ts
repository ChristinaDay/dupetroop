'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addToStash(input: {
  polishId: string
  status?: 'owned' | 'wishlist' | 'bookmarked'
  notes?: string
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to add to your stash.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('stash_items')
    .insert({
      user_id: user.id,
      polish_id: input.polishId,
      status: input.status ?? 'owned',
      notes: input.notes ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'This polish is already in your stash.' }
    return { error: error.message }
  }

  revalidatePath('/stash')
  return { id: data.id }
}

export async function updateStashItemStatus(
  stashItemId: string,
  status: 'owned' | 'wishlist' | 'bookmarked'
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('stash_items')
    .update({ status })
    .eq('id', stashItemId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/stash')
  return { success: true }
}

export async function removeFromStash(
  stashItemId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('stash_items')
    .delete()
    .eq('id', stashItemId)
    .eq('user_id', user.id)  // RLS double-check

  if (error) return { error: error.message }

  revalidatePath('/stash')
  return { success: true }
}

export async function importStashFromCSV(
  csvText: string
): Promise<{ imported: number; skipped: number } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to import your stash.' }

  // Parse CSV — expect columns: brand, name (case-insensitive, extras ignored)
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return { error: 'CSV must have a header row and at least one data row.' }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  const brandIdx = headers.indexOf('brand')
  const nameIdx = headers.indexOf('name')

  if (brandIdx === -1 || nameIdx === -1) {
    return { error: 'CSV must have "brand" and "name" columns.' }
  }

  const rows = lines.slice(1).map(line => {
    // Handle quoted fields
    const cols = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) ?? line.split(',')
    const clean = (s?: string) => (s ?? '').trim().replace(/^"|"$/g, '')
    return { brand: clean(cols[brandIdx]), name: clean(cols[nameIdx]) }
  }).filter(r => r.brand && r.name)

  if (rows.length === 0) return { error: 'No valid rows found in CSV.' }

  // Match against polishes table (case-insensitive)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: polishes, error: fetchError } = await db
    .from('polishes')
    .select('id, name, brand:brands(name)')
    .eq('is_verified', true)

  if (fetchError) return { error: fetchError.message }

  const polishMap = new Map<string, string>()
  for (const p of polishes ?? []) {
    const key = `${p.brand?.name ?? ''}|${p.name}`.toLowerCase()
    polishMap.set(key, p.id)
  }

  const matched: { user_id: string; polish_id: string }[] = []
  let skipped = 0

  for (const row of rows) {
    const key = `${row.brand}|${row.name}`.toLowerCase()
    const polishId = polishMap.get(key)
    if (polishId) {
      matched.push({ user_id: user.id, polish_id: polishId })
    } else {
      skipped++
    }
  }

  if (matched.length === 0) {
    return { error: `No polishes matched. ${skipped} rows were skipped (brand/name not found).` }
  }

  // Upsert — ignore duplicates already in stash
  let imported = 0
  for (const item of matched) {
    const { error } = await db.from('stash_items').insert(item)
    if (!error) imported++
    else if (error.code !== '23505') skipped++  // count non-duplicate errors as skipped
  }

  revalidatePath('/stash')
  return { imported, skipped }
}
