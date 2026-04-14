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
import { finishLabel } from '@/lib/utils/format'

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ polishes: [], brands: [] })
  const [isPending, startTransition] = useTransition()

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults({ polishes: [], brands: [] })
      return
    }
    const id = setTimeout(() => {
      startTransition(async () => {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (res.ok) setResults(await res.json())
      })
    }, 200)
    return () => clearTimeout(id)
  }, [query])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults({ polishes: [], brands: [] })
    }
  }, [open])

  const navigate = useCallback((href: string) => {
    onOpenChange(false)
    router.push(href)
  }, [router, onOpenChange])

  const hasResults = results.polishes.length > 0 || results.brands.length > 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search DupeTroop"
      description="Search for nail polishes and brands"
    >
      <CommandInput
        placeholder="Search polishes, brands…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.length >= 2 && !isPending && !hasResults && (
          <CommandEmpty>No results for &ldquo;{query}&rdquo;</CommandEmpty>
        )}
        {query.length >= 2 && isPending && (
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
