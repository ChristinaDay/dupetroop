import Link from 'next/link'
import { swatchStyle } from '@/lib/utils/color'
import type { LookWithFullComponents } from '@/lib/queries/looks'

const ROLE_LABEL: Record<string, string> = {
  base: 'Base',
  topper: 'Topper',
  glitter_topper: 'Glitter Topper',
  accent: 'Accent',
  other: '',
}

export function ComboCard({ look }: { look: LookWithFullComponents }) {
  const components = look.components
  const displayComponents = components.slice(0, 3)
  const overflow = components.length - 3

  const nameString = components.length >= 2
    ? components.map(c =>
        ROLE_LABEL[c.role]
          ? `${c.polish.name} (${ROLE_LABEL[c.role]})`
          : c.polish.name
      ).join(' + ')
    : components[0]?.polish.name ?? look.name

  return (
    <Link
      href={`/looks/${look.id}`}
      className="group block rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all"
    >
      {/* Swatch area */}
      <div className="aspect-2/1 relative flex items-center justify-center gap-1.5 px-3 bg-muted/30">
        {displayComponents.map((comp, i) => (
          <div key={comp.id} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-[10px] font-black text-muted-foreground">+</span>
            )}
            <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 shadow-sm ring-2 ring-background">
              {comp.polish.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={comp.polish.images[0]}
                  alt={comp.polish.name}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={swatchStyle(comp.polish.hex_color, comp.polish.hex_secondary) as React.CSSProperties}
                />
              )}
            </div>
          </div>
        ))}
        {overflow > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-muted-foreground">+</span>
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center flex-shrink-0 ring-2 ring-background">
              <span className="text-xs font-bold text-muted-foreground">+{overflow}</span>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
          Combination
        </p>
        <p className="text-xs font-bold line-clamp-2 group-hover:text-primary transition-colors">
          {nameString}
        </p>
      </div>
    </Link>
  )
}
