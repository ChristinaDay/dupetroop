import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { PolishSwatch } from './PolishSwatch'
import { PolishBadge } from './PolishBadge'
import { formatPrice } from '@/lib/utils/format'
import type { PolishWithBrand } from '@/lib/types/app.types'

interface PolishCardProps {
  polish: PolishWithBrand
  showDupeCount?: boolean
}

export function PolishCard({ polish, showDupeCount = false }: PolishCardProps) {
  const href = `/polishes/${polish.brand.slug}/${polish.slug}`
  const primaryImage = polish.images?.[0] ?? null

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <Link href={href} className="flex items-start gap-3">
          <PolishSwatch
            hexColor={polish.hex_color}
            hexSecondary={polish.hex_secondary}
            imageUrl={primaryImage}
            size="lg"
            className="mt-0.5 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate font-medium">
              {polish.brand.name}
            </p>
            <h3 className="font-bold text-sm leading-tight mt-0.5 group-hover:text-primary transition-colors line-clamp-2">
              {polish.name}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1 items-center">
              <PolishBadge finish={polish.finish_category} />
              {polish.is_discontinued && (
                <span className="text-xs text-muted-foreground italic">discontinued</span>
              )}
              {polish.is_limited && (
                <span className="text-xs text-amber-600 font-medium">LE</span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              {polish.msrp_usd && (
                <span className="text-xs text-muted-foreground">
                  {formatPrice(polish.msrp_usd)}
                </span>
              )}
              {showDupeCount && polish.dupe_count > 0 && (
                <span className="text-xs font-semibold text-primary">
                  {polish.dupe_count} dupe{polish.dupe_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  )
}
