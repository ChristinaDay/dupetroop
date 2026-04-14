'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { addToStash, removeFromStash } from '@/lib/actions/stash.actions'

interface AddToStashButtonProps {
  polishId: string
  stashItemId?: string   // present if already in stash
  className?: string
}

export function AddToStashButton({ polishId, stashItemId: initialStashItemId, className }: AddToStashButtonProps) {
  const [stashItemId, setStashItemId] = useState(initialStashItemId)
  const [isPending, startTransition] = useTransition()
  const inStash = Boolean(stashItemId)

  function handleToggle() {
    startTransition(async () => {
      if (inStash && stashItemId) {
        const result = await removeFromStash(stashItemId)
        if (!('error' in result)) setStashItemId(undefined)
      } else {
        const result = await addToStash({ polishId })
        if ('id' in result) setStashItemId(result.id)
      }
    })
  }

  return (
    <Button
      variant={inStash ? 'default' : 'outline'}
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
      className={className}
    >
      {isPending ? '...' : inStash ? '✓ In your stash' : '+ Add to stash'}
    </Button>
  )
}
