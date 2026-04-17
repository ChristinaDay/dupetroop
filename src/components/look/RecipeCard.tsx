import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { SourceBadge } from '@/components/look/LookCard'
import { PolishPrice } from '@/components/polish/PolishPrice'
import type { PolishWithBrand } from '@/lib/types/app.types'
import type { LookWithFullComponents, ComponentWithAlternatives } from '@/lib/queries/looks'

function PolishRow({
  polish,
  label,
}: {
  polish: PolishWithBrand
  label?: string
}) {
  return (
    <Link
      href={`/polishes/${polish.brand.slug}/${polish.slug}`}
      className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/50 transition-colors group"
    >
      <PolishSwatch
        hexColor={polish.hex_color ?? '#888888'}
        hexSecondary={polish.hex_secondary ?? null}
        imageUrl={polish.images?.[0] ?? null}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {label && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 shrink-0">
              {label}
            </span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">{polish.brand.name}</span>
          <span className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
            {polish.name}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <PolishBadge finish={polish.finish_category as never} />
          <PolishPrice price={polish.msrp_usd} className="text-[10px] text-muted-foreground" />
        </div>
      </div>
    </Link>
  )
}

function RecipeStep({ comp, isLast }: { comp: ComponentWithAlternatives; isLast: boolean }) {
  const roleLabel = {
    base: 'Base',
    topper: 'Topper',
    glitter_topper: 'Glitter Topper',
    accent: 'Accent',
    other: 'Step',
  }[comp.role] ?? 'Step'

  return (
    <div>
      {/* Step label */}
      <div className="flex items-center gap-2 mb-1.5 px-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {roleLabel}
        </span>
        {comp.notes && (
          <span className="text-[10px] text-muted-foreground italic truncate">{comp.notes}</span>
        )}
      </div>

      {/* Canonical polish */}
      <PolishRow polish={comp.polish} />

      {/* Alternatives */}
      {comp.alternatives.length > 0 && (
        <div className="ml-2 mt-0.5 border-l-2 border-border pl-3 space-y-0.5">
          {comp.alternatives.map(alt => (
            <PolishRow key={alt.id} polish={alt} label="or" />
          ))}
        </div>
      )}

      {/* Plus connector */}
      {!isLast && (
        <p className="text-center text-sm font-bold text-muted-foreground/50 my-2">+</p>
      )}
    </div>
  )
}

interface RecipeCardProps {
  look: LookWithFullComponents
}

export function RecipeCard({ look }: RecipeCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <SourceBadge source={look.source_type} />
          {look.name && (
            <span className="text-sm font-bold">{look.name}</span>
          )}
        </div>
        {look.source_url && (
          <a
            href={look.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Steps */}
      <div className="px-2 py-3">
        {look.components.length > 0 ? (
          look.components.map((comp, i) => (
            <RecipeStep
              key={comp.id}
              comp={comp}
              isLast={i === look.components.length - 1}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground px-2">No components listed yet.</p>
        )}
      </div>

      {/* Description */}
      {look.description && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground italic">{look.description}</p>
        </div>
      )}
    </div>
  )
}
