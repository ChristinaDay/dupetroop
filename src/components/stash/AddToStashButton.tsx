'use client'

import { useState, useTransition } from 'react'
import { addToStash, removeFromStash, updateStashItemStatus } from '@/lib/actions/stash.actions'
import type { StashStatus } from '@/lib/types/app.types'

const STATUS_OPTIONS: { value: StashStatus; label: string }[] = [
  { value: 'owned', label: 'Owned' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'bookmarked', label: 'Bookmarked' },
]

interface AddToStashButtonProps {
  polishId: string
  stashItemId?: string
  stashItemStatus?: StashStatus
  className?: string
}

export function AddToStashButton({
  polishId,
  stashItemId: initialStashItemId,
  stashItemStatus: initialStatus,
  className,
}: AddToStashButtonProps) {
  const [stashItemId, setStashItemId] = useState(initialStashItemId)
  const [currentStatus, setCurrentStatus] = useState<StashStatus | undefined>(initialStatus)
  const [picking, setPicking] = useState(false)
  const [isPending, startTransition] = useTransition()

  const inStash = Boolean(stashItemId)

  function handleAdd(status: StashStatus) {
    startTransition(async () => {
      const result = await addToStash({ polishId, status })
      if ('id' in result) {
        setStashItemId(result.id)
        setCurrentStatus(status)
        setPicking(false)
      }
    })
  }

  function handleChangeStatus(status: StashStatus) {
    if (!stashItemId || status === currentStatus) return
    startTransition(async () => {
      const result = await updateStashItemStatus(stashItemId, status)
      if ('success' in result) setCurrentStatus(status)
    })
  }

  function handleRemove() {
    if (!stashItemId) return
    startTransition(async () => {
      const result = await removeFromStash(stashItemId)
      if ('success' in result) {
        setStashItemId(undefined)
        setCurrentStatus(undefined)
        setPicking(false)
      }
    })
  }

  // Already in stash — show segmented status control + remove
  if (inStash && currentStatus) {
    return (
      <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              disabled={isPending}
              onClick={() => handleChangeStatus(opt.value)}
              className={`flex-1 px-2.5 py-1.5 transition-colors ${
                currentStatus === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending}
          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors text-center"
        >
          Remove from stash
        </button>
      </div>
    )
  }

  // Picking status — expanded picker
  if (picking) {
    return (
      <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Add as…</p>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              disabled={isPending}
              onClick={() => handleAdd(opt.value)}
              className="flex-1 px-2.5 py-1.5 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {isPending ? '…' : opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPicking(false)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          Cancel
        </button>
      </div>
    )
  }

  // Default — add to stash button
  return (
    <button
      type="button"
      onClick={() => setPicking(true)}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary transition-colors ${className ?? ''}`}
    >
      + Add to stash
    </button>
  )
}
