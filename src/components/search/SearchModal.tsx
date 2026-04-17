'use client'

import { useEffect, useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Tag } from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import type { SearchResults } from '@/app/api/search/route'
import type { FinishCategory, ColorFamily } from '@/lib/types/app.types'
import { finishLabel, colorLabel } from '@/lib/utils/format'

const FINISH_OPTIONS: FinishCategory[] = [
  'cream', 'shimmer', 'glitter', 'flakies', 'duochrome',
  'multichrome', 'holo', 'magnetic', 'jelly', 'tinted', 'matte', 'satin', 'topper',
]

const COLOR_OPTIONS: ColorFamily[] = [
  'red', 'orange', 'yellow', 'green', 'blue',
  'purple', 'pink', 'neutral', 'white', 'black', 'multicolor',
]

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [finish, setFinish] = useState<FinishCategory | null>(null)
  const [color, setColor] = useState<ColorFamily | null>(null)
  const [results, setResults] = useState<SearchResults>({ polishes: [], brands: [] })
  const [isPending, startTransition] = useTransition()

  // Debounced search — fires when query, finish, or color changes
  useEffect(() => {
    const hasText = query.length >= 2
    const hasFilter = finish !== null || color !== null

    if (!hasText && !hasFilter) {
      setResults({ polishes: [], brands: [] })
      return
    }

    const id = setTimeout(() => {
      startTransition(async () => {
        const url = new URL('/api/search', window.location.origin)
        if (query) url.searchParams.set('q', query)
        if (finish) url.searchParams.set('finish', finish)
        if (color) url.searchParams.set('color', color)
        const res = await fetch(url.toString())
        if (res.ok) setResults(await res.json())
      })
    }, 200)
    return () => clearTimeout(id)
  }, [query, finish, color])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('')
      setFinish(null)
      setColor(null)
      setResults({ polishes: [], brands: [] })
    }
  }, [open])

  const navigate = useCallback((href: string) => {
    onOpenChange(false)
    router.push(href)
  }, [router, onOpenChange])

  const hasResults = results.polishes.length > 0 || results.brands.length > 0
  const hasFilter = finish !== null || color !== null
  const showEmpty = (query.length >= 2 || hasFilter) && !isPending && !hasResults

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search DoopTroop"
      description="Search for nail polishes and brands"
    >
      <CommandInput
        placeholder="Search polishes, brands…"
        value={query}
        onValueChange={setQuery}
      />

      {/* Filter chips */}
      <div className="border-t border-border px-2 py-1.5 space-y-1">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {FINISH_OPTIONS.map(f => (
            <button
              key={f}
              onClick={() => setFinish(prev => prev === f ? null : f)}
              className={[
                'shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                finish === f
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground',
              ].join(' ')}
            >
              {finishLabel(f)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {COLOR_OPTIONS.map(c => (
            <button
              key={c}
              onClick={() => setColor(prev => prev === c ? null : c)}
              className={[
                'shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                color === c
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground',
              ].join(' ')}
            >
              {colorLabel(c)}
            </button>
          ))}
        </div>
      </div>

      <CommandList>
        {showEmpty && (
          <CommandEmpty>No results{query ? ` for "${query}"` : ''}</CommandEmpty>
        )}
        {(query.length >= 2 || hasFilter) && isPending && (
          <CommandEmpty>Searching…</CommandEmpty>
        )}
        {results.polishes.length > 0 && (
          <CommandGroup heading="Polishes">
            {results.polishes.map(polish => (
              <CommandItem
                key={polish.id}
                value={`${polish.brand.name} ${polish.name}`}
                onSelect={() => navigate(`/polishes/${polish.brand.slug}/${polish.slug}`)}
                className="gap-3"
              >
                {/* Color swatch */}
                <span
                  className="h-4 w-4 rounded-full shrink-0 border border-border"
                  style={{ background: polish.hex_color ?? '#888' }}
                />
                <span className="flex-1 truncate">
                  <span className="font-medium">{polish.name}</span>
                  <span className="text-muted-foreground"> · {polish.brand.name}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {finishLabel(polish.finish_category)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.polishes.length > 0 && results.brands.length > 0 && (
          <CommandSeparator />
        )}
        {results.brands.length > 0 && (
          <CommandGroup heading="Brands">
            {results.brands.map(brand => (
              <CommandItem
                key={brand.id}
                value={brand.name}
                onSelect={() => navigate(`/brands/${brand.slug}`)}
                className="gap-3"
              >
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate font-medium">{brand.name}</span>
                {brand.is_indie && (
                  <span className="text-xs text-primary shrink-0 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> indie
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
