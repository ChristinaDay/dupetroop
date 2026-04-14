import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink, ArrowLeft, ShoppingBag } from 'lucide-react'
import { getLookById } from '@/lib/queries/looks'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { SourceBadge } from '@/components/look/LookCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/utils/format'
import type { ComponentRole } from '@/lib/types/app.types'

interface PageProps {
  params: Promise<{ lookId: string }>
}

const ROLE_LABELS: Record<ComponentRole, string> = {
  base: 'Base',
  topper: 'Topper',
  glitter_topper: 'Glitter Topper',
  accent: 'Accent',
  other: 'Other',
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lookId } = await params
  const look = await getLookById(lookId)
  if (!look) return {}
  return {
    title: look.name,
    description: look.description ?? `A nail polish combination recipe on DupeTroop.`,
  }
}

export default async function LookDetailPage({ params }: PageProps) {
  const { lookId } = await params
  const look = await getLookById(lookId)
  if (!look) notFound()

  const hasBudgetPath = look.components.some(c => c.best_dupe !== null)

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Back link */}
      <Link
        href="/looks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        All recipes
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <SourceBadge source={look.source_type} />
          {look.source_url && (
            <a
              href={look.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View original post
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <h1 className="text-3xl font-black tracking-tight">{look.name}</h1>
        {look.description && (
          <p className="mt-3 text-muted-foreground leading-relaxed">{look.description}</p>
        )}
      </div>

      {/* Target polish */}
      {look.target_polish && (
        <div className="mb-8 rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            The Inspiration
          </p>
          <div className="flex items-center gap-4">
            <PolishSwatch
              hexColor={look.target_polish.hex_color}
              hexSecondary={look.target_polish.hex_secondary}
              imageUrl={look.target_polish.images?.[0] ?? null}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                {look.target_polish.brand.name}
              </p>
              <Link
                href={`/polishes/${look.target_polish.brand.slug}/${look.target_polish.slug}`}
                className="text-lg font-bold hover:text-primary transition-colors"
              >
                {look.target_polish.name}
              </Link>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <PolishBadge finish={look.target_polish.finish_category} />
                {look.target_polish.is_discontinued && (
                  <Badge variant="outline" className="text-rose-500 border-rose-300">
                    Discontinued
                  </Badge>
                )}
                {look.target_polish.msrp_usd && (
                  <span className="text-sm font-semibold">
                    {formatPrice(look.target_polish.msrp_usd)}
                  </span>
                )}
              </div>
            </div>
            {look.target_polish.product_url && (
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <a
                  href={look.target_polish.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Shop
                </a>
              </Button>
            )}
          </div>
          {hasBudgetPath && (
            <p className="mt-3 text-xs text-muted-foreground">
              Can&apos;t find it? Scroll down — the recipe below includes budget alternatives for each step.
            </p>
          )}
        </div>
      )}

      {/* Recipe steps */}
      {look.components.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
            The Recipe
          </p>
          <div className="flex flex-col gap-4">
            {look.components.map((comp, idx) => (
              <div key={comp.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Step header */}
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
                  <span className="text-xs font-bold text-muted-foreground">
                    Step {idx + 1}
                  </span>
                  <Badge variant="outline" className="text-[10px] py-0">
                    {ROLE_LABELS[comp.role]}
                  </Badge>
                </div>

                {/* Primary polish */}
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    <PolishSwatch
                      hexColor={comp.polish.hex_color}
                      hexSecondary={comp.polish.hex_secondary}
                      imageUrl={comp.polish.images?.[0] ?? null}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{comp.polish.brand.name}</p>
                      <Link
                        href={`/polishes/${comp.polish.brand.slug}/${comp.polish.slug}`}
                        className="font-bold hover:text-primary transition-colors"
                      >
                        {comp.polish.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <PolishBadge finish={comp.polish.finish_category} />
                        {comp.polish.msrp_usd && (
                          <span className="text-sm font-semibold">
                            {formatPrice(comp.polish.msrp_usd)}
                          </span>
                        )}
                      </div>
                      {comp.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 italic">
                          {comp.notes}
                        </p>
                      )}
                    </div>
                    {comp.polish.product_url && (
                      <Button asChild variant="outline" size="sm" className="shrink-0">
                        <a
                          href={comp.polish.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          Shop
                        </a>
                      </Button>
                    )}
                  </div>

                  {/* Budget alternative */}
                  {comp.best_dupe && (
                    <div className="mt-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-2">
                        Budget Alternative
                      </p>
                      <div className="flex items-center gap-3">
                        <PolishSwatch
                          hexColor={comp.best_dupe.hex_color}
                          hexSecondary={comp.best_dupe.hex_secondary}
                          imageUrl={comp.best_dupe.images?.[0] ?? null}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-muted-foreground">
                            {comp.best_dupe.brand.name}
                          </p>
                          <Link
                            href={`/polishes/${comp.best_dupe.brand.slug}/${comp.best_dupe.slug}`}
                            className="text-sm font-bold hover:text-primary transition-colors"
                          >
                            {comp.best_dupe.name}
                          </Link>
                          {comp.best_dupe.msrp_usd && comp.polish.msrp_usd && (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
                              {formatPrice(comp.best_dupe.msrp_usd)}{' '}
                              <span className="text-muted-foreground font-normal">
                                vs {formatPrice(comp.polish.msrp_usd)}
                              </span>
                            </p>
                          )}
                        </div>
                        <Link
                          href={`/polishes/${comp.best_dupe.brand.slug}/${comp.best_dupe.slug}`}
                          className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer links */}
      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        {look.target_polish && (
          <Button asChild variant="outline">
            <Link href={`/polishes/${look.target_polish.brand.slug}/${look.target_polish.slug}`}>
              View {look.target_polish.name} →
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href="/looks">Browse all recipes</Link>
        </Button>
      </div>
    </div>
  )
}
