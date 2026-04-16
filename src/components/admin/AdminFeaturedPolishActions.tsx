'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { setPolishFeatured } from '@/lib/actions/polish.actions'
import { toast } from 'sonner'

export function AdminFeaturedPolishActions({ polishId }: { polishId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleUnfeature = () => {
    startTransition(async () => {
      const result = await setPolishFeatured(polishId, false)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Removed from Trending Now')
      }
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleUnfeature}
      disabled={isPending}
      className="shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive"
    >
      {isPending ? 'Removing…' : 'Remove'}
    </Button>
  )
}
