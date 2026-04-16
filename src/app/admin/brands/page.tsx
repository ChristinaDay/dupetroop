import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const PRICE_TIER_LABELS: Record<number, string> = {
  1: 'Drugstore',
  2: 'Mid-range',
  3: 'Indie',
  4: 'Premium',
  5: 'Luxury',
}

export default async function AdminBrandsPage() {
  const supabase = await createClient()
  // Fetch all brands including inactive, ordered by name
  const { data: brands } = await supabase
    .from('brands')
    .select('*')
    .order('name')

  const active = (brands ?? []).filter(b => b.is_active)
  const inactive = (brands ?? []).filter(b => !b.is_active)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black">
          Brands ({active.length} active{inactive.length > 0 ? `, ${inactive.length} inactive` : ''})
        </h2>
        <Button asChild size="sm">
          <Link href="/admin/brands/new">+ Add brand</Link>
        </Button>
      </div>

      <div className="space-y-2">
        {(brands ?? []).map(brand => (
          <div
            key={brand.id}
            className={`flex items-center gap-3 border border-border rounded-lg px-4 py-3 ${!brand.is_active ? 'opacity-50' : ''}`}
          >
            {/* Logo */}
            {brand.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={brand.name} className="h-8 w-8 rounded-full object-contain border border-border shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-black text-muted-foreground shrink-0">
                {brand.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{brand.name}</span>
                {!brand.is_active && (
                  <span className="text-xs text-muted-foreground italic">inactive</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">{brand.slug}</span>
                {brand.country_of_origin && (
                  <span className="text-xs text-muted-foreground">· {brand.country_of_origin}</span>
                )}
                {brand.price_tier && (
                  <span className="text-xs text-muted-foreground">· {PRICE_TIER_LABELS[brand.price_tier]}</span>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 shrink-0">
              {brand.is_indie && <Badge variant="secondary" className="text-xs">Indie</Badge>}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/brands/${brand.slug}`} target="_blank">View</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/admin/brands/${brand.id}/edit`}>Edit</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
