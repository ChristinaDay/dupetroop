'use client'

import { useState, useTransition } from 'react'
import { Star, ChevronDown } from 'lucide-react'
import { rateStashItem } from '@/lib/actions/stash.actions'

interface DimensionRatingProps {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  disabled?: boolean
}

function DimensionRating({ label, value, onChange, disabled }: DimensionRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const displayed = hovered ?? value ?? 0

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground w-16">{label}</span>
      <div className="flex gap-0.5" onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange(star === value ? null : star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`${star} star`}
            className="transition-transform hover:scale-110 focus-visible:outline-none disabled:opacity-50"
          >
            <Star
              className={`h-3.5 w-3.5 transition-colors ${
                star <= displayed
                  ? 'fill-primary stroke-primary'
                  : 'fill-transparent stroke-muted-foreground/30'
              }`}
            />
          </button>
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground w-6 text-right tabular-nums">
        {value ? `${value}/5` : ''}
      </span>
    </div>
  )
}

interface InlinePolishRatingProps {
  stashItemId: string
  initialColor: number | null
  initialFinish: number | null
  initialFormula: number | null
}

export function InlinePolishRating({
  stashItemId,
  initialColor,
  initialFinish,
  initialFormula,
}: InlinePolishRatingProps) {
  const [open, setOpen] = useState(false)
  const [color, setColor] = useState<number | null>(initialColor)
  const [finish, setFinish] = useState<number | null>(initialFinish)
  const [formula, setFormula] = useState<number | null>(initialFormula)
  const [isPending, startTransition] = useTransition()

  const hasRating = color !== null && finish !== null && formula !== null
  const avg = hasRating ? ((color + finish + formula) / 3) : null
  const roundedAvg = avg !== null ? Math.round(avg) : 0

  function handleChange(dimension: 'color' | 'finish' | 'formula', value: number | null) {
    const next = { color, finish, formula, [dimension]: value }
    if (dimension === 'color') setColor(value)
    if (dimension === 'finish') setFinish(value)
    if (dimension === 'formula') setFormula(value)

    startTransition(async () => {
      await rateStashItem(stashItemId, {
        color: next.color,
        finish: next.finish,
        formula: next.formula,
      })
    })
  }

  return (
    <div className="mt-4 inline-block border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left"
      >
          <span className="text-xs font-semibold text-muted-foreground">
            {hasRating ? 'Your rating' : 'Rate this polish'}
          </span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
              <Star
                key={s}
                className={`h-3 w-3 ${
                  s <= roundedAvg
                    ? 'fill-primary stroke-primary'
                    : 'fill-transparent stroke-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          {hasRating && avg !== null && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{avg.toFixed(1)}/5</span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-2.5 min-w-[200px]">
          <DimensionRating label="Color" value={color} onChange={v => handleChange('color', v)} disabled={isPending} />
          <DimensionRating label="Finish" value={finish} onChange={v => handleChange('finish', v)} disabled={isPending} />
          <DimensionRating label="Formula" value={formula} onChange={v => handleChange('formula', v)} disabled={isPending} />
        </div>
      )}
    </div>
  )
}
