import type { Metadata } from 'next'
import { getLooks } from '@/lib/queries/looks'
import { LookCard } from '@/components/look/LookCard'
import type { LookSourceType } from '@/lib/types/app.types'

export const metadata: Metadata = {
  title: 'Combination Recipes',
  description:
    'Community-discovered nail polish combination recipes — layer two or more polishes to emulate a sold-out or hard-to-find look.',
}

const SOURCE_FILTERS: { value: LookSourceType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'admin', label: 'Staff Picks' },
]

interface PageProps {
  searchParams: Promise<{ source?: string }>
}

export default async function LooksPage({ searchParams }: PageProps) {
  const { source } = await searchParams
  const looks = await getLooks(40)

  const filtered =
    source && source !== 'all'
      ? looks.filter(l => l.source_type === source)
      : looks

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">Combination Recipes</h1>
        <p className="mt-2 text-muted-foreground max-w-xl">
          Layer two or more polishes to achieve a specific look — including budget-friendly
          alternatives for each step.
        </p>
      </div>

      {/* Source filter chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        {SOURCE_FILTERS.map(f => {
          const active = (source ?? 'all') === f.value
          return (
            <a
              key={f.value}
              href={f.value === 'all' ? '/looks' : `/looks?source=${f.value}`}
              className={[
                'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary hover:text-primary',
              ].join(' ')}
            >
              {f.label}
            </a>
          )
        })}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(look => (
            <LookCard key={look.id} look={look} />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-xl py-20 text-center">
          <p className="text-muted-foreground font-medium">No recipes yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Check back soon — the community is always discovering new combinations.
          </p>
        </div>
      )}
    </div>
  )
}
