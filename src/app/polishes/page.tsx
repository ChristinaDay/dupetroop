import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getPolishes } from '@/lib/queries/polishes'
import { getBrands } from '@/lib/queries/brands'
import { PolishCard } from '@/components/polish/PolishCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { finishLabel } from '@/lib/utils/format'
import type { FinishCategory, ColorFamily } from '@/lib/types/app.types'

export const metadata: Metadata = {
  title: 'Browse Polishes',
  description: 'Browse thousands of indie nail polishes by brand, finish, and color.',
}

const FINISHES: FinishCategory[] = [
  'cream', 'shimmer', 'glitter', 'flakies', 'duochrome',
  'multichrome', 'holo', 'magnetic', 'jelly', 'tinted', 'matte', 'satin', 'topper',
]

const COLOR_FAMILIES: { value: ColorFamily; label: string }[] = [
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'pink', label: 'Pink' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'multicolor', label: 'Multicolor' },
]

interface PageProps {
  searchParams: Promise<{
    brand?: string
    finish?: string
    color?: string
    q?: string
    sort?: string
    page?: string
  }>
}

export default async function PolishesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filters = {
    brand: params.brand,
    finish: params.finish as FinishCategory | undefined,
    color: params.color as ColorFamily | undefined,
    q: params.q,
    sort: params.sort as 'newest' | 'most_dupes' | 'name_asc' | undefined,
    page: params.page ? parseInt(params.page) : 1,
  }

  const [{ polishes, total }, brands] = await Promise.all([
    getPolishes(filters),
    getBrands(),
  ])

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { ...params, ...overrides }
    Object.entries(merged).forEach(([k, v]) => {
      if (v) p.set(k, v)
    })
    return `/polishes?${p.toString()}`
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Polishes</h1>
          <p className="text-muted-foreground mt-1">{total.toLocaleString()} polishes in the database</p>
        </div>
        <Link
          href="/polishes/submit"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Submit polish
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="lg:w-56 flex-shrink-0 space-y-6">
          {/* Search */}
          <div>
            <form method="get" action="/polishes">
              <input
                name="q"
                defaultValue={params.q}
                placeholder="Search polishes…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {params.brand && <input type="hidden" name="brand" value={params.brand} />}
              {params.finish && <input type="hidden" name="finish" value={params.finish} />}
              {params.color && <input type="hidden" name="color" value={params.color} />}
            </form>
          </div>

          {/* Sort */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Sort</p>
            <div className="flex flex-col gap-1">
              {[
                { value: 'newest', label: 'Newest' },
                { value: 'most_dupes', label: 'Most dupes' },
                { value: 'name_asc', label: 'A–Z' },
              ].map(s => (
                <Link
                  key={s.value}
                  href={buildUrl({ sort: s.value, page: '1' })}
                  className={`text-sm px-2 py-1 rounded hover:bg-accent transition-colors ${
                    (params.sort ?? 'newest') === s.value ? 'font-semibold text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Finish filter */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Finish</p>
            <div className="flex flex-col gap-1">
              {params.finish && (
                <Link href={buildUrl({ finish: undefined, page: '1' })}
                  className="text-xs text-muted-foreground hover:text-primary mb-1">
                  ✕ Clear finish
                </Link>
              )}
              {FINISHES.map(f => (
                <Link
                  key={f}
                  href={buildUrl({ finish: f, page: '1' })}
                  className={`text-sm px-2 py-1 rounded hover:bg-accent transition-colors ${
                    params.finish === f ? 'font-semibold text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {finishLabel(f)}
                </Link>
              ))}
            </div>
          </div>

          {/* Color filter */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Color</p>
            {params.color && (
              <Link href={buildUrl({ color: undefined, page: '1' })}
                className="text-xs text-muted-foreground hover:text-primary mb-1 block">
                ✕ Clear color
              </Link>
            )}
            <div className="flex flex-wrap gap-1.5">
              {COLOR_FAMILIES.map(c => (
                <Link key={c.value} href={buildUrl({ color: c.value, page: '1' })}>
                  <Badge
                    variant={params.color === c.value ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                  >
                    {c.label}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>

          {/* Brand filter */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Brand</p>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
              {params.brand && (
                <Link href={buildUrl({ brand: undefined, page: '1' })}
                  className="text-xs text-muted-foreground hover:text-primary mb-1">
                  ✕ Clear brand
                </Link>
              )}
              {brands.map(brand => (
                <Link
                  key={brand.id}
                  href={buildUrl({ brand: brand.slug, page: '1' })}
                  className={`text-sm px-2 py-1 rounded hover:bg-accent transition-colors truncate ${
                    params.brand === brand.slug ? 'font-semibold text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {brand.name}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <Suspense fallback={<PolishGridSkeleton />}>
            {polishes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {polishes.map(polish => (
                  <PolishCard key={polish.id} polish={polish} showDupeCount />
                ))}
              </div>
            ) : (
              <div className="py-24 text-center text-muted-foreground">
                <p className="text-lg font-semibold">No polishes found</p>
                <p className="text-sm mt-1">Try adjusting your filters.</p>
              </div>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function PolishGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  )
}
