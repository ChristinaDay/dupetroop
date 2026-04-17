'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { approveDupe, rejectDupe, bulkApproveDupes } from '@/lib/actions/dupe.actions'
import { toast } from 'sonner'
import type { DupeWithPolishes } from '@/lib/types/app.types'

export function AdminDupeList({ dupes: initial }: { dupes: DupeWithPolishes[] }) {
  const [dupes, setDupes] = useState(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isPending, startTransition] = useTransition()

  const allSelected = dupes.length > 0 && selected.size === dupes.length
  const noneSelected = selected.size === 0

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(dupes.map(d => d.id)))
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function removeDupes(ids: string[]) {
    setDupes(prev => prev.filter(d => !ids.includes(d.id)))
    setSelected(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.delete(id))
      return next
    })
  }

  function handleBulkApprove() {
    const ids = [...selected]
    startTransition(async () => {
      const result = await bulkApproveDupes(ids)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${result.approved} dupe${result.approved === 1 ? '' : 's'} approved`)
        removeDupes(ids)
      }
    })
  }

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveDupe(id)
      if (result.error) toast.error(result.error)
      else { toast.success('Approved'); removeDupes([id]) }
    })
  }

  function handleReject(id: string) {
    if (!rejectReason.trim()) { toast.error('Please add a reason'); return }
    startTransition(async () => {
      const result = await rejectDupe(id, rejectReason)
      if (result.error) toast.error(result.error)
      else { toast.success('Rejected'); setRejectingId(null); setRejectReason(''); removeDupes([id]) }
    })
  }

  if (dupes.length === 0) {
    return <p className="text-muted-foreground">No pending dupes. 🎉</p>
  }

  return (
    <div className="space-y-3">
      {/* Bulk toolbar */}
      <div className="flex items-center gap-3 py-2 border-b border-border">
        <Checkbox
          checked={allSelected}
          onCheckedChange={toggleAll}
          aria-label="Select all"
        />
        <span className="text-sm text-muted-foreground">
          {noneSelected ? `${dupes.length} pending` : `${selected.size} of ${dupes.length} selected`}
        </span>
        {!noneSelected && (
          <>
            <Button
              size="sm"
              onClick={handleBulkApprove}
              disabled={isPending}
              className="ml-auto"
            >
              {isPending ? 'Approving…' : `Approve ${selected.size === dupes.length ? 'all' : selected.size}`}
            </Button>
            {selected.size < dupes.length && (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            )}
          </>
        )}
      </div>

      {/* Dupe rows */}
      {dupes.map(dupe => (
        <div
          key={dupe.id}
          className={`border rounded-xl p-4 space-y-3 transition-colors ${
            selected.has(dupe.id) ? 'border-primary/50 bg-primary/5' : 'border-border'
          }`}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              checked={selected.has(dupe.id)}
              onCheckedChange={() => toggle(dupe.id)}
              className="mt-1"
            />
            <div className="flex-1 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <PolishSwatch hexColor={dupe.polish_a.hex_color} imageUrl={dupe.polish_a.images?.[0] ?? null} size="sm" />
                <div>
                  <p className="text-xs text-muted-foreground">{dupe.polish_a.brand.name}</p>
                  <p className="text-sm font-bold">{dupe.polish_a.name}</p>
                  <p className="text-xs text-muted-foreground">{dupe.polish_a.finish_category}</p>
                </div>
              </div>
              <span className="text-muted-foreground text-sm">≈</span>
              <div className="flex items-center gap-2">
                <PolishSwatch hexColor={dupe.polish_b.hex_color} imageUrl={dupe.polish_b.images?.[0] ?? null} size="sm" />
                <div>
                  <p className="text-xs text-muted-foreground">{dupe.polish_b.brand.name}</p>
                  <p className="text-sm font-bold">{dupe.polish_b.name}</p>
                  <p className="text-xs text-muted-foreground">{dupe.polish_b.finish_category}</p>
                </div>
              </div>
            </div>
          </div>

          {dupe.notes && (
            <p className="text-sm text-muted-foreground italic pl-8">&ldquo;{dupe.notes}&rdquo;</p>
          )}

          {/* Per-row actions */}
          <div className="pl-8">
            {rejectingId === dupe.id ? (
              <div className="space-y-2">
                <Textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection…"
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => handleReject(dupe.id)} disabled={isPending}>
                    {isPending ? 'Rejecting…' : 'Confirm reject'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectReason('') }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleApprove(dupe.id)} disabled={isPending}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejectingId(dupe.id)} disabled={isPending}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
