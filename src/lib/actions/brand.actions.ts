'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils/slugify'

type BrandInput = {
  name: string
  slug?: string
  description?: string
  website_url?: string
  logo_url?: string
  is_indie: boolean
  country_of_origin?: string
  price_tier?: number | null
  is_active: boolean
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, supabase: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    return { error: 'Forbidden' as const, supabase: null }
  }

  return { error: null, supabase }
}

export async function createBrand(
  input: BrandInput,
): Promise<{ id: string } | { error: string }> {
  const { error: authError, supabase } = await requireAdmin()
  if (authError || !supabase) return { error: authError ?? 'Unauthorized' }

  const slug = input.slug?.trim() || slugify(input.name)

  const { data, error } = await supabase
    .from('brands')
    .insert({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      website_url: input.website_url?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      is_indie: input.is_indie,
      country_of_origin: input.country_of_origin?.trim() || null,
      price_tier: input.price_tier ?? null,
      is_active: input.is_active,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'A brand with that name or slug already exists.' }
    return { error: error.message }
  }

  revalidatePath('/admin/brands')
  revalidatePath('/brands')
  return { id: data.id }
}

export async function updateBrand(
  id: string,
  input: BrandInput,
): Promise<{ success: true } | { error: string }> {
  const { error: authError, supabase } = await requireAdmin()
  if (authError || !supabase) return { error: authError ?? 'Unauthorized' }

  const slug = input.slug?.trim() || slugify(input.name)

  const { error } = await supabase
    .from('brands')
    .update({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      website_url: input.website_url?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      is_indie: input.is_indie,
      country_of_origin: input.country_of_origin?.trim() || null,
      price_tier: input.price_tier ?? null,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'A brand with that name or slug already exists.' }
    return { error: error.message }
  }

  revalidatePath('/admin/brands')
  revalidatePath('/brands')
  revalidatePath(`/brands/${slug}`)
  return { success: true }
}
