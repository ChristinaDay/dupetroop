import Link from 'next/link'
import { ArrowRight, Flame, Sparkles, TrendingUp, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DupeCard } from '@/components/dupe/DupeCard'
import { PolishCard } from '@/components/polish/PolishCard'
import { TrendingPolishCard } from '@/components/polish/TrendingPolishCard'
import { StashIconButton } from '@/components/stash/StashIconButton'
import { getFeaturedDupes, getRecentDupes } from '@/lib/queries/dupes'
import { getPolishes, getFeaturedPolishes } from '@/lib/queries/polishes'
import { getUserStashMap } from '@/lib/queries/stash'
import { createClient } from '@/lib/supabase/server'
import { finishLabel } from '@/lib/utils/format'
import type { FinishCategory, StashStatus } from '@/lib/types/app.types'
import { HeroSearch } from '@/components/search/HeroSearch'

const FINISH_TILES: { finish: FinishCategory; emoji: string }[] = [
  { finish: 'holo', emoji: '🌈' },
  { finish: 'multichrome', emoji: '✨' },
  { finish: 'glitter', emoji: '💎' },
  { finish: 'duochrome', emoji: '🔮' },
  { finish: 'flakies', emoji: '🌸' },
  { finish: 'cream', emoji: '🍦' },
  { finish: 'shimmer', emoji: '⭐' },
  { finish: 'magnetic', emoji: '🧲' },
]

const COLOR_FAMILIES: { color: string; hex: string; label: string }[] = [
  { color: 'red', hex: '#dc2626', label: 'Red' },
  { color: 'orange', hex: '#ea580c', label: 'Orange' },
  { color: 'yellow', hex: '#ca8a04', label: 'Yellow' },
  { color: 'green', hex: '#16a34a', label: 'Green' },
  { color: 'blue', hex: '#2563eb', label: 'Blue' },
  { color: 'purple', hex: '#9333ea', label: 'Purple' },
  { color: 'pink', hex: '#db2777', label: 'Pink' },
  { color: 'neutral', hex: '#a8a29e', label: 'Neutral' },
  { color: 'white', hex: '#f5f5f4', label: 'White' },
  { color: 'black', hex: '#1c1917', label: 'Black' },
  { color: 'multicolor', hex: 'linear-gradient(135deg, #dc2626 0%, #9333ea 40%, #2563eb 70%, #16a34a 100%)', label: 'Multi' },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [featuredPolishes, featuredDupes, recentDupes, newPolishes, stashMap] = await Promise.all([
    getFeaturedPolishes(6).catch(() => []),
    getFeaturedDupes(6).catch(() => []),
    getRecentDupes(4).catch(() => []),
    getPolishes({ sort: 'newest' }).then(r => r.polishes.slice(0, 4)).catch(() => []),
    user ? getUserStashMap(user.id) : Promise.resolve({} as Record<string, { id: string; status: StashStatus }>),
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
            <p className="text-lg text-muted-foreground mb-6 max-w-lg">
              Navigate the matrix of options around a look you want — single-bottle swaps,
              layering recipes, and what you can make with what you already own.
            </p>
            <div className="mb-6">
              <HeroSearch />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="font-bold">
                <Link href="/dupes">Browse Dupes</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/polishes">Browse Polishes</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Now */}
      {featuredPolishes.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-2 mb-6">
              <Flame className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-black tracking-tight">Trending Now</h2>
              <div className="hidden sm:flex items-center gap-1.5 ml-2">
                {(['reddit', 'instagram', 'tiktok'] as const).map(src => (
                  <span
                    key={src}
                    className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-border"
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredPolishes.map(polish => (
                <TrendingPolishCard key={polish.id} polish={polish} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Browse */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">

          {/* Finish tiles */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Browse by finish
            </h2>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {FINISH_TILES.map(({ finish, emoji }) => (
                <Link
                  key={finish}
                  href={`/polishes?finish=${finish}`}
                  className="shrink-0 flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card w-24 py-4 hover:border-primary hover:text-primary transition-colors"
                >
                  <span className="text-2xl leading-none">{emoji}</span>
                  <span className="text-xs font-semibold">{finishLabel(finish)}</span>
                </Link>
              ))}
              <Link
                href="/polishes"
                className="shrink-0 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card w-24 py-4 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <span className="text-xl leading-none font-light">→</span>
                <span className="text-xs font-semibold">All</span>
              </Link>
            </div>
          </div>

          {/* Color dots */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Browse by color
            </h2>
            <div className="flex gap-5 overflow-x-auto no-scrollbar pb-1">
              {COLOR_FAMILIES.map(({ color, hex, label }) => (
                <Link
                  key={color}
                  href={`/polishes?color=${color}`}
                  className="shrink-0 flex flex-col items-center gap-1.5 group"
                >
                  <span
                    className="h-9 w-9 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-background group-hover:ring-primary transition-all shadow-sm border border-border/40"
                    style={{ background: hex }}
                  />
                  <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {newPolishes.map(polish => (
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
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 text-center">
          <Users className="h-8 w-8 mx-auto mb-4 opacity-80" />
          <h2 className="text-3xl font-black mb-3">Track what you own.</h2>
          <p className="text-primary-foreground/80 mb-6 max-w-md mx-auto">
            Add polishes to your stash and DupeTroop will tell you which looks you can make right now — and which ones are just one purchase away.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild variant="secondary" size="lg" className="font-bold">
              <Link href="/signup">Create a free account</Link>
            </Button>
            <Button asChild size="lg" className="bg-transparent border border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10">
              <Link href="/stash">View your stash</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
