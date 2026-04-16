import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import type { LookCard as LookCardType } from '@/lib/queries/looks'
import type { LookComponent } from '@/lib/types/app.types'

// Source badge config
const SOURCE_CONFIG: Partial<Record<string, { label: string; className: string; dot: string }>> = {
  admin: {
    label: 'Staff Pick',
    className: 'bg-primary/10 text-primary border-primary/20',
    dot: 'bg-primary',
  },
}

interface LookCardProps {
  look: LookCardType
  // Full components only available on detail page; here we get them optionally
  components?: LookComponent[]
  hasBudgetPath?: boolean
}

export function SourceBadge({ source }: { source: LookCardType['source_type'] }) {
  const config = SOURCE_CONFIG[source]
  if (!config) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${config.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

export function LookCard({ look, components = [], hasBudgetPath = false }: LookCardProps) {
  // Show up to 3 component swatches
  const swatchComponents = components.slice(0, 3)

  return (
    <Link
      href={`/looks/${look.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all"
    >
      {/* Source badge */}
      <div className="flex items-center justify-between">
        <SourceBadge source={look.source_type} />
        {look.source_url && (
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Swatches row: components → "=" → target */}
      <div className="flex items-center gap-2">
        {swatchComponents.length > 0 ? (
          <>
            {swatchComponents.map((comp, i) => (
              <span key={comp.id} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-muted-foreground text-sm font-bold">+</span>
                )}
                <PolishSwatch
                  hexColor={comp.polish.hex_color}
                  hexSecondary={comp.polish.hex_secondary}
                  imageUrl={comp.polish.images?.[0] ?? null}
                  size="sm"
                />
              </span>
            ))}
            {look.target_polish && (
              <>
                <span className="text-muted-foreground text-sm font-bold">=</span>
                <PolishSwatch
                  hexColor={look.target_polish.hex_color}
                  hexSecondary={look.target_polish.hex_secondary}
                  imageUrl={look.target_polish.images?.[0] ?? null}
                  size="sm"
                />
              </>
            )}
          </>
        ) : look.target_polish ? (
          // No components preloaded — just show the target
          <PolishSwatch
            hexColor={look.target_polish.hex_color}
            hexSecondary={look.target_polish.hex_secondary}
            imageUrl={look.target_polish.images?.[0] ?? null}
            size="md"
          />
        ) : null}
      </div>

      {/* Name + description */}
      <div>
        <p className="text-sm font-bold leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {look.name}
        </p>
        {look.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {look.description}
          </p>
        )}
      </div>

      {/* Budget path indicator */}
      {hasBudgetPath && (
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          Budget path available
        </p>
      )}
    </Link>
  )
}
