'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { PolishCard } from '@/components/polish/PolishCard'
import { rateStashItem } from '@/lib/actions/stash.actions'
import type { StashItemWithPolish } from '@/lib/types/app.types'

interface StashPolishCardProps {
  item: StashItemWithPolish
}

export function StashPolishCard({ item }: StashPolishCardProps) {
  const [rating, setRating] = useState<number | null>(item.rating)
  const [hovered, setHovered] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const displayed = hovered ?? rating ?? 0

  function handleRate(star: number) {
    const newRating = star === rating ? null : star  // click same star to clear
    setRating(newRating)
    startTransition(async () => {
      await rateStashItem(item.id, newRating)
    })
  }

  return (
    <div className="flex flex-col">
      <PolishCard polish={item.polish} showDupeCount />
      <div
        className="flex items-center justify-center gap-0.5 py-1.5"
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
              className={`h-3.5 w-3.5 transition-colors ${
                star <= displayed
                  ? 'fill-primary stroke-primary'
                  : 'fill-transparent stroke-muted-foreground/40'
              }`}
            />
          </button>
        ))}
        {rating && (
          <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">{rating}/5</span>
        )}
      </div>
    </div>
  )
}
