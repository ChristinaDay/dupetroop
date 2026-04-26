'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { LookSourceType, ComponentRole } from '@/lib/types/app.types'
import { slugify } from '@/lib/utils/slugify'

// ─── Admin: create a look with components in one shot ────────────────────────

export interface CreateLookInput {
  name: string
  description?: string
  target_polish_id?: string
  source_url?: string
  source_type: LookSourceType
  is_featured: boolean
  featured_rank?: number
  components: Array<{
    polish_id: string
    step_order: number
    role: ComponentRole
    notes?: string
  }>
}

export async function createLook(
  input: CreateLookInput
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    return { error: 'Insufficient permissions' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: look, error: lookError } = await db
    .from('looks')
    .insert({
      name: input.name,
      description: input.description || null,
      target_polish_id: input.target_polish_id || null,
      source_url: input.source_url || null,
      source_type: input.source_type,
      is_featured: input.is_featured,
      featured_rank: input.featured_rank ?? null,
      created_by: user.id,
      // Admins create looks pre-approved
      status: 'approved',
    })
    .select('id')
    .single()

  if (lookError || !look) {
    return { error: lookError?.message ?? 'Failed to create look' }
  }

  if (input.components.length > 0) {
    const { error: compError } = await db.from('look_components').insert(
      input.components.map(c => ({
        look_id: look.id,
        polish_id: c.polish_id,
        step_order: c.step_order,
        role: c.role,
        notes: c.notes || null,
      }))
    )
    if (compError) {
      // Roll back the look if components fail
      await db.from('looks').delete().eq('id', look.id)
      return { error: compError.message }
    }
  }

  revalidatePath('/')
  revalidatePath('/looks')
  return { id: look.id }
}

// ─── Community: submit a multi-polish dupe combination ───────────────────────

export interface SubmitLookAsDupeInput {
  target_polish_id: string
  notes?: string
  components: Array<{
    polish_id: string
    step_order: number
    role: ComponentRole
  }>
}

export async function submitLookAsDupe(
  input: SubmitLookAsDupeInput
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch polish names server-side to build the auto-generated name
  const polishIds = input.components.map(c => c.polish_id)
  const { data: polishes } = await db
    .from('polishes')
    .select('id, name')
    .in('id', polishIds)

  const nameMap: Record<string, string> = Object.fromEntries(
    (polishes ?? []).map((p: { id: string; name: string }) => [p.id, p.name])
  )
  const autoName = input.components
    .sort((a, b) => a.step_order - b.step_order)
    .map(c => nameMap[c.polish_id] ?? 'Unknown')
    .join(' + ')

  const { data: look, error: lookError } = await db
    .from('looks')
    .insert({
      name: autoName,
      description: input.notes || null,
      target_polish_id: input.target_polish_id,
      source_type: 'admin',
      is_featured: false,
      created_by: user.id,
      status: 'pending',
    })
    .select('id')
    .single()

  if (lookError || !look) {
    return { error: lookError?.message ?? 'Failed to submit combination' }
  }

  const { error: compError } = await db.from('look_components').insert(
    input.components.map(c => ({
      look_id: look.id,
      polish_id: c.polish_id,
      step_order: c.step_order,
      role: c.role,
      notes: null,
    }))
  )

  if (compError) {
    await db.from('looks').delete().eq('id', look.id)
    return { error: compError.message }
  }

  revalidatePath('/admin/looks')
  return { id: look.id }
}

// ─── Admin: approve / reject ──────────────────────────────────────────────────

export async function approveLook(
  lookId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('looks')
    .update({ status: 'approved' })
    .eq('id', lookId)

  if (error) return { error: error.message }

  revalidatePath('/')
  revalidatePath('/looks')
  revalidatePath(`/looks/${lookId}`)
  return { success: true }
}

export async function rejectLook(
  lookId: string,
  reason?: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const updateData: Record<string, unknown> = { status: 'rejected' }
  if (reason) updateData.description = reason

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('looks')
    .update(updateData)
    .eq('id', lookId)

  if (error) return { error: error.message }

  revalidatePath('/admin/looks')
  return { success: true }
}

