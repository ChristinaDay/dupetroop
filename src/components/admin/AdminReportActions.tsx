'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { dismissReport, removeOpinion } from '@/lib/actions/opinion.actions'
import { toast } from 'sonner'

interface AdminReportActionsProps {
  reportId: string
  opinionId?: string
  dupeId?: string
}

export function AdminReportActions({ reportId, opinionId, dupeId }: AdminReportActionsProps) {
  const [isPending, startTransition] = useTransition()

  const handleDismiss = () => {
    startTransition(async () => {
      const result = await dismissReport(reportId)
      if (result.error) toast.error(result.error)
      else toast.success('Report dismissed.')
    })
  }

  const handleRemoveOpinion = () => {
    if (!opinionId || !dupeId) return
    startTransition(async () => {
      const result = await removeOpinion(reportId, opinionId, dupeId)
      if (result.error) toast.error(result.error)
      else toast.success('Opinion removed and report resolved.')
    })
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={handleDismiss} disabled={isPending}>
        Dismiss
      </Button>
      {opinionId && dupeId && (
        <Button size="sm" variant="destructive" onClick={handleRemoveOpinion} disabled={isPending}>
          Remove opinion
        </Button>
      )}
    </div>
  )
}
