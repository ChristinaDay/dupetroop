import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { getPolishBySlug, getPolishRatings } from '@/lib/queries/polishes'
import { getDupesForPolish } from '@/lib/queries/dupes'
import { getLooksWithComponentsForPolish } from '@/lib/queries/looks'
import { createClient } from '@/lib/supabase/server'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { DupeCard } from '@/components/dupe/DupeCard'
import { RecipeCard } from '@/components/look/RecipeCard'
import { AddToStashButton } from '@/components/stash/AddToStashButton'
import { InlinePolishRating } from '@/components/stash/InlinePolishRating'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PolishPrice } from '@/components/polish/PolishPrice'

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
  const polish = await getPolishBySlug(brandSlug, polishSlug)
  if (!polish) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if this polish is already in the user's stash
  let stashItemId: string | undefined
  let stashItemStatus: 'owned' | 'wishlist' | 'bookmarked' | 'destashed' | undefined
  let stashColorRating: number | null = null
  let stashFinishRating: number | null = null
  let stashFormulaRating: number | null = null
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data } = await db
      .from('stash_items')
      .select('id, status, color_rating, finish_rating, formula_rating')
      .eq('user_id', user.id)
      .eq('polish_id', polish.id)
      .maybeSingle()
    stashItemId = data?.id
    stashItemStatus = data?.status
    stashColorRating = data?.color_rating ?? null
    stashFinishRating = data?.finish_rating ?? null
    stashFormulaRating = data?.formula_rating ?? null
  }

  const [dupes, looks, ratings] = await Promise.all([
    getDupesForPolish(polish.id),
    getLooksWithComponentsForPolish(polish.id),
    getPolishRatings(polish.id),
  ])

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
        <div className="shrink-0">
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
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <PolishPrice price={polish.msrp_usd} className="text-lg font-bold" />
            {polish.product_url && (
              <Button asChild variant="outline" size="sm">
                <a href={polish.product_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Shop
                </a>
              </Button>
            )}
            {user && (
              <AddToStashButton
                polishId={polish.id}
                stashItemId={stashItemId}
                stashItemStatus={stashItemStatus}
              />
            )}
          </div>
          {user && stashItemId && stashItemStatus === 'owned' && (
            <InlinePolishRating
              stashItemId={stashItemId}
              initialColor={stashColorRating}
              initialFinish={stashFinishRating}
              initialFormula={stashFormulaRating}
            />
          )}
          {polish.finish_notes && (
            <p className="text-sm text-muted-foreground mt-3 italic">{polish.finish_notes}</p>
          )}
          {polish.description && (
            <p className="text-sm mt-3">{polish.description}</p>
          )}
        </div>
      </div>

      {/* Ratings strip */}
      {(ratings.ownerRating || ratings.externalRatings.length > 0 || polish.product_url) && (
        <div className="py-4 border-y border-border mb-8 space-y-3">
          {ratings.ownerRating && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black">{ratings.ownerRating.avg.toFixed(1)}</span>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} className={`h-3 w-3 ${s <= Math.round(ratings.ownerRating!.avg) ? 'fill-primary' : 'fill-muted-foreground/30'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {ratings.ownerRating.count} DoopTroop {ratings.ownerRating.count === 1 ? 'owner' : 'owners'}
                </span>
              </div>
              {(ratings.ownerRating.avgColor != null || ratings.ownerRating.avgFinish != null || ratings.ownerRating.avgFormula != null) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 pl-0.5">
                  {[
                    { label: 'Color', val: ratings.ownerRating.avgColor },
                    { label: 'Finish', val: ratings.ownerRating.avgFinish },
                    { label: 'Formula', val: ratings.ownerRating.avgFormula },
                  ].map(({ label, val }) => val != null && (
                    <span key={label} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{val.toFixed(1)}</span> {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {ratings.externalRatings.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {ratings.externalRatings.map((ext) => (
            <div key={ext.id} className="flex items-center gap-1.5">
              <span className="text-sm font-black">{Number(ext.rating).toFixed(1)}</span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <svg key={s} className={`h-3 w-3 ${s <= Math.round(Number(ext.rating)) ? 'fill-amber-400' : 'fill-muted-foreground/30'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                ))}
              </div>
              {ext.source_url ? (
                <a href={ext.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                  on {ext.source_label}{ext.review_count ? ` (${ext.review_count.toLocaleString()})` : ''}
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">
                  on {ext.source_label}{ext.review_count ? ` (${ext.review_count.toLocaleString()})` : ''}
                </span>
              )}
            </div>
          ))}
            </div>
          )}
          {polish.product_url && ratings.externalRatings.length === 0 && (
            <a
              href={polish.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors w-fit"
            >
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              on {polish.brand.name}
            </a>
          )}
        </div>
      )}

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

      {/* Ways to get this look */}
      <div className="space-y-10">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight">Ways to get this look</h2>
        </div>

        {/* Polish swaps */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold">Polish swaps</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Single-bottle alternatives rated by the community</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/dupes/submit?a=${polish.id}`}>+ Submit a swap</Link>
            </Button>
          </div>
          {dupes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dupes.map(dupe => (
                <DupeCard key={dupe.id} dupe={dupe} />
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-xl py-10 text-center">
              <p className="text-muted-foreground font-medium">No swaps yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Know a polish that looks just like this one?</p>
              <Button asChild className="mt-4" size="sm">
                <Link href={`/dupes/submit?a=${polish.id}`}>Submit a swap</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Combination recipes */}
        <div>
          <div className="mb-4">
            <h3 className="text-base font-bold">Combination recipes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Multi-polish layering techniques that recreate this look</p>
          </div>
          {looks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {looks.map(look => (
                <RecipeCard key={look.id} look={look} />
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-xl py-10 text-center">
              <p className="text-muted-foreground font-medium">No recipes yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Know a combination that recreates this effect?</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
