import { swatchStyle } from '@/lib/utils/color'
import { cn } from '@/lib/utils'

interface PolishSwatchProps {
  hexColor: string | null
  hexSecondary?: string | null
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
  xl: 'h-32 w-32',
}

export function PolishSwatch({
  hexColor,
  hexSecondary,
  imageUrl,
  size = 'md',
  className,
}: PolishSwatchProps) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt="Polish swatch"
        className={cn(
          'rounded-full object-cover ring-2 ring-border shadow-sm',
          sizeClasses[size],
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full ring-2 ring-border shadow-sm flex-shrink-0',
        sizeClasses[size],
        className
      )}
      style={swatchStyle(hexColor, hexSecondary) as React.CSSProperties}
      aria-hidden="true"
    />
  )
}
