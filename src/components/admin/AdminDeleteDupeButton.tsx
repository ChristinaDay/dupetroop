'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { deleteDupe } from '@/lib/actions/dupe.actions'
import { toast } from 'sonner'

export function AdminDeleteDupeButton({ dupeId }: { dupeId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteDupe(dupeId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Dupe deleted.')
        router.push('/dupes')
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Are you sure?</span>
        <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isPending}>
          {isPending ? 'Deleting…' : 'Yes, delete'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
      Delete dupe
    </Button>
  )
}
