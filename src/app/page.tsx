import Link from 'next/link'
import { ArrowRight, Sparkles, TrendingUp, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DupeCard } from '@/components/dupe/DupeCard'
import { PolishCard } from '@/components/polish/PolishCard'
import { getFeaturedDupes, getRecentDupes } from '@/lib/queries/dupes'
import { getPolishes } from '@/lib/queries/polishes'
import { finishLabel } from '@/lib/utils/format'
import type { FinishCategory } from '@/lib/types/app.types'

const FINISH_ICONS: { finish: FinishCategory; emoji: string }[] = [
  { finish: 'holo', emoji: '🌈' },
  { finish: 'multichrome', emoji: '✨' },
  { finish: 'glitter', emoji: '💎' },
  { finish: 'duochrome', emoji: '🔮' },
  { finish: 'flakies', emoji: '🌸' },
  { finish: 'cream', emoji: '🍦' },
  { finish: 'shimmer', emoji: '⭐' },
  { finish: 'magnetic', emoji: '🧲' },
]

export default async function HomePage() {
  const [featuredDupes, recentDupes, newPolishes] = await Promise.all([
    getFeaturedDupes(6).catch(() => []),
    getRecentDupes(4).catch(() => []),
    getPolishes({ sort: 'newest' }).then(r => r.polishes.slice(0, 4)).catch(() => []),
  ])

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-br from-accent to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-primary uppercase tracking-widest">
                Community-powered
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none mb-4">
              Find your perfect{' '}
              <span className="text-primary">nail polish dupe.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Discover which indie nail polishes are truly similar — rated by the community on
              color, finish, and formula accuracy.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="font-bold">
                <Link href="/dupes">Browse Dupes</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/dupes/submit">Submit a Dupe</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Browse by finish */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Browse by finish
          </h2>
          <div className="flex flex-wrap gap-2">
            {FINISH_ICONS.map(({ finish, emoji }) => (
              <Link
                key={finish}
                href={`/polishes?finish=${finish}`}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary transition-colors"
              >
                <span>{emoji}</span>
                {finishLabel(finish)}
              </Link>
            ))}
            <Link
              href="/polishes"
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary transition-colors"
            >
              View all →
            </Link>
          </div>
        </div>
      </section>

      {/* Featured dupes */}
      {featuredDupes.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-black tracking-tight">Top-rated dupes</h2>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dupes?sort=top_rated" className="flex items-center gap-1">
                  See all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredDupes.map(dupe => (
                <DupeCard key={dupe.id} dupe={dupe} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recently added dupes */}
      {recentDupes.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black tracking-tight">Recently added</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dupes" className="flex items-center gap-1">
                  See all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentDupes.map(dupe => (
                <DupeCard key={dupe.id} dupe={dupe} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* New polishes */}
      {newPolishes.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black tracking-tight">New polishes</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/polishes" className="flex items-center gap-1">
                  See all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {newPolishes.map(polish => (
                <PolishCard key={polish.id} polish={polish} showDupeCount />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 text-center">
          <Users className="h-8 w-8 mx-auto mb-4 opacity-80" />
          <h2 className="text-3xl font-black mb-3">Know your dupes?</h2>
          <p className="text-primary-foreground/80 mb-6 max-w-md mx-auto">
            Share your swatches, rate the accuracy, and help the community find the best alternatives.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild variant="secondary" size="lg" className="font-bold">
              <Link href="/dupes/submit">Submit a dupe</Link>
            </Button>
            <Button asChild size="lg" className="bg-transparent border border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10">
              <Link href="/polishes">Browse polishes</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
