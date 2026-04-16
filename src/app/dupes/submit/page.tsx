'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { submitDupe } from '@/lib/actions/dupe.actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { PolishWithBrand } from '@/lib/types/app.types'

type Step = 1 | 2 | 3

function PolishSearchCombobox({
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
      .limit(8)
    setLoading(false)
    setResults(
      ((data ?? []) as unknown as PolishWithBrand[]).filter(p => p.id !== excludeId)
    )
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 border border-border rounded-xl p-4">
        <PolishSwatch hexColor={value.hex_color} hexSecondary={value.hex_secondary} imageUrl={value.images?.[0] ?? null} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{value.brand.name}</p>
          <p className="font-bold">{value.name}</p>
          <PolishBadge finish={value.finish_category} />
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Change</Button>
      </div>
    )
  }

  return (
    <div className="space-y-2 relative">
      <p className="text-sm font-semibold">{label}</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name…"
          value={query}
          onChange={e => search(e.target.value)}
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
        <div className="px-1 space-y-1">
          <p className="text-xs text-muted-foreground">No results for &ldquo;{query}&rdquo;.</p>
          <p className="text-xs text-muted-foreground">
            Can&rsquo;t find it?{' '}
            <a href="/polishes/submit" className="text-primary font-semibold hover:underline">
              Submit the polish first
            </a>
            , then come back to submit the swap.
          </p>
        </div>
      )}
    </div>
  )
}

export default function SubmitDupePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [polishA, setPolishA] = useState<PolishWithBrand | null>(null)
  const [polishB, setPolishB] = useState<PolishWithBrand | null>(null)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    if (!polishA || !polishB) return
    startTransition(async () => {
      const result = await submitDupe({
        polishAId: polishA.id,
        polishBId: polishB.id,
        notes: notes.trim() || undefined,
      })
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Dupe submitted! It will appear after review.')
        router.push('/dupes')
      }
    })
  }

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">Submit a dupe</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Step {step} of 3 — {step === 1 ? 'Select the original polish' : step === 2 ? 'Select the dupe' : 'Add notes'}
        </p>
        {/* Step indicator */}
        <div className="flex gap-2 mt-4">
          {([1, 2, 3] as Step[]).map(s => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Search for the <strong>original</strong> or more well-known polish.
            </p>
            <PolishSearchCombobox label="Original polish" value={polishA} onChange={setPolishA} />
            <Button className="w-full" disabled={!polishA} onClick={() => setStep(2)}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {polishA && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm">
                <PolishSwatch hexColor={polishA.hex_color} hexSecondary={polishA.hex_secondary} imageUrl={polishA.images?.[0] ?? null} size="sm" />
                <span className="text-muted-foreground">Comparing against: </span>
                <span className="font-semibold">{polishA.brand.name} — {polishA.name}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Now search for the <strong>dupe</strong> — the similar or more affordable alternative.
            </p>
            <PolishSearchCombobox
              label="Dupe polish"
              value={polishB}
              onChange={setPolishB}
              excludeId={polishA?.id}
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" disabled={!polishB} onClick={() => setStep(3)}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pair summary</p>
              {polishA && (
                <div className="flex items-center gap-2">
                  <PolishSwatch hexColor={polishA.hex_color} imageUrl={polishA.images?.[0] ?? null} size="sm" />
                  <div>
                    <p className="text-xs text-muted-foreground">{polishA.brand.name}</p>
                    <p className="text-sm font-bold">{polishA.name}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                <Check className="h-3.5 w-3.5 text-primary" /> duped by
              </div>
              {polishB && (
                <div className="flex items-center gap-2">
                  <PolishSwatch hexColor={polishB.hex_color} imageUrl={polishB.images?.[0] ?? null} size="sm" />
                  <div>
                    <p className="text-xs text-muted-foreground">{polishB.brand.name}</p>
                    <p className="text-sm font-bold">{polishB.name}</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold block mb-1">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What makes them similar? Any differences worth noting?"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isPending}>
                {isPending ? 'Submitting…' : 'Submit dupe'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Submissions are reviewed by moderators before going live.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
