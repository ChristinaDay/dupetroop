import Link from 'next/link'
import { getPendingDupes } from '@/lib/queries/dupes'
import { AdminDupeList } from '@/components/admin/AdminDupeList'
import { Button } from '@/components/ui/button'

export default async function AdminDupesPage() {
  const dupes = await getPendingDupes()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black">Pending dupes ({dupes.length})</h2>
        <Button asChild size="sm">
          <Link href="/admin/dupes/new">+ Add dupe</Link>
        </Button>
      </div>
      {dupes.length === 0 ? (
        <p className="text-muted-foreground">No pending dupes.</p>
      ) : (
        <AdminDupeList dupes={dupes} />
      )}
    </div>
  )
}
