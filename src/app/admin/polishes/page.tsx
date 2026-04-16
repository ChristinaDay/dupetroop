import { createClient } from '@/lib/supabase/server'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { AdminPolishActions } from '@/components/admin/AdminPolishActions'
import { AdminFeaturedPolishActions } from '@/components/admin/AdminFeaturedPolishActions'
import { AdminFeaturePolishSearch } from '@/components/admin/AdminFeaturePolishSearch'
import type { PolishWithBrand, FeaturedPolish } from '@/lib/types/app.types'

export default async function AdminPolishesPage() {
  const supabase = await createClient()

  const [pendingResult, featuredResult] = await Promise.all([
    supabase
      .from('polishes')
      .select('*, brand:brands(*), collection:collections(*)')
      .eq('is_verified', false)
      .order('created_at', { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('polishes')
      .select('*, brand:brands(*), collection:collections(*)')
      .eq('is_verified', true)
      .eq('is_featured', true)
      .order('featured_rank', { ascending: true, nullsFirst: false }),
  ])

  const polishes = (pendingResult.data as unknown as PolishWithBrand[]) ?? []
  const featuredPolishes = (featuredResult.data as unknown as FeaturedPolish[]) ?? []

  return (
    <div className="space-y-12">

      {/* Pending queue */}
      <div>
        <h2 className="text-xl font-black mb-4">Pending polishes ({polishes.length})</h2>
        {polishes.length === 0 ? (
          <p className="text-muted-foreground">No pending polishes. 🎉</p>
        ) : (
          <div className="space-y-4">
            {polishes.map(polish => (
              <div key={polish.id} className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <PolishSwatch hexColor={polish.hex_color} hexSecondary={polish.hex_secondary} imageUrl={polish.images?.[0] ?? null} size="md" />
                  <div>
                    <p className="text-xs text-muted-foreground">{polish.brand.name}</p>
                    <p className="font-bold">{polish.name}</p>
                    <PolishBadge finish={polish.finish_category} />
                  </div>
                </div>
                <AdminPolishActions polishId={polish.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Featured / Trending Now management */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-black">Trending Now ({featuredPolishes.length})</h2>
          <p className="text-sm text-muted-foreground mt-1">
            These polishes appear in the "Trending Now" section on the homepage. Order by <code>featured_rank</code> (lower = first).
          </p>
        </div>

        <AdminFeaturePolishSearch />

        {featuredPolishes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No featured polishes yet. Use the search below to add some.</p>
        ) : (
          <div className="space-y-3">
            {featuredPolishes.map((polish, idx) => (
              <div key={polish.id} className="border border-border rounded-xl p-4 flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                <PolishSwatch hexColor={polish.hex_color} hexSecondary={polish.hex_secondary} imageUrl={polish.images?.[0] ?? null} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{polish.brand.name}</p>
                  <p className="font-bold truncate">{polish.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <PolishBadge finish={polish.finish_category} />
                    {polish.featured_source_type && (
                      <span className="text-xs text-muted-foreground capitalize">
                        via {polish.featured_source_type}
                      </span>
                    )}
                  </div>
                </div>
                <AdminFeaturedPolishActions polishId={polish.id} />
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
