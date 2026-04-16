import Link from 'next/link'
import { swatchStyle } from '@/lib/utils/color'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { formatPrice } from '@/lib/utils/format'
import type { PolishWithBrand } from '@/lib/types/app.types'

interface DupePolishColumnProps {
  polish: PolishWithBrand
  role: 'original' | 'dupe'
  communityImages?: string[]
}

export function DupePolishColumn({ polish, role, communityImages = [] }: DupePolishColumnProps) {
  const allImages = [...(polish.images ?? []), ...communityImages]

  return (
    <div className="flex flex-col">
      {/* Role label */}
      <div className="px-1 pb-2">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${role === 'original' ? 'text-muted-foreground' : 'text-primary'}`}>
          {role === 'original' ? 'Original' : 'Dupe'}
        </span>
      </div>

      {/* Image stack */}
      <div className="flex flex-col gap-1.5">
        {allImages.length > 0 ? (
          allImages.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={i === 0 ? polish.name : `Community swatch ${i}`}
              className="w-full object-cover object-top rounded-xl"
              style={{ aspectRatio: '2/3' }}
            />
          ))
        ) : (
          <div
            className="w-full rounded-xl"
            style={{
              aspectRatio: '2/3',
              ...swatchStyle(polish.hex_color, polish.hex_secondary) as React.CSSProperties,
            }}
          />
        )}

        {/* Add swatch CTA */}
        <Link
          href="/stash"
          className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-dashed border-border py-4 text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Share your swatch
        </Link>
      </div>

      {/* Polish info */}
      <div className="pt-3 space-y-1">
        <Link href={`/brands/${polish.brand.slug}`} className="text-[11px] text-muted-foreground hover:text-primary transition-colors">
          {polish.brand.name}
        </Link>
        <Link href={`/polishes/${polish.brand.slug}/${polish.slug}`}>
          <h2 className="font-black text-lg leading-tight hover:text-primary transition-colors">
            {polish.name}
          </h2>
        </Link>
        <div className="flex items-center gap-2 pt-0.5">
          <PolishBadge finish={polish.finish_category} />
          {polish.msrp_usd && (
            <span className="text-xs text-muted-foreground">{formatPrice(polish.msrp_usd)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
