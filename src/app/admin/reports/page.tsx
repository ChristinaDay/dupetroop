import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminReportActions } from '@/components/admin/AdminReportActions'
import { formatDate } from '@/lib/utils/format'

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam or off-topic',
  inaccurate: 'Clearly inaccurate',
  offensive: 'Offensive content',
  other: 'Other',
}

export default async function AdminReportsPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: reports } = await db
    .from('opinion_reports')
    .select(`
      id, reason, notes, status, created_at,
      opinion:dupe_opinions(
        id, dupe_id, color_accuracy, finish_accuracy, formula_accuracy,
        color_notes, finish_notes, formula_notes,
        reporter:profiles!dupe_opinions_user_id_fkey(username, display_name)
      ),
      reporter:profiles!opinion_reports_reporter_id_fkey(username, display_name)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (
    <div>
      <h2 className="text-xl font-black mb-4">
        Flagged opinions ({(reports ?? []).length})
      </h2>
      {(reports ?? []).length === 0 ? (
        <p className="text-muted-foreground">No pending reports.</p>
      ) : (
        <div className="space-y-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(reports as any[]).map((report) => {
            const opinion = report.opinion
            const dupe_id = opinion?.dupe_id
            return (
              <div key={report.id} className="border border-border rounded-xl p-4 space-y-3">
                {/* Report header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-destructive">
                      {REASON_LABELS[report.reason] ?? report.reason}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      reported by @{report.reporter?.username ?? '?'} · {formatDate(report.created_at)}
                    </span>
                  </div>
                  {dupe_id && (
                    <Link
                      href={`/dupes/${dupe_id}`}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2 shrink-0"
                    >
                      View dupe →
                    </Link>
                  )}
                </div>

                {/* The opinion itself */}
                {opinion && (
                  <div className="bg-muted/40 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
                      <span>Color: <strong>{opinion.color_accuracy}/5</strong></span>
                      <span>Finish: <strong>{opinion.finish_accuracy}/5</strong></span>
                      <span>Formula: <strong>{opinion.formula_accuracy}/5</strong></span>
                      <span className="ml-auto">
                        by @{opinion.reporter?.username ?? '?'}
                      </span>
                    </div>
                    {(opinion.color_notes || opinion.finish_notes || opinion.formula_notes) && (
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {opinion.color_notes && <p><span className="font-semibold">Color:</span> {opinion.color_notes}</p>}
                        {opinion.finish_notes && <p><span className="font-semibold">Finish:</span> {opinion.finish_notes}</p>}
                        {opinion.formula_notes && <p><span className="font-semibold">Formula:</span> {opinion.formula_notes}</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Reporter notes */}
                {report.notes && (
                  <p className="text-xs text-muted-foreground italic">&ldquo;{report.notes}&rdquo;</p>
                )}

                <AdminReportActions reportId={report.id} opinionId={opinion?.id} dupeId={dupe_id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
