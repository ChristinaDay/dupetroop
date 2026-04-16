import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getDupeById, getRelatedDupes } from '@/lib/queries/dupes'
import { getOpinionsForDupe, getUserOpinionForDupe } from '@/lib/queries/opinions'
import { createClient } from '@/lib/supabase/server'
import { DupePolishColumn } from '@/components/dupe/DupePolishColumn'
import { DupeCard } from '@/components/dupe/DupeCard'
import { OpinionCard } from '@/components/opinion/OpinionCard'
import { CollapsibleOpinionForm } from '@/components/opinion/CollapsibleOpinionForm'
import { Button } from '@/components/ui/button'
import { formatScore } from '@/lib/utils/format'
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

function ScorePill({ label, score }: { label: string; score: number | null }) {
  const color = score === null
    ? 'text-muted-foreground'
    : score >= 4
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 3
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn('text-xl font-black tabular-nums', color)}>
        {score !== null ? formatScore(score) : '—'}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</span>
    </div>
  )
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

  const relatedDupes = await getRelatedDupes(dupeId, dupe.polish_a_id, dupe.polish_b_id, 6)

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

      {/* Split gallery hero */}
      <div className="grid grid-cols-2 gap-4 sm:gap-8 mb-10">
        <DupePolishColumn polish={a} role="original" />
        <DupePolishColumn polish={b} role="dupe" />
      </div>

      {/* Lightweight score strip */}
      <div className="border-y border-border py-6 mb-10">
        <div className="flex items-center justify-around">
          <ScorePill label="Color" score={dupe.avg_color_accuracy} />
          <div className="h-8 w-px bg-border" />
          <ScorePill label="Finish" score={dupe.avg_finish_accuracy} />
          <div className="h-8 w-px bg-border" />
          <ScorePill label="Formula" score={dupe.avg_formula_accuracy} />
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-center gap-0.5">
            <span className={cn(
              'text-xl font-black tabular-nums',
              dupe.avg_overall === null ? 'text-muted-foreground' : dupe.avg_overall >= 4 ? 'text-emerald-600 dark:text-emerald-400' : dupe.avg_overall >= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
            )}>
              {dupe.avg_overall !== null ? formatScore(dupe.avg_overall) : '—'}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Overall</span>
          </div>
        </div>
        {dupe.opinion_count > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-3">
            Based on {dupe.opinion_count} {dupe.opinion_count === 1 ? 'opinion' : 'opinions'}
          </p>
        )}
        {dupe.notes && (
          <p className="text-center text-sm italic text-muted-foreground mt-3 max-w-md mx-auto">
            &ldquo;{dupe.notes}&rdquo;
          </p>
        )}
      </div>

      {/* Opinion form */}
      <div className="mb-10">
        {user ? (
          <CollapsibleOpinionForm dupeId={dupeId} existingOpinion={userOpinion} />
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
      <div className="mb-16">
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

      {/* Related dupes */}
      {relatedDupes.length > 0 && (
        <div className="border-t border-border pt-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
            More dupes to explore
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {relatedDupes.map(related => (
              <DupeCard key={related.id} dupe={related} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
