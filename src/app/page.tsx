import Link from 'next/link'
import { ArrowRight, Flame, TrendingUp, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DupeCard } from '@/components/dupe/DupeCard'
import { PolishCard } from '@/components/polish/PolishCard'
import { TrendingPolishCard } from '@/components/polish/TrendingPolishCard'
import { StashIconButton } from '@/components/stash/StashIconButton'
import { getFeaturedDupes, getRecentDupes } from '@/lib/queries/dupes'
import { getPolishes, getFeaturedPolishes } from '@/lib/queries/polishes'
import { getUserStashMap } from '@/lib/queries/stash'
import { createClient } from '@/lib/supabase/server'
import type { StashStatus } from '@/lib/types/app.types'
import { HeroSearch } from '@/components/search/HeroSearch'


export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [featuredPolishes, featuredDupes, recentDupes, newPolishes, stashMap] = await Promise.all([
    getFeaturedPolishes(6).catch(() => []),
    getFeaturedDupes(6).catch(() => []),
    getRecentDupes(4).catch(() => []),
    getPolishes({ sort: 'newest', discontinued: false }).then(r => r.polishes.slice(0, 4)).catch(() => []),
    user ? getUserStashMap(user.id) : Promise.resolve({} as Record<string, { id: string; status: StashStatus }>),
  ])

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="border-b border-border hero-bg overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="flex flex-col gap-5">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Nail polish dupe tracker
            </p>
            <h1 className="font-display font-black uppercase leading-[0.88] tracking-tight text-[clamp(3.5rem,12vw,9rem)]">
              Find your<br />
              <span className="text-primary">perfect</span><br />
              dupe.
            </h1>
            <p className="text-base text-muted-foreground max-w-md leading-relaxed">
              Navigate the full matrix — single-bottle dupes, multi-polish swaps,
              and what you can make with what you already own.
            </p>
            <div className="max-w-md">
              <HeroSearch />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="font-bold uppercase tracking-wide">
                <Link href="/dupes">Browse Dupes</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="font-bold uppercase tracking-wide">
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
            <div className="flex items-center gap-3 mb-6">
              <Flame className="h-5 w-5 text-electric shrink-0" />
              <h2 className="font-display font-black uppercase tracking-tight text-4xl leading-none">Trending Now</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredPolishes.map(polish => (
                <TrendingPolishCard key={polish.id} polish={polish} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured dupes */}
      {featuredDupes.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-primary shrink-0" />
                <h2 className="font-display font-black uppercase tracking-tight text-4xl leading-none">Top-rated dupes</h2>
              </div>
              <div className="flex items-center gap-4">
                <Link href="/dupes/submit" className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                  Know a dupe? Submit one →
                </Link>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dupes?sort=top_rated" className="flex items-center gap-1">
                    See all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
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
              <h2 className="font-display font-black uppercase tracking-tight text-4xl leading-none">Recently added</h2>
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
              <h2 className="font-display font-black uppercase tracking-tight text-4xl leading-none">New polishes</h2>
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
      <section className="bg-foreground text-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] opacity-50 mb-3">Your collection</p>
              <h2 className="font-display font-black uppercase leading-[0.9] text-[clamp(2.5rem,7vw,5rem)] mb-4">
                Know what<br />you can make<br /><span className="text-primary">right now.</span>
              </h2>
              <p className="opacity-70 max-w-sm leading-relaxed">
                Add polishes to your stash and DoopTroop surfaces which looks you can recreate today — and which ones are just one purchase away.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
              <Button asChild size="lg" variant="electric" className="font-bold uppercase tracking-wide">
                <Link href="/signup">Create a free account</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="font-bold uppercase tracking-wide border-background/30 text-background hover:bg-background/10">
                <Link href="/stash">View your stash</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
