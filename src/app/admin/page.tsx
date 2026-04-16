import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { getPendingDupes } from '@/lib/queries/dupes'
import { getPendingLooks } from '@/lib/queries/looks'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const [pendingDupes, pendingLooks] = await Promise.all([
    getPendingDupes().catch(() => []),
    getPendingLooks().catch(() => []),
  ])

  const [{ count: pendingPolishes }, { count: pendingReports }] = await Promise.all([
    supabase.from('polishes').select('*', { count: 'exact', head: true }).eq('is_verified', false),
    db.from('opinion_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Link href="/admin/dupes">
        <Card className="hover:border-primary transition-colors cursor-pointer">
          <CardContent className="p-6">
            <p className="text-4xl font-black text-primary">{pendingDupes.length}</p>
            <p className="text-sm font-semibold mt-1">Pending dupes</p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/admin/polishes">
        <Card className="hover:border-primary transition-colors cursor-pointer">
          <CardContent className="p-6">
            <p className="text-4xl font-black text-primary">{pendingPolishes ?? 0}</p>
            <p className="text-sm font-semibold mt-1">Pending polishes</p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/admin/looks">
        <Card className="hover:border-primary transition-colors cursor-pointer">
          <CardContent className="p-6">
            <p className="text-4xl font-black text-primary">{pendingLooks.length}</p>
            <p className="text-sm font-semibold mt-1">Pending recipes</p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/admin/reports">
        <Card className="hover:border-primary transition-colors cursor-pointer">
          <CardContent className="p-6">
            <p className={`text-4xl font-black ${(pendingReports ?? 0) > 0 ? 'text-destructive' : ''}`}>
              {pendingReports ?? 0}
            </p>
            <p className="text-sm font-semibold mt-1">Flagged opinions</p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/admin/brands">
        <Card className="hover:border-primary transition-colors cursor-pointer">
          <CardContent className="p-6">
            <p className="text-4xl font-black">→</p>
            <p className="text-sm font-semibold mt-1">Manage brands</p>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
