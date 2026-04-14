import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getDupeById } from '@/lib/queries/dupes'
import { getOpinionsForDupe, getUserOpinionForDupe } from '@/lib/queries/opinions'
import { createClient } from '@/lib/supabase/server'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { AccuracyScorebar } from '@/components/dupe/AccuracyScorebar'
import { OpinionCard } from '@/components/opinion/OpinionCard'
import { OpinionForm } from '@/components/opinion/OpinionForm'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatPrice, formatScore } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ dupeId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { dupeId } = await params
  const dupe = await getDupeById(dupeId)
  if (!dupe) return {}
  return {
    title: `${dupe.polish_a.name} vs ${dupe.polish_b.name}`,
    description: `Community ratings for the ${dupe.polish_a.name} / ${dupe.polish_b.name} dupe. Color, finish, and formula accuracy scores.`,
  }
}

function overallColor(score: number | null) {
  if (!score) return 'text-muted-foreground'
  if (score >= 4) return 'text-emerald-600'
  if (score >= 3) return 'text-amber-600'
  return 'text-rose-600'
}

export default async function DupeDetailPage({ params }: PageProps) {
  const { dupeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [dupe, opinions, userOpinion] = await Promise.all([
    getDupeById(dupeId),
    getOpinionsForDupe(dupeId, user?.id),
    user ? getUserOpinionForDupe(dupeId, user.id) : null,
  ])

  if (!dupe || dupe.status !== 'approved') notFound()

  const a = dupe.polish_a
  const b = dupe.polish_b

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-8 flex items-center gap-2">
        <Link href="/dupes" className="hover:text-foreground">Dupes</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{a.name} × {b.name}</span>
      </nav>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-6 mb-10">
        {[a, b].map((polish, idx) => (
          <div key={polish.id} className="text-center space-y-3">
            <div className="flex justify-center">
              <PolishSwatch
                hexColor={polish.hex_color}
                hexSecondary={polish.hex_secondary}
                imageUrl={polish.images?.[0] ?? null}
                size="xl"
              />
            </div>
            <div>
              {idx === 0 && (
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Original</span>
              )}
              {idx === 1 && (
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Dupe</span>
              )}
              <Link href={`/brands/${polish.brand.slug}`}>
                <p className="text-sm text-muted-foreground hover:text-primary transition-colors">{polish.brand.name}</p>
              </Link>
              <Link href={`/polishes/${polish.brand.slug}/${polish.slug}`}>
                <h2 className="text-lg font-black hover:text-primary transition-colors">{polish.name}</h2>
              </Link>
              <div className="flex justify-center mt-1">
                <PolishBadge finish={polish.finish_category} />
              </div>
              {polish.msrp_usd && (
                <p className="text-sm text-muted-foreground mt-1">{formatPrice(polish.msrp_usd)}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Aggregate accuracy scores */}
      <div className="border border-border rounded-xl p-6 mb-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Community accuracy</h2>
          <div className="text-center">
            <p className={cn('text-3xl font-black tabular-nums', overallColor(dupe.avg_overall))}>
              {dupe.avg_overall !== null ? formatScore(dupe.avg_overall) : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {dupe.opinion_count} rating{dupe.opinion_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          <AccuracyScorebar label="Color accuracy" score={dupe.avg_color_accuracy} count={dupe.opinion_count} />
          <AccuracyScorebar label="Finish accuracy" score={dupe.avg_finish_accuracy} count={dupe.opinion_count} />
          <AccuracyScorebar label="Formula accuracy" score={dupe.avg_formula_accuracy} count={dupe.opinion_count} />
        </div>
        {dupe.notes && (
          <>
            <Separator />
            <p className="text-sm italic text-muted-foreground">&ldquo;{dupe.notes}&rdquo;</p>
          </>
        )}
      </div>

      {/* Opinion form */}
      <div className="mb-10">
        <h2 className="text-xl font-black mb-4">
          {userOpinion ? 'Your rating' : 'Rate this dupe'}
        </h2>
        {user ? (
          <div className="border border-border rounded-xl p-6">
            <OpinionForm dupeId={dupeId} existingOpinion={userOpinion} />
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground mb-4">Log in to rate this dupe and share your opinion.</p>
            <Button asChild>
              <Link href={`/login?next=/dupes/${dupeId}`}>Log in to rate</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Community opinions */}
      <div>
        <h2 className="text-xl font-black mb-4">
          Community opinions
          {opinions.length > 0 && (
            <span className="text-muted-foreground font-normal text-base ml-2">({opinions.length})</span>
          )}
        </h2>
        {opinions.length > 0 ? (
          <div className="space-y-4">
            {opinions.map(opinion => (
              <OpinionCard
                key={opinion.id}
                opinion={opinion}
                dupeId={dupeId}
                currentUserId={user?.id}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No opinions yet. Be the first!</p>
        )}
      </div>
    </div>
  )
}
