'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { approveLook, rejectLook } from '@/lib/actions/look.actions'
import { toast } from 'sonner'

export function AdminLookActions({ lookId }: { lookId: string }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveLook(lookId)
      if ('error' in result) toast.error(result.error)
      else toast.success('Look approved!')
    })
  }

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectLook(lookId, reason.trim() || undefined)
      if ('error' in result) toast.error(result.error)
      else { toast.success('Look rejected.'); setRejecting(false) }
    })
  }

  return (
    <div className="space-y-2">
      {rejecting ? (
        <div className="space-y-2">
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Optional rejection notes…"
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={handleReject} disabled={isPending}>
              {isPending ? 'Rejecting…' : 'Confirm reject'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" onClick={handleApprove} disabled={isPending}>
            {isPending ? '…' : 'Approve'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={isPending}>
            Reject
          </Button>
        </div>
      )}
    </div>
  )
}
