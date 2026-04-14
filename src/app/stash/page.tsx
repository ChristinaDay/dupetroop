import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserStash } from '@/lib/queries/stash'
import { PolishCard } from '@/components/polish/PolishCard'
import { Button } from '@/components/ui/button'
import { CsvImportModal } from '@/components/stash/CsvImportModal'
import Link from 'next/link'

export const metadata = { title: 'My Stash — DupeTroop' }

export default async function StashPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/stash')

  const { items, total } = await getUserStash(user.id)

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black">My Stash</h1>
          <p className="text-muted-foreground mt-1">
            {total} {total === 1 ? 'polish' : 'polishes'} in your collection
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <CsvImportModal />
          {total > 0 && (
            <Button asChild variant="outline" size="sm">
              <a href="/api/stash/export">Export CSV</a>
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <p className="text-2xl font-black mb-2">Your stash is empty</p>
          <p className="text-muted-foreground mb-6">
            Start by browsing polishes and adding them to your collection.
          </p>
          <Button asChild>
            <Link href="/polishes">Browse polishes</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map(item => (
            <PolishCard key={item.id} polish={item.polish} showDupeCount />
          ))}
        </div>
      )}
    </div>
  )
}
