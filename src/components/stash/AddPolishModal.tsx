'use client'

import { useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { addToStash } from '@/lib/actions/stash.actions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { PolishWithBrand, StashStatus } from '@/lib/types/app.types'

const STATUS_OPTIONS: { value: StashStatus; label: string; desc: string }[] = [
  { value: 'owned', label: 'Owned', desc: 'In my collection' },
  { value: 'destashed', label: 'Destashed', desc: 'Used up or passed on' },
  { value: 'wishlist', label: 'Wishlist', desc: 'Want to buy' },
  { value: 'bookmarked', label: 'Bookmarked', desc: 'Keeping an eye on it' },
]

export function AddPolishModal() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<StashStatus>('owned')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PolishWithBrand[]>([])
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState<PolishWithBrand[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const search = async (q: string) => {
    setQuery(q)
    setErrorMsg(null)
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('polishes')
      .select('*, brand:brands(*), collection:collections(*)')
      .eq('is_verified', true)
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(8)
    setLoading(false)
    setResults((data ?? []) as unknown as PolishWithBrand[])
  }

  const handleSelect = (polish: PolishWithBrand) => {
    setErrorMsg(null)
    startTransition(async () => {
      const result = await addToStash({ polishId: polish.id, status })
      if ('error' in result) {
        setErrorMsg(result.error)
      } else {
        setAdded(prev => [...prev, polish])
        setQuery('')
        setResults([])
        router.refresh()
      }
    })
  }

  const handleClose = () => {
    setOpen(false)
    setStatus('owned')
    setQuery('')
    setResults([])
    setAdded([])
    setErrorMsg(null)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add polish
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Add to stash</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status picker */}
        <div className="flex gap-1.5">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`flex-1 rounded-xl border px-2 py-2 text-center transition-colors ${
                status === opt.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <p className="text-xs font-bold">{opt.label}</p>
              <p className="text-[10px] mt-0.5 leading-tight">{opt.desc}</p>
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name…"
            value={query}
            onChange={e => search(e.target.value)}
            autoFocus
          />
        </div>

        {/* Results */}
        {loading && (
          <p className="text-xs text-muted-foreground px-1">Searching…</p>
        )}

        {results.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
            {results.map(polish => {
              const alreadyAdded = added.some(p => p.id === polish.id)
              return (
                <button
                  key={polish.id}
                  type="button"
                  disabled={alreadyAdded || isPending}
                  onClick={() => handleSelect(polish)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent text-left transition-colors disabled:opacity-50 disabled:cursor-default"
                >
                  <PolishSwatch
                    hexColor={polish.hex_color}
                    hexSecondary={polish.hex_secondary}
                    imageUrl={polish.images?.[0] ?? null}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{polish.brand.name}</p>
                    <p className="text-sm font-semibold truncate">{polish.name}</p>
                    <PolishBadge finish={polish.finish_category} />
                  </div>
                  {alreadyAdded && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold shrink-0">Added</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground px-1">
            No results for &ldquo;{query}&rdquo;. Try a different spelling, or{' '}
            <a href="/polishes/submit" className="text-primary font-semibold hover:underline">
              submit it as a new polish
            </a>
            .
          </p>
        )}

        {errorMsg && (
          <p className="text-sm text-destructive font-medium">{errorMsg}</p>
        )}

        {/* Recently added in this session */}
        {added.length > 0 && (
          <div className="border-t border-border pt-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Added this session</p>
            {added.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <PolishSwatch hexColor={p.hex_color} hexSecondary={p.hex_secondary} imageUrl={p.images?.[0] ?? null} size="sm" />
                <span className="text-muted-foreground">{p.brand.name}</span>
                <span className="font-medium">{p.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
