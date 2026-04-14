import { createClient } from '@/lib/supabase/server'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { AdminPolishActions } from '@/components/admin/AdminPolishActions'
import type { PolishWithBrand } from '@/lib/types/app.types'

export default async function AdminPolishesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('polishes')
    .select('*, brand:brands(*), collection:collections(*)')
    .eq('is_verified', false)
    .order('created_at', { ascending: true })

  const polishes = (data as unknown as PolishWithBrand[]) ?? []

  return (
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
  )
}
