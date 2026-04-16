import Link from 'next/link'
import { swatchStyle } from '@/lib/utils/color'
import { formatScore } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { DupeWithPolishes } from '@/lib/types/app.types'

function scorePill(score: number | null) {
  if (score === null) return 'bg-background/90 text-muted-foreground border border-border'
  if (score >= 4) return 'bg-emerald-500 text-white'
  if (score >= 3) return 'bg-amber-500 text-white'
  return 'bg-rose-500 text-white'
}

export function DupeCard({ dupe }: { dupe: DupeWithPolishes }) {
  const a = dupe.polish_a
  const b = dupe.polish_b

  return (
    <Link
      href={`/dupes/${dupe.id}`}
      className="group block rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all"
    >
      {/* Split swatch area */}
      <div className="aspect-2/1 relative flex">
        {/* Polish A — left */}
        <div className="w-1/2 h-full relative overflow-hidden">
          {a.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.images[0]}
              alt={a.name}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div
              className="w-full h-full"
              style={swatchStyle(a.hex_color, a.hex_secondary) as React.CSSProperties}
            />
          )}
        </div>

        {/* Polish B — right */}
        <div className="w-1/2 h-full relative overflow-hidden">
          {b.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.images[0]}
              alt={b.name}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div
              className="w-full h-full"
              style={swatchStyle(b.hex_color, b.hex_secondary) as React.CSSProperties}
            />
          )}
        </div>

        {/* Score pill — centered on the dividing line */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={cn(
            'rounded-full px-2.5 py-1 text-xs font-black shadow-md',
            scorePill(dupe.avg_overall)
          )}>
            {dupe.avg_overall !== null ? formatScore(dupe.avg_overall) : '—'}
          </span>
        </div>
      </div>

      {/* Polish names */}
      <div className="p-3 grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground truncate">{a.brand.name}</p>
          <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{a.name}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] text-muted-foreground truncate">{b.brand.name}</p>
          <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{b.name}</p>
        </div>
      </div>

      {/* Opinion count */}
      <p className="px-3 pb-3 text-[10px] text-muted-foreground text-center -mt-1">
        {dupe.opinion_count} {dupe.opinion_count === 1 ? 'opinion' : 'opinions'}
      </p>
    </Link>
  )
}
