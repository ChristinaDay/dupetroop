import { formatPrice } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface PolishPriceProps {
  price: number | null
  className?: string
}

export function PolishPrice({ price, className }: PolishPriceProps) {
  if (!price) return null
  return (
    <span className={cn('tabular-nums', className)}>
      {formatPrice(price)}{' '}
      <span className="font-normal opacity-60 text-[0.8em]">retail</span>
    </span>
  )
}
