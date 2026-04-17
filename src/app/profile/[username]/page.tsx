import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DupeCard } from '@/components/dupe/DupeCard'
import { formatPrice } from '@/lib/utils/format'

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  return {
    title: `@${username} — DoopTroop`,
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Load profile
  const { data: profile } = await db
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, dupe_count, polish_count')
    .eq('username', username)
    .single()

  if (!profile) notFound()

  const initials = (profile.display_name ?? profile.username ?? '?')
    .slice(0, 2)
    .toUpperCase()

  // Recent dupe submissions by this user
  const { data: submittedDupes } = await db
    .from('dupes')
    .select(`
      id, avg_overall, avg_color_accuracy, avg_finish_accuracy, avg_formula_accuracy, opinion_count,
      polish_a:polishes!polish_a_id(*, brand:brands(*), collection:collections(*)),
      polish_b:polishes!polish_b_id(*, brand:brands(*), collection:collections(*))
    `)
    .eq('submitted_by', profile.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(6)

  // Stash summary (owned count + value)
  const { data: stashItems } = await db
    .from('stash_items')
    .select('status, polish:polishes(msrp_usd)')
    .eq('user_id', profile.id)

  const owned = (stashItems ?? []).filter((i: { status: string }) => i.status === 'owned')
  const wishlist = (stashItems ?? []).filter((i: { status: string }) => i.status === 'wishlist')
  const ownedValue = owned.reduce((sum: number, i: { polish: { msrp_usd: number | null } }) => sum + (i.polish?.msrp_usd ?? 0), 0)
  const unknownCount = owned.filter((i: { polish: { msrp_usd: number | null } }) => !i.polish?.msrp_usd).length

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="flex items-start gap-5 mb-10">
        <Avatar className="h-20 w-20 shrink-0">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-2xl font-black">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black">{profile.display_name ?? profile.username}</h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && (
            <p className="text-sm mt-2 text-muted-foreground">{profile.bio}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <div className="border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-primary">{profile.dupe_count}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Dupes submitted</p>
        </div>
        <div className="border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-primary">{profile.polish_count}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Polishes submitted</p>
        </div>
        <div className="border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-primary">{owned.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Polishes owned</p>
        </div>
        <div className="border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-primary">
            {ownedValue > 0 ? formatPrice(ownedValue) : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Collection value{unknownCount > 0 ? '*' : ''}
          </p>
        </div>
      </div>

      {/* Wishlist teaser */}
      {wishlist.length > 0 && (
        <p className="text-xs text-muted-foreground mb-10 -mt-7">
          * Some prices unknown · {wishlist.length} on wishlist
        </p>
      )}

      {/* Submitted swaps */}
      {submittedDupes && submittedDupes.length > 0 && (
        <div>
          <h2 className="text-lg font-black tracking-tight mb-4">Dupes submitted</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {submittedDupes.map((dupe: any) => (
              <DupeCard key={dupe.id} dupe={dupe} />
            ))}
          </div>
          {profile.dupe_count > 6 && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Showing 6 of {profile.dupe_count} dupes
            </p>
          )}
        </div>
      )}

      {submittedDupes?.length === 0 && profile.dupe_count === 0 && (
        <div className="border border-dashed border-border rounded-xl py-10 text-center">
          <p className="text-muted-foreground font-medium">No dupes submitted yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            <Link href="/dupes/submit" className="hover:text-primary transition-colors underline underline-offset-2">
              Know a good dupe?
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
