'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils/slugify'
import type { FinishCategory, ColorFamily, FeaturedSourceType } from '@/lib/types/app.types'

type PolishInput = {
  brandId: string
  collectionId?: string
  name: string
  finishCategory: FinishCategory
  hexColor?: string
  hexSecondary?: string
  colorFamily?: ColorFamily
  finishNotes?: string
  isTopper?: boolean
  msrpUsd?: number
  productUrl?: string
  isDiscontinued?: boolean
  isLimited?: boolean
  description?: string
  images?: string[]
}

export async function submitPolish(
  input: PolishInput
): Promise<{ polishId: string } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to submit a polish.' }

  const slug = slugify(input.name)

  const { data, error } = await supabase
    .from('polishes')
    .insert({
      brand_id: input.brandId,
      collection_id: input.collectionId ?? null,
      name: input.name,
      slug,
      finish_category: input.finishCategory,
      hex_color: input.hexColor ?? null,
      hex_secondary: input.hexSecondary ?? null,
      color_family: input.colorFamily ?? null,
      finish_notes: input.finishNotes ?? null,
      is_topper: input.isTopper ?? false,
      msrp_usd: input.msrpUsd ?? null,
      product_url: input.productUrl ?? null,
      is_discontinued: input.isDiscontinued ?? false,
      is_limited: input.isLimited ?? false,
      description: input.description ?? null,
      images: input.images ?? [],
      submitted_by: user.id,
      is_verified: false,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'A polish with this name already exists for this brand.' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/polishes')
  return { polishId: data.id }
}

export async function approvePolish(polishId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('polishes')
    .update({ is_verified: true, updated_at: new Date().toISOString() })
    .eq('id', polishId)

  if (error) return { error: error.message }

  revalidatePath('/admin/polishes')
  revalidatePath('/polishes')
  return {}
}

export async function setPolishFeatured(
  polishId: string,
  featured: boolean,
  rank?: number,
  sourceType?: FeaturedSourceType | null,
  sourceUrl?: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('polishes')
    .update({
      is_featured: featured,
      featured_rank: featured ? (rank ?? null) : null,
      featured_source_type: featured ? (sourceType ?? null) : null,
      featured_source_url: featured ? (sourceUrl ?? null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', polishId)

  if (error) return { error: error.message }

  revalidatePath('/admin/polishes')
  revalidatePath('/')
  return {}
}

export async function rejectPolish(polishId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('polishes')
    .delete()
    .eq('id', polishId)

  if (error) return { error: error.message }

  revalidatePath('/admin/polishes')
  return {}
}
