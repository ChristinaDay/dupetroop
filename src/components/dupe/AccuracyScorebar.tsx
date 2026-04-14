import { scoreBarColor, formatScore } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface AccuracyScorebarProps {
  label: string
  score: number | null
  count?: number
  className?: string
}

const MIN_RATINGS_FOR_DISPLAY = 1

export function AccuracyScorebar({
  label,
  score,
  count = 0,
  className,
}: AccuracyScorebarProps) {
  const hasScore = score !== null && count >= MIN_RATINGS_FOR_DISPLAY
  const percent = hasScore ? Math.round((score / 5) * 100) : 0

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{label}</span>
        {hasScore ? (
          <span className="font-bold tabular-nums">
            {formatScore(score)}
            <span className="text-muted-foreground font-normal text-xs"> / 5</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">No ratings yet</span>
        )}
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        {hasScore && (
          <div
            className={cn('h-full rounded-full transition-all', scoreBarColor(score))}
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        )}
      </div>
    </div>
  )
}
