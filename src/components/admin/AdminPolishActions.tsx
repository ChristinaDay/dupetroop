'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { approvePolish, rejectPolish } from '@/lib/actions/polish.actions'
import { toast } from 'sonner'

export function AdminPolishActions({ polishId }: { polishId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approvePolish(polishId)
      if (result.error) toast.error(result.error)
      else toast.success('Polish approved!')
    })
  }

  const handleReject = () => {
    if (!confirm('Delete this polish submission?')) return
    startTransition(async () => {
      const result = await rejectPolish(polishId)
      if (result.error) toast.error(result.error)
      else toast.success('Polish removed.')
    })
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={handleApprove} disabled={isPending}>
        {isPending ? '…' : 'Approve'}
      </Button>
      <Button size="sm" variant="outline" onClick={handleReject} disabled={isPending} className="text-destructive border-destructive hover:bg-destructive/10">
        Delete
      </Button>
    </div>
  )
}
