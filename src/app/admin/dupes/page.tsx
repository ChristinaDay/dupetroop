import { getPendingDupes } from '@/lib/queries/dupes'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { AdminDupeActions } from '@/components/admin/AdminDupeActions'

export default async function AdminDupesPage() {
  const dupes = await getPendingDupes()

  return (
    <div>
      <h2 className="text-xl font-black mb-4">Pending dupes ({dupes.length})</h2>
      {dupes.length === 0 ? (
        <p className="text-muted-foreground">No pending dupes. 🎉</p>
      ) : (
        <div className="space-y-4">
          {dupes.map(dupe => (
            <div key={dupe.id} className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <PolishSwatch hexColor={dupe.polish_a.hex_color} imageUrl={dupe.polish_a.images?.[0] ?? null} size="sm" />
                  <div>
                    <p className="text-xs text-muted-foreground">{dupe.polish_a.brand.name}</p>
                    <p className="text-sm font-bold">{dupe.polish_a.name}</p>
                  </div>
                </div>
                <span className="text-muted-foreground text-sm">≈</span>
                <div className="flex items-center gap-2">
                  <PolishSwatch hexColor={dupe.polish_b.hex_color} imageUrl={dupe.polish_b.images?.[0] ?? null} size="sm" />
                  <div>
                    <p className="text-xs text-muted-foreground">{dupe.polish_b.brand.name}</p>
                    <p className="text-sm font-bold">{dupe.polish_b.name}</p>
                  </div>
                </div>
              </div>
              {dupe.notes && (
                <p className="text-sm text-muted-foreground italic">&ldquo;{dupe.notes}&rdquo;</p>
              )}
              <AdminDupeActions dupeId={dupe.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
