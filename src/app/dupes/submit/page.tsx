'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, ArrowRight, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { submitDupe } from '@/lib/actions/dupe.actions'
import { submitLookAsDupe } from '@/lib/actions/look.actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { PolishWithBrand, ComponentRole } from '@/lib/types/app.types'
import { Suspense } from 'react'

type Step = 1 | 2 | 3

type DupeComponent = {
  polish: PolishWithBrand
  role: ComponentRole
}

const ROLE_OPTIONS: { value: ComponentRole; label: string }[] = [
  { value: 'base', label: 'Base' },
  { value: 'topper', label: 'Topper' },
  { value: 'glitter_topper', label: 'Glitter Topper' },
  { value: 'accent', label: 'Accent' },
  { value: 'other', label: 'Other' },
]

function PolishSearchCombobox({
  label,
  onSelect,
  excludeIds = [],
}: {
  label: string
  onSelect: (p: PolishWithBrand) => void
  excludeIds?: string[]
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
      ((data ?? []) as unknown as PolishWithBrand[]).filter(p => !excludeIds.includes(p.id))
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
              onClick={() => { onSelect(polish); setQuery(''); setResults([]) }}
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
            , then come back to submit the dupe.
          </p>
        </div>
      )}
    </div>
  )
}

function SubmitDupeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>(1)
  const [polishA, setPolishA] = useState<PolishWithBrand | null>(null)
  const [components, setComponents] = useState<DupeComponent[]>([])
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const addComponent = (polish: PolishWithBrand) => {
    setComponents(prev => [
      ...prev,
      { polish, role: prev.length === 0 ? 'base' : 'topper' },
    ])
  }

  const removeComponent = (idx: number) => {
    setComponents(prev => prev.filter((_, i) => i !== idx))
  }

  const updateRole = (idx: number, role: ComponentRole) => {
    setComponents(prev => prev.map((c, i) => i === idx ? { ...c, role } : c))
  }

  const excludeIds = [
    ...(polishA ? [polishA.id] : []),
    ...components.map(c => c.polish.id),
  ]

  const handleSubmit = () => {
    if (!polishA || components.length === 0) return
    startTransition(async () => {
      if (components.length === 1) {
        const result = await submitDupe({
          polishAId: polishA.id,
          polishBId: components[0].polish.id,
          notes: notes.trim() || undefined,
        })
        if ('error' in result) {
          toast.error(result.error)
        } else {
          toast.success('Dupe submitted! It will appear after review.')
          router.push('/dupes')
        }
      } else {
        const result = await submitLookAsDupe({
          target_polish_id: polishA.id,
          notes: notes.trim() || undefined,
          components: components.map((c, i) => ({
            polish_id: c.polish.id,
            step_order: i + 1,
            role: c.role,
          })),
        })
        if ('error' in result) {
          toast.error(result.error)
        } else {
          toast.success('Combination dupe submitted! It will appear after review.')
          router.push('/dupes')
        }
      }
    })
  }

  // Pre-fill polishA from ?a= query param on first render
  const prefilledId = searchParams.get('a')
  const [prefillDone, setPrefillDone] = useState(false)
  if (prefilledId && !prefillDone && !polishA) {
    setPrefillDone(true)
    const supabase = createClient()
    supabase
      .from('polishes')
      .select('*, brand:brands(*), collection:collections(*)')
      .eq('id', prefilledId)
      .single()
      .then(({ data }) => {
        if (data) setPolishA(data as unknown as PolishWithBrand)
      })
  }

  const stepLabel = step === 1
    ? 'Select the original polish'
    : step === 2
    ? 'Add dupe polish(es)'
    : 'Review & submit'

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">Submit a dupe</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Step {step} of 3 — {stepLabel}
        </p>
        <div className="flex gap-2 mt-4">
          {([1, 2, 3] as Step[]).map(s => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Step 1 — original polish */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Search for the <strong>original</strong> or more well-known polish.
            </p>
            {polishA ? (
              <div className="flex items-center gap-3 border border-border rounded-xl p-4">
                <PolishSwatch hexColor={polishA.hex_color} hexSecondary={polishA.hex_secondary} imageUrl={polishA.images?.[0] ?? null} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{polishA.brand.name}</p>
                  <p className="font-bold">{polishA.name}</p>
                  <PolishBadge finish={polishA.finish_category} />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPolishA(null)}>Change</Button>
              </div>
            ) : (
              <PolishSearchCombobox label="Original polish" onSelect={setPolishA} />
            )}
            <Button className="w-full" disabled={!polishA} onClick={() => setStep(2)}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2 — dupe component(s) */}
        {step === 2 && (
          <div className="space-y-4">
            {polishA && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm">
                <PolishSwatch hexColor={polishA.hex_color} hexSecondary={polishA.hex_secondary} imageUrl={polishA.images?.[0] ?? null} size="sm" />
                <span className="text-muted-foreground">Duping: </span>
                <span className="font-semibold">{polishA.brand.name} — {polishA.name}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Add <strong>one or more</strong> polishes that dupe the original. Use multiple for layering combos.
            </p>

            {/* Added components */}
            {components.length > 0 && (
              <div className="space-y-2">
                {components.map((comp, idx) => (
                  <div key={comp.polish.id} className="flex items-center gap-3 border border-border rounded-xl p-3">
                    <PolishSwatch hexColor={comp.polish.hex_color} hexSecondary={comp.polish.hex_secondary} imageUrl={comp.polish.images?.[0] ?? null} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{comp.polish.brand.name}</p>
                      <p className="text-sm font-bold truncate">{comp.polish.name}</p>
                    </div>
                    {components.length >= 2 && (
                      <select
                        value={comp.role}
                        onChange={e => updateRole(idx, e.target.value as ComponentRole)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        {ROLE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => removeComponent(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <PolishSearchCombobox
              label={components.length === 0 ? 'Add dupe polish' : 'Add another polish'}
              onSelect={addComponent}
              excludeIds={excludeIds}
            />

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" disabled={components.length === 0} onClick={() => setStep(3)}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — review & submit */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="border border-border rounded-xl overflow-hidden">
              {/* Original */}
              <div className="px-4 pt-4 pb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Original</p>
                {polishA && (
                  <div className="flex items-center gap-3">
                    <PolishSwatch hexColor={polishA.hex_color} hexSecondary={polishA.hex_secondary} imageUrl={polishA.images?.[0] ?? null} size="sm" />
                    <div>
                      <p className="text-xs text-muted-foreground">{polishA.brand.name}</p>
                      <p className="text-sm font-bold">{polishA.name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 border-y border-border">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-xs font-semibold text-muted-foreground">duped by</p>
              </div>

              {/* Components — equal hierarchy */}
              <div className="px-4 pt-3 pb-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {components.length === 1 ? 'Dupe' : 'Combination'}
                </p>
                {components.map(comp => (
                  <div key={comp.polish.id} className="flex items-center gap-3">
                    <PolishSwatch hexColor={comp.polish.hex_color} hexSecondary={comp.polish.hex_secondary} imageUrl={comp.polish.images?.[0] ?? null} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{comp.polish.brand.name}</p>
                      <p className="text-sm font-bold">{comp.polish.name}</p>
                    </div>
                    {components.length >= 2 && (
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                        {ROLE_OPTIONS.find(o => o.value === comp.role)?.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
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

export default function SubmitDupePage() {
  return (
    <Suspense>
      <SubmitDupeForm />
    </Suspense>
  )
}
