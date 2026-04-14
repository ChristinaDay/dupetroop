import type { Metadata } from 'next'
import Link from 'next/link'
import { getBrands } from '@/lib/queries/brands'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Indie Nail Polish Brands',
  description: 'Browse all indie nail polish brands tracked on DupeTroop.',
}

export default async function BrandsPage() {
  const brands = await getBrands()

  const priceTierLabel = (tier: number | null) => {
    if (!tier) return null
    const labels = ['', '$', '$$', '$$$', '$$$$', '$$$$$']
    return labels[tier] ?? null
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-4xl font-black tracking-tight mb-2">Brands</h1>
      <p className="text-muted-foreground mb-8">{brands.length} indie brands and counting.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {brands.map(brand => (
          <Link
            key={brand.id}
            href={`/brands/${brand.slug}`}
            className="flex items-center gap-4 border border-border rounded-xl p-4 hover:border-primary hover:bg-accent transition-colors group"
          >
            {brand.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={brand.name} className="h-10 w-10 rounded-full object-contain border border-border" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-black text-muted-foreground">
                {brand.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold group-hover:text-primary transition-colors truncate">{brand.name}</p>
              {brand.country_of_origin && (
                <p className="text-xs text-muted-foreground">{brand.country_of_origin}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {brand.is_indie && <Badge variant="secondary" className="text-xs">Indie</Badge>}
              {brand.price_tier && (
                <span className="text-xs text-muted-foreground font-mono">{priceTierLabel(brand.price_tier)}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
