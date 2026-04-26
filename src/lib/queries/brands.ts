import { createClient } from '@/lib/supabase/server'
import type { Brand } from '@/lib/types/app.types'

export async function getBrands(): Promise<Brand[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('getBrands error:', error)
    return []
  }
  return data
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('brands')
    .select('*')
    .eq('slug', slug)
    .single()

  return data
}
