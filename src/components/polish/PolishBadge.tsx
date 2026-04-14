import { Badge } from '@/components/ui/badge'
import { finishLabel } from '@/lib/utils/format'
import type { FinishCategory } from '@/lib/types/app.types'

interface PolishBadgeProps {
  finish: FinishCategory
  className?: string
}

// Map finishes to visual variants
const finishVariant = (finish: FinishCategory) => {
  const vivid = ['holo', 'multichrome', 'duochrome', 'glitter', 'flakies']
  if (vivid.includes(finish)) return 'default' as const
  return 'secondary' as const
}

export function PolishBadge({ finish, className }: PolishBadgeProps) {
  return (
    <Badge variant={finishVariant(finish)} className={className}>
      {finishLabel(finish)}
    </Badge>
  )
}
