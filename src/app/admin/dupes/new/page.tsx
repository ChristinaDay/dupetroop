'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Search, ArrowLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { createApprovedDupe } from '@/lib/actions/dupe.actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { PolishWithBrand } from '@/lib/types/app.types'

function PolishPicker({
  label,
  value,
  onChange,
  excludeId,
}: {
  label: string
  value: PolishWithBrand | null
  onChange: (p: PolishWithBrand | null) => void
  excludeId?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PolishWithBrand[]>([])
  const [loading, setLoading] = useState(false)

  const search = async (q: string) => {
    setQuery(q)
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
    setResults(((data ?? []) as unknown as PolishWithBrand[]).filter(p => p.id !== excludeId))
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 border border-border rounded-xl p-3 bg-accent/30">
        <PolishSwatch hexColor={value.hex_color} hexSecondary={value.hex_secondary} imageUrl={value.images?.[0] ?? null} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{value.brand.name}</p>
          <p className="font-bold truncate">{value.name}</p>
          <PolishBadge finish={value.finish_category} />
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Change</Button>
      </div>
    )
  }

  return (
    <div className="space-y-2 relative">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name…"
          value={query}
          onChange={e => search(e.target.value)}
          autoFocus={label === 'Polish A'}
        />
      </div>
      {loading && <p className="text-xs text-muted-foreground px-1">Searching…</p>}
      {results.length > 0 && (
        <div className="absolute z-10 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {results.map(polish => (
            <button
              key={polish.id}
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent text-left transition-colors"
              onClick={() => { onChange(polish); setQuery(''); setResults([]) }}
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
      {query.length >= 2 && results.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground px-1">
          No results.{' '}
          <Link href="/admin/polishes" className="text-primary font-semibold hover:underline">Add the polish first</Link>
        </p>
      )}
    </div>
  )
}

type RecentDupe = {
  id: string
  aName: string
  aBrand: string
  bName: string
  bBrand: string
}

export default function AdminNewDupePage() {
  const [polishA, setPolishA] = useState<PolishWithBrand | null>(null)
  const [polishB, setPolishB] = useState<PolishWithBrand | null>(null)
  const [notes, setNotes] = useState('')
  const [recent, setRecent] = useState<RecentDupe[]>([])
  const [isPending, startTransition] = useTransition()

  const ready = polishA && polishB

  const handleSubmit = () => {
    if (!polishA || !polishB) return
    startTransition(async () => {
      const result = await createApprovedDupe({
        polishAId: polishA.id,
        polishBId: polishB.id,
        notes: notes.trim() || undefined,
      })
      if ('error' in result) {
        toast.error(result.error)
      } else {
        setRecent(prev => [{
          id: result.dupeId,
          aName: polishA.name,
          aBrand: polishA.brand.name,
          bName: polishB.name,
          bBrand: polishB.brand.name,
        }, ...prev])
        setPolishA(null)
        setPolishB(null)
        setNotes('')
        toast.success(`Added: ${polishA.name} ↔ ${polishB.name}`)
      }
    })
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/dupes" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h2 className="text-xl font-black">Add dupe pair</h2>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PolishPicker label="Polish A" value={polishA} onChange={setPolishA} excludeId={polishB?.id} />
          <PolishPicker label="Polish B" value={polishB} onChange={setPolishB} excludeId={polishA?.id} />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-2">
            Notes <span className="font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What makes them similar? Any differences worth noting?"
            rows={2}
          />
        </div>

        <Button className="w-full" disabled={!ready || isPending} onClick={handleSubmit}>
          {isPending ? 'Adding…' : 'Add dupe pair'}
        </Button>
      </div>

      {recent.length > 0 && (
        <div className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Added this session ({recent.length})
          </p>
          <div className="space-y-2">
            {recent.map(d => (
              <div key={d.id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-border bg-accent/20 text-sm">
                <span>
                  <span className="font-semibold">{d.aName}</span>
                  <span className="text-muted-foreground"> ({d.aBrand})</span>
                  <span className="text-muted-foreground mx-2">↔</span>
                  <span className="font-semibold">{d.bName}</span>
                  <span className="text-muted-foreground"> ({d.bBrand})</span>
                </span>
                <Link href={`/dupes/${d.id}`} target="_blank" className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
