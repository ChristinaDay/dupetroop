'use client'

import { useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { setPolishFeatured } from '@/lib/actions/polish.actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { PolishWithBrand, FeaturedSourceType } from '@/lib/types/app.types'

const SOURCE_OPTIONS: { value: FeaturedSourceType; label: string }[] = [
  { value: 'admin', label: 'Staff Pick' },
]

export function AdminFeaturePolishSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PolishWithBrand[]>([])
  const [selected, setSelected] = useState<PolishWithBrand | null>(null)
  const [rank, setRank] = useState('')
  const [sourceType, setSourceType] = useState<FeaturedSourceType>('admin')
  const [sourceUrl, setSourceUrl] = useState('')
  const [isPending, startTransition] = useTransition()

  const search = async (q: string) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('polishes')
      .select('*, brand:brands(*), collection:collections(*)')
      .eq('is_verified', true)
      .ilike('name', `%${q}%`)
      .limit(8)
    setResults((data as unknown as PolishWithBrand[]) ?? [])
  }

  const handleFeature = () => {
    if (!selected) return
    startTransition(async () => {
      const result = await setPolishFeatured(
        selected.id,
        true,
        rank ? parseInt(rank) : undefined,
        sourceType,
        sourceUrl || null,
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${selected.name} added to Trending Now`)
        setSelected(null)
        setQuery('')
        setResults([])
        setRank('')
        setSourceUrl('')
        setSourceType('admin')
      }
    })
  }

  return (
    <div className="border border-dashed border-border rounded-xl p-4 space-y-4">
      <p className="text-sm font-semibold">Add a polish to Trending Now</p>

      {selected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 border border-border rounded-lg p-3">
            <PolishSwatch hexColor={selected.hex_color} hexSecondary={selected.hex_secondary} imageUrl={selected.images?.[0] ?? null} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{selected.brand.name}</p>
              <p className="font-semibold text-sm truncate">{selected.name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Change</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Rank (optional)</label>
              <Input
                type="number"
                value={rank}
                onChange={e => setRank(e.target.value)}
                placeholder="e.g. 1"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Source</label>
              <select
                value={sourceType}
                onChange={e => setSourceType(e.target.value as FeaturedSourceType)}
                className="w-full h-8 border border-input rounded-md text-sm px-2 bg-background"
              >
                {SOURCE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">Source URL (optional)</label>
            <Input
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="h-8 text-sm"
            />
          </div>
          <Button onClick={handleFeature} disabled={isPending} size="sm" className="w-full">
            {isPending ? 'Adding…' : 'Add to Trending Now'}
          </Button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-9 h-8 text-sm"
              placeholder="Search verified polishes…"
              value={query}
              onChange={e => search(e.target.value)}
            />
          </div>
          {results.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
              {results.map(polish => (
                <button
                  key={polish.id}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors"
                  onClick={() => { setSelected(polish); setResults([]) }}
                >
                  <PolishSwatch hexColor={polish.hex_color} hexSecondary={polish.hex_secondary} imageUrl={polish.images?.[0] ?? null} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{polish.brand.name}</p>
                    <p className="text-sm font-semibold truncate">{polish.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
