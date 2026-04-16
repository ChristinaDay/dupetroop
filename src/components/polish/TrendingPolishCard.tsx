import Link from 'next/link'
import { PolishSwatch } from './PolishSwatch'
import { PolishBadge } from './PolishBadge'
import { formatPrice } from '@/lib/utils/format'
import type { FeaturedPolish, FeaturedSourceType } from '@/lib/types/app.types'

const SOURCE_CONFIG: Partial<Record<FeaturedSourceType, { label: string; className: string; dot: string }>> = {
  admin: {
    label: 'Staff Pick',
    className: 'bg-primary/10 text-primary border-primary/20',
    dot: 'bg-primary',
  },
}

interface TrendingPolishCardProps {
  polish: FeaturedPolish
}

export function TrendingPolishCard({ polish }: TrendingPolishCardProps) {
  const href = `/polishes/${polish.brand.slug}/${polish.slug}`
  const source = polish.featured_source_type
    ? SOURCE_CONFIG[polish.featured_source_type]
    : null

  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-lg transition-all overflow-hidden"
    >
      {/* Background swatch tint */}
      {polish.hex_color && (
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundColor: polish.hex_color }}
        />
      )}

      {/* Source badge */}
      {source && (
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${source.className}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${source.dot}`} />
            {source.label}
          </span>
          {polish.featured_source_url && (
            <span className="text-[10px] text-muted-foreground font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View source →
            </span>
          )}
        </div>
      )}

      {/* Swatch + info */}
      <div className="flex items-center gap-4">
        <PolishSwatch
          hexColor={polish.hex_color}
          hexSecondary={polish.hex_secondary}
          imageUrl={polish.images?.[0] ?? null}
          size="xl"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-foreground truncate">
            {polish.brand.name}
          </p>
          <h3 className="text-lg font-black tracking-tight leading-tight mt-0.5 group-hover:text-primary transition-colors line-clamp-2">
            {polish.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <PolishBadge finish={polish.finish_category} />
            {polish.is_discontinued && (
              <span className="text-xs text-muted-foreground italic">discontinued</span>
            )}
            {polish.is_limited && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Limited Edition</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            {polish.msrp_usd && (
              <span className="text-sm font-semibold text-muted-foreground">
                {formatPrice(polish.msrp_usd)}
              </span>
            )}
            {polish.dupe_count > 0 && (
              <span className="text-sm font-bold text-primary">
                {polish.dupe_count} dupe{polish.dupe_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {polish.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {polish.description}
        </p>
      )}
    </Link>
  )
}
