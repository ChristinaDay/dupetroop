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
  const [color, setColor] = useState<number | null>(item.color_rating)
  const [finish, setFinish] = useState<number | null>(item.finish_rating)
  const [formula, setFormula] = useState<number | null>(item.formula_rating)
  const [hovered, setHovered] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasRating = color !== null && finish !== null && formula !== null
  const avg = hasRating ? (color + finish + formula) / 3 : null
  const displayed = hovered ?? (avg !== null ? Math.round(avg) : 0)

  // Clicking a star on the card sets all three dimensions to the same value
  // (quick overall rating). Full breakdown available on the polish detail page.
  function handleRate(star: number) {
    const allSame = star === color && star === finish && star === formula
    const val = allSame ? null : star
    setColor(val)
    setFinish(val)
    setFormula(val)
    startTransition(async () => {
      await rateStashItem(item.id, { color: val, finish: val, formula: val })
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
        {avg !== null && (
          <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">{avg.toFixed(1)}</span>
        )}
      </div>
    </div>
  )
}
