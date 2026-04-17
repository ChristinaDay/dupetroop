import { Badge } from '@/components/ui/badge'
import { finishLabel } from '@/lib/utils/format'
import type { FinishCategory } from '@/lib/types/app.types'

interface PolishBadgeProps {
  finish: FinishCategory
  className?: string
}

const ELECTRIC_FINISHES = ['holo', 'multichrome', 'duochrome', 'glitter', 'flakies']

export function PolishBadge({ finish, className }: PolishBadgeProps) {
  if (finish === 'other') return null

  if (ELECTRIC_FINISHES.includes(finish)) {
    return (
      <Badge
        className={`bg-electric/15 text-electric-foreground border-electric/30 hover:bg-electric/20 ${className ?? ''}`}
      >
        {finishLabel(finish)}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className={className}>
      {finishLabel(finish)}
    </Badge>
  )
}
