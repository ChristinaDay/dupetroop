import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { getBrandBySlug } from '@/lib/queries/brands'
import { getPolishes } from '@/lib/queries/polishes'
import { PolishCard } from '@/components/polish/PolishCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ brandSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { brandSlug } = await params
  const brand = await getBrandBySlug(brandSlug)
  if (!brand) return {}
  return {
    title: brand.name,
    description: `Browse all ${brand.name} nail polishes and find dupes on DupeTroop.`,
  }
}

export default async function BrandPage({ params }: PageProps) {
  const { brandSlug } = await params
  const [brand, { polishes, total }] = await Promise.all([
    getBrandBySlug(brandSlug),
    getPolishes({ brand: brandSlug }),
  ])

  if (!brand) notFound()

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
        <Link href="/brands" className="hover:text-foreground">Brands</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{brand.name}</span>
      </nav>

      <div className="flex items-start gap-5 mb-10">
        {brand.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_url} alt={brand.name} className="h-16 w-16 rounded-full object-contain border border-border" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-lg font-black text-muted-foreground">
            {brand.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-black tracking-tight">{brand.name}</h1>
            {brand.is_indie && <Badge variant="secondary">Indie</Badge>}
          </div>
          {brand.country_of_origin && (
            <p className="text-sm text-muted-foreground mt-0.5">{brand.country_of_origin}</p>
          )}
          {brand.description && <p className="text-sm mt-2">{brand.description}</p>}
          {brand.website_url && (
            <Button asChild variant="outline" size="sm" className="mt-3">
              <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                Visit website
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-black">{total} polishes</h2>
      </div>

      {polishes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {polishes.map(polish => (
            <PolishCard key={polish.id} polish={polish} showDupeCount />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No polishes added yet for this brand.</p>
      )}
    </div>
  )
}
