'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  onChange: (value: number) => void
  label?: string
  disabled?: boolean
}

export function StarRating({ value, onChange, label, disabled }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const displayValue = hovered ?? value

  return (
    <div className="space-y-1">
      {label && <p className="text-sm font-semibold">{label}</p>}
      <div className="flex gap-1" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            className={cn(
              'transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                star <= displayValue
                  ? 'fill-primary stroke-primary'
                  : 'fill-transparent stroke-muted-foreground'
              )}
            />
          </button>
        ))}
        <span className="ml-2 self-center text-sm text-muted-foreground tabular-nums">
          {value > 0 ? `${value}/5` : 'tap to rate'}
        </span>
      </div>
    </div>
  )
}
