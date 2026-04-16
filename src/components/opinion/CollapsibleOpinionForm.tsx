'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { OpinionForm } from './OpinionForm'
import type { DupeOpinion } from '@/lib/types/app.types'

interface CollapsibleOpinionFormProps {
  dupeId: string
  existingOpinion: DupeOpinion | null
}

export function CollapsibleOpinionForm({ dupeId, existingOpinion }: CollapsibleOpinionFormProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-accent/50 transition-colors text-left"
      >
        <div>
          <p className="font-black">
            {existingOpinion ? 'Your rating' : 'Have you tried both?'}
          </p>
          {!existingOpinion && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Share your take on how well this dupe holds up.
            </p>
          )}
          {existingOpinion && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Color {existingOpinion.color_accuracy}/5 · Finish {existingOpinion.finish_accuracy}/5 · Formula {existingOpinion.formula_accuracy}/5
            </p>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-border px-6 py-5">
          <OpinionForm
            dupeId={dupeId}
            existingOpinion={existingOpinion}
            onSuccess={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
