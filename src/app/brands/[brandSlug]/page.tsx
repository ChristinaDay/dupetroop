import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { getBrandBySlug } from '@/lib/queries/brands'
import { getPolishes } from '@/lib/queries/polishes'
import { getUserStashMap } from '@/lib/queries/stash'
import { createClient } from '@/lib/supabase/server'
import { PolishCard } from '@/components/polish/PolishCard'
import { StashIconButton } from '@/components/stash/StashIconButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { StashStatus } from '@/lib/types/app.types'

interface PageProps {
  params: Promise<{ brandSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { brandSlug } = await params
  const brand = await getBrandBySlug(brandSlug)
  if (!brand) return {}
  return {
    title: brand.name,
    description: `Browse all ${brand.name} nail polishes and find dupes on DoopTroop.`,
  }
}

export default async function BrandPage({ params }: PageProps) {
  const { brandSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [brand, { polishes, total }, stashMap] = await Promise.all([
    getBrandBySlug(brandSlug),
    getPolishes({ brand: brandSlug }),
    user ? getUserStashMap(user.id) : Promise.resolve({} as Record<string, { id: string; status: StashStatus }>),
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
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center text-lg font-black text-muted-foreground shrink-0 overflow-hidden border border-border/40"
          style={{ background: 'white' }}
        >
          {brand.logo_url
            ? <img src={brand.logo_url} alt={brand.name} className="h-12 w-12 object-contain" />
            : brand.name.slice(0, 2).toUpperCase()}
        </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {polishes.map(polish => (
            <div key={polish.id} className="relative group/stash">
              <PolishCard polish={polish} showDupeCount />
              {user && (
                <div className={`absolute top-2 right-2 z-10 transition-opacity ${stashMap[polish.id] ? 'opacity-100' : 'opacity-0 group-hover/stash:opacity-100'}`}>
                  <StashIconButton
                    polishId={polish.id}
                    stashItem={stashMap[polish.id]}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No polishes added yet for this brand.</p>
      )}
    </div>
  )
}
