'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StarRating } from './StarRating'
import { upsertOpinion, deleteOpinion } from '@/lib/actions/opinion.actions'
import { toast } from 'sonner'
import type { DupeOpinion } from '@/lib/types/app.types'

const schema = z.object({
  colorAccuracy: z.number().min(1).max(5),
  finishAccuracy: z.number().min(1).max(5),
  formulaAccuracy: z.number().min(1).max(5),
  colorNotes: z.string().max(500).optional(),
  finishNotes: z.string().max(500).optional(),
  formulaNotes: z.string().max(500).optional(),
  ownsBoth: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface OpinionFormProps {
  dupeId: string
  existingOpinion?: DupeOpinion | null
  onSuccess?: () => void
}

export function OpinionForm({ dupeId, existingOpinion, onSuccess }: OpinionFormProps) {
  const [isPending, startTransition] = useTransition()
  const [isDeleting, setIsDeleting] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      colorAccuracy: existingOpinion?.color_accuracy ?? 0,
      finishAccuracy: existingOpinion?.finish_accuracy ?? 0,
      formulaAccuracy: existingOpinion?.formula_accuracy ?? 0,
      colorNotes: existingOpinion?.color_notes ?? '',
      finishNotes: existingOpinion?.finish_notes ?? '',
      formulaNotes: existingOpinion?.formula_notes ?? '',
      ownsBoth: existingOpinion?.owns_both ?? false,
    },
  })

  const colorAccuracy = watch('colorAccuracy')
  const finishAccuracy = watch('finishAccuracy')
  const formulaAccuracy = watch('formulaAccuracy')

  const onSubmit = (values: FormValues) => {
    if (!values.colorAccuracy || !values.finishAccuracy || !values.formulaAccuracy) {
      toast.error('Please rate all three dimensions.')
      return
    }

    startTransition(async () => {
      const result = await upsertOpinion({
        dupeId,
        colorAccuracy: values.colorAccuracy,
        finishAccuracy: values.finishAccuracy,
        formulaAccuracy: values.formulaAccuracy,
        colorNotes: values.colorNotes,
        finishNotes: values.finishNotes,
        formulaNotes: values.formulaNotes,
        ownsBoth: values.ownsBoth,
      })

      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(existingOpinion ? 'Rating updated!' : 'Rating submitted!')
        onSuccess?.()
      }
    })
  }

  const handleDelete = async () => {
    if (!existingOpinion) return
    setIsDeleting(true)
    const result = await deleteOpinion(existingOpinion.id, dupeId)
    setIsDeleting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Rating removed.')
      onSuccess?.()
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-4">
        <StarRating
          label="Color accuracy"
          value={colorAccuracy}
          onChange={v => setValue('colorAccuracy', v)}
        />
        <Textarea
          {...register('colorNotes')}
          placeholder="e.g. Spot-on in artificial light, slightly warmer in sunlight…"
          rows={2}
          className="text-sm"
        />
        {errors.colorNotes && <p className="text-xs text-destructive">{errors.colorNotes.message}</p>}

        <StarRating
          label="Finish accuracy"
          value={finishAccuracy}
          onChange={v => setValue('finishAccuracy', v)}
        />
        <Textarea
          {...register('finishNotes')}
          placeholder="e.g. Glitter density is slightly lower but scatter is similar…"
          rows={2}
          className="text-sm"
        />

        <StarRating
          label="Formula accuracy"
          value={formulaAccuracy}
          onChange={v => setValue('formulaAccuracy', v)}
        />
        <Textarea
          {...register('formulaNotes')}
          placeholder="e.g. Thinner consistency, needs an extra coat for full opacity…"
          rows={2}
          className="text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ownsBoth"
          {...register('ownsBoth')}
          className="h-4 w-4 accent-primary"
        />
        <Label htmlFor="ownsBoth" className="text-sm cursor-pointer">
          I own both polishes
        </Label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : existingOpinion ? 'Update rating' : 'Submit rating'}
        </Button>
        {existingOpinion && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isDeleting}
            onClick={handleDelete}
            className="text-destructive hover:text-destructive"
          >
            {isDeleting ? 'Removing…' : 'Remove rating'}
          </Button>
        )}
      </div>
    </form>
  )
}
