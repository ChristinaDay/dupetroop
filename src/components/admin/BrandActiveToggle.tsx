'use client'

import { useTransition } from 'react'
import { toggleBrandActive } from '@/lib/actions/brand.actions'
import { toast } from 'sonner'

interface BrandActiveToggleProps {
  brandId: string
  brandName: string
  isActive: boolean
}

export function BrandActiveToggle({ brandId, brandName, isActive }: BrandActiveToggleProps) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleBrandActive(brandId, !isActive)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`${brandName} ${!isActive ? 'activated' : 'deactivated'}.`)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={`text-xs px-2 py-1 rounded-md font-medium transition-colors disabled:opacity-50 ${
        isActive
          ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'
      }`}
    >
      {isPending ? '…' : isActive ? 'Deactivate' : 'Activate'}
    </button>
  )
}
