'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { rateStashItem } from '@/lib/actions/stash.actions'

interface InlinePolishRatingProps {
  stashItemId: string
  initialRating: number | null
}

export function InlinePolishRating({ stashItemId, initialRating }: InlinePolishRatingProps) {
  const [rating, setRating] = useState<number | null>(initialRating)
  const [hovered, setHovered] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const displayed = hovered ?? rating ?? 0

  function handleRate(star: number) {
    const newRating = star === rating ? null : star
    setRating(newRating)
    startTransition(async () => {
      await rateStashItem(stashItemId, newRating)
    })
  }

  return (
    <div className="flex items-center gap-2 mt-4">
      <span className="text-xs text-muted-foreground font-semibold">
        {rating ? 'Your rating' : 'Rate this polish'}
      </span>
      <div
        className="flex gap-0.5"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={isPending}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            className="transition-transform hover:scale-110 focus-visible:outline-none disabled:opacity-50"
          >
            <Star
              className={`h-4 w-4 transition-colors ${
                star <= displayed
                  ? 'fill-primary stroke-primary'
                  : 'fill-transparent stroke-muted-foreground/40'
              }`}
            />
          </button>
        ))}
      </div>
      {rating && (
        <span className="text-xs text-muted-foreground tabular-nums">{rating}/5</span>
      )}
    </div>
  )
}
