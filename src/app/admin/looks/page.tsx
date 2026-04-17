import Link from 'next/link'
import { getPendingLooks } from '@/lib/queries/looks'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { AdminLookActions } from '@/components/admin/AdminLookActions'
import { Button } from '@/components/ui/button'
import { SourceBadge } from '@/components/look/LookCard'

export default async function AdminLooksPage() {
  const looks = await getPendingLooks()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black">Pending swaps ({looks.length})</h2>
        <Button asChild size="sm">
          <Link href="/admin/looks/new">+ New Swap</Link>
        </Button>
      </div>

      {looks.length === 0 ? (
        <p className="text-muted-foreground">No pending swaps. 🎉</p>
      ) : (
        <div className="space-y-4">
          {looks.map(look => (
            <div key={look.id} className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <SourceBadge source={look.source_type} />
                    {look.is_featured && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="font-bold">{look.name}</p>
                  {look.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {look.description}
                    </p>
                  )}
                  {look.source_url && (
                    <a
                      href={look.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-1 inline-block"
                    >
                      View source →
                    </a>
                  )}
                </div>
                {look.target_polish && (
                  <div className="flex items-center gap-2 shrink-0">
                    <PolishSwatch
                      hexColor={look.target_polish.hex_color}
                      imageUrl={look.target_polish.images?.[0] ?? null}
                      size="sm"
                    />
                    <div>
                      <p className="text-xs text-muted-foreground">Target</p>
                      <p className="text-sm font-medium">{look.target_polish.name}</p>
                    </div>
                  </div>
                )}
              </div>
              <AdminLookActions lookId={look.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
