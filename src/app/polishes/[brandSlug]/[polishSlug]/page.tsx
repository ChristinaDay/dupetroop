import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { getPolishBySlug } from '@/lib/queries/polishes'
import { getDupesForPolish } from '@/lib/queries/dupes'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { DupeCard } from '@/components/dupe/DupeCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils/format'

interface PageProps {
  params: Promise<{ brandSlug: string; polishSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { brandSlug, polishSlug } = await params
  const polish = await getPolishBySlug(brandSlug, polishSlug)
  if (!polish) return {}
  return {
    title: `${polish.name} by ${polish.brand.name}`,
    description: `Find dupes for ${polish.name} by ${polish.brand.name} and see community ratings.`,
  }
}

export default async function PolishDetailPage({ params }: PageProps) {
  const { brandSlug, polishSlug } = await params
  const [polish, dupes] = await Promise.all([
    getPolishBySlug(brandSlug, polishSlug),
    getPolishBySlug(brandSlug, polishSlug).then(p =>
      p ? getDupesForPolish(p.id) : []
    ),
  ])

  if (!polish) notFound()

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
        <Link href="/polishes" className="hover:text-foreground">Polishes</Link>
        <span>/</span>
        <Link href={`/brands/${polish.brand.slug}`} className="hover:text-foreground">
          {polish.brand.name}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{polish.name}</span>
      </nav>

      {/* Polish header */}
      <div className="flex items-start gap-6 mb-10">
        <div className="flex-shrink-0">
          <PolishSwatch
            hexColor={polish.hex_color}
            hexSecondary={polish.hex_secondary}
            imageUrl={polish.images?.[0] ?? null}
            size="xl"
          />
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/brands/${polish.brand.slug}`}>
            <p className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">
              {polish.brand.name}
            </p>
          </Link>
          <h1 className="text-3xl font-black tracking-tight mt-1">{polish.name}</h1>
          {polish.collection && (
            <p className="text-sm text-muted-foreground mt-0.5">{polish.collection.name}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <PolishBadge finish={polish.finish_category} />
            {polish.is_discontinued && <Badge variant="outline">Discontinued</Badge>}
            {polish.is_limited && <Badge variant="outline" className="text-amber-600 border-amber-600">Limited Edition</Badge>}
            {polish.is_topper && <Badge variant="outline">Topper</Badge>}
          </div>
          <div className="flex items-center gap-4 mt-4">
            {polish.msrp_usd && (
              <span className="text-lg font-bold">{formatPrice(polish.msrp_usd)}</span>
            )}
            {polish.product_url && (
              <Button asChild variant="outline" size="sm">
                <a href={polish.product_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Shop
                </a>
              </Button>
            )}
          </div>
          {polish.finish_notes && (
            <p className="text-sm text-muted-foreground mt-3 italic">{polish.finish_notes}</p>
          )}
          {polish.description && (
            <p className="text-sm mt-3">{polish.description}</p>
          )}
        </div>
      </div>

      {/* Image gallery */}
      {polish.images && polish.images.length > 1 && (
        <div className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Swatches</h2>
          <div className="flex gap-3 flex-wrap">
            {polish.images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={img}
                alt={`Swatch ${i + 1}`}
                className="h-24 w-24 object-cover rounded-xl border border-border"
              />
            ))}
          </div>
        </div>
      )}

      {/* Dupes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black tracking-tight">
            Dupes{dupes.length > 0 ? ` (${dupes.length})` : ''}
          </h2>
          <Button asChild size="sm">
            <Link href={`/dupes/submit?a=${polish.id}`}>+ Submit a dupe</Link>
          </Button>
        </div>

        {dupes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dupes.map(dupe => (
              <DupeCard key={dupe.id} dupe={dupe} />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-xl py-16 text-center">
            <p className="text-muted-foreground font-medium">No dupes yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Know one? Help the community!</p>
            <Button asChild className="mt-4" size="sm">
              <Link href={`/dupes/submit?a=${polish.id}`}>Submit a dupe</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
