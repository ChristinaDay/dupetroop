import { getBrands } from '@/lib/queries/brands'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function AdminBrandsPage() {
  const brands = await getBrands()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black">Brands ({brands.length})</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Add and manage brands via the Supabase dashboard until a brand management UI is added here.
      </p>
      <div className="space-y-2">
        {brands.map(brand => (
          <div key={brand.id} className="flex items-center gap-3 border border-border rounded-lg px-4 py-3">
            <div className="flex-1">
              <span className="font-semibold">{brand.name}</span>
              {brand.country_of_origin && (
                <span className="text-xs text-muted-foreground ml-2">{brand.country_of_origin}</span>
              )}
            </div>
            {brand.is_indie && <Badge variant="secondary" className="text-xs">Indie</Badge>}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/brands/${brand.slug}`} target="_blank">View →</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
