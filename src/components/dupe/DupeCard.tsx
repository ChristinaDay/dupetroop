import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { AccuracyScorebar } from './AccuracyScorebar'
import { formatScore } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { DupeWithPolishes } from '@/lib/types/app.types'

interface DupeCardProps {
  dupe: DupeWithPolishes
}

function overallPill(score: number | null) {
  if (score === null) return 'bg-muted text-muted-foreground'
  if (score >= 4) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
  if (score >= 3) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
  return 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
}

export function DupeCard({ dupe }: DupeCardProps) {
  const a = dupe.polish_a
  const b = dupe.polish_b

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <Link href={`/dupes/${dupe.id}`} className="block space-y-3">
          {/* Both polishes side by side */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <PolishSwatch
                hexColor={a.hex_color}
                hexSecondary={a.hex_secondary}
                imageUrl={a.images?.[0] ?? null}
                size="md"
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{a.brand.name}</p>
                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                  {a.name}
                </p>
              </div>
            </div>

            {/* Overall score pill */}
            <div
              className={cn(
                'flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold',
                overallPill(dupe.avg_overall)
              )}
            >
              {dupe.avg_overall !== null ? formatScore(dupe.avg_overall) : '—'}
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <div className="min-w-0 text-right">
                <p className="text-xs text-muted-foreground truncate">{b.brand.name}</p>
                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                  {b.name}
                </p>
              </div>
              <PolishSwatch
                hexColor={b.hex_color}
                hexSecondary={b.hex_secondary}
                imageUrl={b.images?.[0] ?? null}
                size="md"
              />
            </div>
          </div>

          {/* Score bars */}
          <div className="space-y-1.5 pt-1">
            <AccuracyScorebar label="Color" score={dupe.avg_color_accuracy} count={dupe.opinion_count} />
            <AccuracyScorebar label="Finish" score={dupe.avg_finish_accuracy} count={dupe.opinion_count} />
            <AccuracyScorebar label="Formula" score={dupe.avg_formula_accuracy} count={dupe.opinion_count} />
          </div>

          <p className="text-xs text-muted-foreground text-right">
            {dupe.opinion_count} opinion{dupe.opinion_count !== 1 ? 's' : ''}
          </p>
        </Link>
      </CardContent>
    </Card>
  )
}
