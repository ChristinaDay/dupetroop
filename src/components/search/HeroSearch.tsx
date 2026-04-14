'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { SearchModal } from './SearchModal'

export function HeroSearch() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <SearchModal open={open} onOpenChange={setOpen} />
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 w-full max-w-lg rounded-xl border border-border bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-background hover:text-foreground"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search polishes, brands…</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>
    </>
  )
}
