'use client'

import { useState, useTransition } from 'react'
import { Bookmark } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { addToStash, updateStashItemStatus, removeFromStash } from '@/lib/actions/stash.actions'
import type { StashStatus } from '@/lib/types/app.types'

const STATUS_OPTIONS: { value: StashStatus; label: string }[] = [
  { value: 'owned', label: 'Owned' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'bookmarked', label: 'Bookmarked' },
]

interface StashIconButtonProps {
  polishId: string
  stashItem?: { id: string; status: StashStatus }
}

export function StashIconButton({ polishId, stashItem: initialStashItem }: StashIconButtonProps) {
  const [stashItem, setStashItem] = useState(initialStashItem)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const inStash = Boolean(stashItem)
  const currentStatus = stashItem?.status

  function handleSelect(status: StashStatus) {
    if (stashItem) {
      if (status === currentStatus) return
      startTransition(async () => {
        const result = await updateStashItemStatus(stashItem.id, status)
        if ('success' in result) setStashItem({ id: stashItem.id, status })
      })
    } else {
      startTransition(async () => {
        const result = await addToStash({ polishId, status })
        if ('id' in result) setStashItem({ id: result.id, status })
      })
    }
    setOpen(false)
  }

  function handleRemove() {
    if (!stashItem) return
    startTransition(async () => {
      const result = await removeFromStash(stashItem.id)
      if ('success' in result) setStashItem(undefined)
    })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={e => { e.preventDefault(); e.stopPropagation() }}
        disabled={isPending}
        data-stashed={inStash || undefined}
        className={`flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-all
          disabled:opacity-50
          ${inStash
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-background/80 text-muted-foreground hover:bg-background hover:text-primary backdrop-blur-sm border border-border/50'
          }`}
        title={inStash ? `In stash: ${currentStatus}` : 'Add to stash'}
      >
        <Bookmark className={`h-3.5 w-3.5 ${inStash ? 'fill-current' : ''}`} />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-44 p-1.5"
        onClick={e => e.stopPropagation()}
      >
        <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {inStash ? 'Move to…' : 'Add as…'}
        </p>
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            disabled={isPending}
            onClick={() => handleSelect(opt.value)}
            className={`flex w-full items-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors
              ${currentStatus === opt.value
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-accent hover:text-foreground text-foreground/80'
              }`}
          >
            {opt.label}
          </button>
        ))}
        {inStash && (
          <>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              disabled={isPending}
              onClick={handleRemove}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              Remove
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
