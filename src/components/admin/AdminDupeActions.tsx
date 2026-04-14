'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { approveDupe, rejectDupe } from '@/lib/actions/dupe.actions'
import { toast } from 'sonner'

export function AdminDupeActions({ dupeId }: { dupeId: string }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveDupe(dupeId)
      if (result.error) toast.error(result.error)
      else toast.success('Dupe approved!')
    })
  }

  const handleReject = () => {
    if (!reason.trim()) { toast.error('Please provide a rejection reason.'); return }
    startTransition(async () => {
      const result = await rejectDupe(dupeId, reason)
      if (result.error) toast.error(result.error)
      else { toast.success('Dupe rejected.'); setRejecting(false) }
    })
  }

  return (
    <div className="space-y-2">
      {rejecting ? (
        <div className="space-y-2">
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for rejection…"
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={handleReject} disabled={isPending}>
              {isPending ? 'Rejecting…' : 'Confirm reject'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
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
