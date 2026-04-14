import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { getPendingDupes } from '@/lib/queries/dupes'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const pendingDupes = await getPendingDupes().catch(() => [])

  const { count: pendingPolishes } = await supabase
    .from('polishes')
    .select('*', { count: 'exact', head: true })
    .eq('is_verified', false)

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
