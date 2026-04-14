'use client'

import { useState, useTransition } from 'react'
import { ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { AccuracyScorebar } from '@/components/dupe/AccuracyScorebar'
import { formatDate } from '@/lib/utils/format'
import { toggleHelpfulVote } from '@/lib/actions/opinion.actions'
import { toast } from 'sonner'
import type { OpinionWithProfile } from '@/lib/types/app.types'

interface OpinionCardProps {
  opinion: OpinionWithProfile
  dupeId: string
  currentUserId?: string
}

export function OpinionCard({ opinion, dupeId, currentUserId }: OpinionCardProps) {
  const profile = opinion.profile
  const initials = (profile.display_name ?? profile.username ?? '?')
    .slice(0, 2)
    .toUpperCase()

  const [userVote, setUserVote] = useState(opinion.user_vote)
  const [helpfulCount, setHelpfulCount] = useState(opinion.helpful_votes)
  const [isPending, startTransition] = useTransition()

  const handleVote = (isHelpful: boolean) => {
    if (!currentUserId) {
      toast.error('Log in to vote on opinions.')
      return
    }
    const prev = userVote
    const prevCount = helpfulCount

    // Optimistic update
    const removing = userVote === isHelpful
    setUserVote(removing ? null : isHelpful)
    setHelpfulCount(c => (removing ? c - 1 : isHelpful ? c + 1 : prev === true ? c - 1 : c + (isHelpful ? 1 : 0)))

    startTransition(async () => {
      const result = await toggleHelpfulVote(opinion.id, isHelpful, dupeId)
      if (result.error) {
        setUserVote(prev)
        setHelpfulCount(prevCount)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-semibold">
            {profile.display_name ?? profile.username}
          </span>
          {opinion.owns_both && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Owns both
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{formatDate(opinion.created_at)}</span>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <AccuracyScorebar label="Color" score={opinion.color_accuracy} count={1} />
        <AccuracyScorebar label="Finish" score={opinion.finish_accuracy} count={1} />
        <AccuracyScorebar label="Formula" score={opinion.formula_accuracy} count={1} />
      </div>

      {/* Notes */}
      {(opinion.color_notes || opinion.finish_notes || opinion.formula_notes) && (
        <div className="space-y-1 text-sm">
          {opinion.color_notes && (
            <p><span className="font-semibold text-muted-foreground">Color: </span>{opinion.color_notes}</p>
          )}
          {opinion.finish_notes && (
            <p><span className="font-semibold text-muted-foreground">Finish: </span>{opinion.finish_notes}</p>
          )}
          {opinion.formula_notes && (
            <p><span className="font-semibold text-muted-foreground">Formula: </span>{opinion.formula_notes}</p>
          )}
        </div>
      )}

      {/* Helpful votes */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-muted-foreground">Helpful?</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2"
          onClick={() => handleVote(true)}
          disabled={isPending}
          aria-pressed={userVote === true}
        >
          <ThumbsUp className={`h-3.5 w-3.5 ${userVote === true ? 'text-primary fill-primary' : ''}`} />
          <span className="text-xs tabular-nums">{helpfulCount}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2"
          onClick={() => handleVote(false)}
          disabled={isPending}
          aria-pressed={userVote === false}
        >
          <ThumbsDown className={`h-3.5 w-3.5 ${userVote === false ? 'text-destructive fill-destructive' : ''}`} />
        </Button>
      </div>
    </div>
  )
}
