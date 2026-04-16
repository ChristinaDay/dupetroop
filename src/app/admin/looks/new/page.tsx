'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { PolishBadge } from '@/components/polish/PolishBadge'
import { createLook } from '@/lib/actions/look.actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { PolishWithBrand, LookSourceType, ComponentRole } from '@/lib/types/app.types'

const SOURCE_OPTIONS: { value: LookSourceType; label: string }[] = [
  { value: 'admin', label: 'Staff Pick' },
]

const ROLE_OPTIONS: { value: ComponentRole; label: string }[] = [
  { value: 'base', label: 'Base' },
  { value: 'topper', label: 'Topper' },
  { value: 'glitter_topper', label: 'Glitter Topper' },
  { value: 'accent', label: 'Accent' },
  { value: 'other', label: 'Other' },
]

interface Component {
  polish: PolishWithBrand
  role: ComponentRole
  notes: string
}

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
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
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
              onClick={() => {
                onSelect(polish)
                setQuery('')
                setResults([])
              }}
            >
              <PolishSwatch
                hexColor={polish.hex_color}
                hexSecondary={polish.hex_secondary}
                imageUrl={polish.images?.[0] ?? null}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{polish.brand.name}</p>
                <p className="text-sm font-semibold truncate">{polish.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {query.length >= 2 && results.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground px-1">No results.</p>
      )}
    </div>
  )
}

export default function NewLookPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetPolish, setTargetPolish] = useState<PolishWithBrand | null>(null)
  const [sourceType, setSourceType] = useState<LookSourceType>('admin')
  const [sourceUrl, setSourceUrl] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [featuredRank, setFeaturedRank] = useState('')
  const [components, setComponents] = useState<Component[]>([])

  const addComponent = (polish: PolishWithBrand) => {
    setComponents(prev => [
      ...prev,
      { polish, role: prev.length === 0 ? 'base' : 'topper', notes: '' },
    ])
  }

  const removeComponent = (idx: number) => {
    setComponents(prev => prev.filter((_, i) => i !== idx))
  }

  const updateComponent = (idx: number, patch: Partial<Component>) => {
    setComponents(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }

  const excludeIds = [
    ...(targetPolish ? [targetPolish.id] : []),
    ...components.map(c => c.polish.id),
  ]

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    if (components.length === 0) { toast.error('Add at least one component'); return }

    startTransition(async () => {
      const result = await createLook({
        name: name.trim(),
        description: description.trim() || undefined,
        target_polish_id: targetPolish?.id,
        source_url: sourceUrl.trim() || undefined,
        source_type: sourceType,
        is_featured: isFeatured,
        featured_rank: featuredRank ? parseInt(featuredRank) : undefined,
        components: components.map((c, i) => ({
          polish_id: c.polish.id,
          step_order: i + 1,
          role: c.role,
          notes: c.notes.trim() || undefined,
        })),
      })

      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Recipe created!')
        router.push(`/looks/${result.id}`)
      }
    })
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-black mb-6">New Combination Recipe</h2>

      <div className="space-y-6">
        {/* Name */}
        <div>
          <label className="text-sm font-semibold block mb-1">
            Recipe name <span className="text-rose-500">*</span>
          </label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Bloodbender Dupe Recipe"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-semibold block mb-1">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Community context, sourced notes, layering tips…"
            rows={3}
          />
        </div>

        {/* Target polish */}
        <div>
          <label className="text-sm font-semibold block mb-2">
            Target polish <span className="text-muted-foreground font-normal">(the look you&apos;re emulating)</span>
          </label>
          {targetPolish ? (
            <div className="flex items-center gap-3 border border-border rounded-xl p-3">
              <PolishSwatch
                hexColor={targetPolish.hex_color}
                hexSecondary={targetPolish.hex_secondary}
                imageUrl={targetPolish.images?.[0] ?? null}
                size="sm"
              />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{targetPolish.brand.name}</p>
                <p className="text-sm font-bold">{targetPolish.name}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTargetPolish(null)}>
                Remove
              </Button>
            </div>
          ) : (
            <PolishSearchCombobox
              label="Search for inspiration polish"
              onSelect={setTargetPolish}
              excludeIds={excludeIds}
            />
          )}
        </div>

        {/* Source */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold block mb-1">Source</label>
            <select
              value={sourceType}
              onChange={e => setSourceType(e.target.value as LookSourceType)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SOURCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">
              Source URL <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              placeholder="https://…"
              type="url"
            />
          </div>
        </div>

        {/* Featured */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={e => setIsFeatured(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Feature on home page
          </label>
          {isFeatured && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Rank</label>
              <Input
                value={featuredRank}
                onChange={e => setFeaturedRank(e.target.value)}
                type="number"
                min="1"
                className="w-20"
                placeholder="1"
              />
            </div>
          )}
        </div>

        {/* Components */}
        <div>
          <p className="text-sm font-semibold mb-3">
            Recipe steps <span className="text-rose-500">*</span>
          </p>

          {components.length > 0 && (
            <div className="space-y-3 mb-4">
              {components.map((comp, idx) => (
                <div
                  key={comp.polish.id}
                  className="border border-border rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Step {idx + 1}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeComponent(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove step"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <PolishSwatch
                      hexColor={comp.polish.hex_color}
                      hexSecondary={comp.polish.hex_secondary}
                      imageUrl={comp.polish.images?.[0] ?? null}
                      size="sm"
                    />
                    <div>
                      <p className="text-xs text-muted-foreground">{comp.polish.brand.name}</p>
                      <p className="text-sm font-bold">{comp.polish.name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Role</label>
                      <select
                        value={comp.role}
                        onChange={e => updateComponent(idx, { role: e.target.value as ComponentRole })}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      >
                        {ROLE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes</label>
                      <Input
                        value={comp.notes}
                        onChange={e => updateComponent(idx, { notes: e.target.value })}
                        placeholder="e.g. 2 thin coats"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <PolishSearchCombobox
            label="Add a step"
            onSelect={addComponent}
            excludeIds={excludeIds}
          />
        </div>

        {/* Preview summary */}
        {components.length > 0 && (
          <div className="border border-border rounded-xl p-4 bg-muted/30">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Preview</p>
            <div className="flex items-center gap-2 flex-wrap">
              {components.map((comp, idx) => (
                <span key={comp.polish.id} className="flex items-center gap-2">
                  {idx > 0 && <span className="text-muted-foreground font-bold">+</span>}
                  <PolishSwatch
                    hexColor={comp.polish.hex_color}
                    hexSecondary={comp.polish.hex_secondary}
                    imageUrl={comp.polish.images?.[0] ?? null}
                    size="sm"
                  />
                  <span className="text-xs font-medium">{comp.polish.name}</span>
                </span>
              ))}
              {targetPolish && (
                <>
                  <span className="text-muted-foreground font-bold">=</span>
                  <PolishSwatch
                    hexColor={targetPolish.hex_color}
                    hexSecondary={targetPolish.hex_secondary}
                    imageUrl={targetPolish.images?.[0] ?? null}
                    size="sm"
                  />
                  <span className="text-xs font-medium">{targetPolish.name}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => router.push('/admin/looks')}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name.trim() || components.length === 0}
            className="flex-1"
          >
            {isPending ? 'Creating…' : 'Create Recipe'}
          </Button>
        </div>
      </div>
    </div>
  )
}
