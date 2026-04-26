import type { Metadata } from 'next'
import Link from 'next/link'
import { getDupes } from '@/lib/queries/dupes'
import { getLooksForBrowse } from '@/lib/queries/looks'
import { DupeCard } from '@/components/dupe/DupeCard'
import { LookCard } from '@/components/look/LookCard'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Browse Dupes',
  description: 'Community-rated nail polish dupes. Find accurate alternatives for your favorite indie polishes.',
}

interface PageProps {
  searchParams: Promise<{
    sort?: string
    page?: string
  }>
}

export default async function DupesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const sort = (params.sort ?? 'newest') as 'newest' | 'top_rated' | 'most_opinions'
  const page = params.page ? parseInt(params.page) : 1

  const [{ dupes, total }, { looks, total: looksTotal }] = await Promise.all([
    getDupes({ sort, page }),
    getLooksForBrowse(18),
  ])

  const PAGE_SIZE = 20
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const buildUrl = (p: number, s?: string) => {
    const sp = new URLSearchParams()
    sp.set('sort', s ?? sort)
    if (p > 1) sp.set('page', String(p))
    return `/dupes?${sp.toString()}`
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Dupes</h1>
          <p className="text-muted-foreground mt-1">{total.toLocaleString()} community-rated dupes</p>
        </div>
        <Button asChild>
          <Link href="/dupes/submit">+ Submit a Dupe</Link>
        </Button>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-2 mb-6 border-b border-border pb-4">
        {[
          { value: 'newest', label: 'Newest' },
          { value: 'top_rated', label: 'Top rated' },
          { value: 'most_opinions', label: 'Most opinions' },
        ].map(s => (
          <Link
            key={s.value}
            href={buildUrl(1, s.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              sort === s.value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {dupes.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dupes.map(dupe => (
              <DupeCard key={dupe.id} dupe={dupe} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {page > 1 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildUrl(page - 1)}>← Prev</Link>
                </Button>
              )}
              <span className="self-center text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildUrl(page + 1)}>Next →</Link>
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="py-24 text-center">
          <p className="text-lg font-semibold text-muted-foreground">No dupes yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Be the first to submit one!</p>
          <Button asChild className="mt-4">
            <Link href="/dupes/submit">Submit a dupe</Link>
          </Button>
        </div>
      )}

      {/* Swaps section */}
      {looksTotal > 0 && (
        <div className="mt-16">
          <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Multi-polish Swaps</h2>
              <p className="text-muted-foreground text-sm mt-0.5">{looksTotal.toLocaleString()} layering combinations</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {looks.map(look => (
              <LookCard key={look.id} look={look} components={look.components} />
            ))}
          </div>
          {looksTotal > 18 && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              Showing 18 of {looksTotal.toLocaleString()} swaps
            </p>
          )}
        </div>
      )}
    </div>
  )
}
