import Link from 'next/link'
import { PolishBadge } from './PolishBadge'
import { PolishPrice } from './PolishPrice'
import { swatchStyle } from '@/lib/utils/color'
import type { PolishWithBrand } from '@/lib/types/app.types'

interface PolishCardProps {
  polish: PolishWithBrand
  showDupeCount?: boolean
}

export function PolishCard({ polish, showDupeCount = false }: PolishCardProps) {
  const href = `/polishes/${polish.brand.slug}/${polish.slug}`
  const primaryImage = polish.images?.[0] ?? null

  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all"
    >
      {/* Image / swatch area */}
      <div className="aspect-square relative overflow-hidden bg-muted">
        {primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImage}
            alt={polish.name}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full"
            style={swatchStyle(polish.hex_color, polish.hex_secondary) as React.CSSProperties}
          />
        )}

        {/* Status badges */}
        {(polish.is_limited || polish.is_discontinued) && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {polish.is_limited && (
              <span className="rounded-full bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 backdrop-blur-sm">
                LE
              </span>
            )}
            {polish.is_discontinued && (
              <span className="rounded-full bg-background/90 text-foreground/60 text-[10px] font-semibold px-2 py-0.5 backdrop-blur-sm border border-border tracking-wide uppercase">
                Discontinued
              </span>
            )}
          </div>
        )}

        {/* Dupe count */}
        {showDupeCount && polish.dupe_count > 0 && (
          <div className="absolute bottom-2 right-2">
            <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 shadow-sm">
              {polish.dupe_count} dupe{polish.dupe_count !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Text */}
      <div className="p-3">
        <p className="text-[11px] font-semibold text-muted-foreground truncate">
          {polish.brand.name}
        </p>
        <h3 className="font-bold text-sm mt-0.5 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {polish.name}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <PolishBadge finish={polish.finish_category} />
          <PolishPrice price={polish.msrp_usd} className="text-xs text-muted-foreground ml-auto" />
        </div>
      </div>
    </Link>
  )
}
