import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserStashSummary } from '@/lib/queries/stash'
import { PolishCard } from '@/components/polish/PolishCard'
import { StashPolishCard } from '@/components/stash/StashPolishCard'
import { Button } from '@/components/ui/button'
import { CsvImportModal } from '@/components/stash/CsvImportModal'
import { AddPolishModal } from '@/components/stash/AddPolishModal'
import Link from 'next/link'
import type { StashStatus, StashItemWithPolish } from '@/lib/types/app.types'

export const metadata = { title: 'My Stash — DupeTroop' }

const TABS: { value: StashStatus; label: string; emptyHeading: string; emptyBody: string }[] = [
  {
    value: 'owned',
    label: 'Owned',
    emptyHeading: 'Nothing in your collection yet',
    emptyBody: 'Add polishes you own to track your collection value and unlock recipe matching.',
  },
  {
    value: 'wishlist',
    label: 'Wishlist',
    emptyHeading: 'Your wishlist is empty',
    emptyBody: 'Save polishes you want to buy and we\'ll track how much you need to save.',
  },
  {
    value: 'bookmarked',
    label: 'Bookmarked',
    emptyHeading: 'No bookmarks yet',
    emptyBody: 'Bookmark polishes you\'re researching or keeping an eye on.',
  },
  {
    value: 'destashed',
    label: 'Destashed',
    emptyHeading: 'Nothing destashed yet',
    emptyBody: 'Polishes you\'ve used up or passed on live here. Their ratings still count.',
  },
]

function formatMoney(cents: number) {
  return `$${cents.toFixed(2)}`
}

function StashStats({ status, value, unknownCount, total }: {
  status: StashStatus
  value: number
  unknownCount: number
  total: number
}) {
  if (total === 0) return null

  const hasValue = value > 0
  const unknownNote = unknownCount > 0
    ? ` (${unknownCount} ${unknownCount === 1 ? 'polish' : 'polishes'} without a listed price)`
    : ''

  if (status === 'owned') {
    return (
      <div className="mb-6 rounded-2xl bg-accent/50 border border-border px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Collection value</p>
        {hasValue ? (
          <p className="text-2xl font-black">
            {unknownCount > 0 ? 'At least ' : ''}{formatMoney(value)}
            <span className="text-sm font-normal text-muted-foreground ml-2">{unknownNote}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No pricing data available for your polishes yet.</p>
        )}
      </div>
    )
  }

  if (status === 'wishlist') {
    return (
      <div className="mb-6 rounded-2xl bg-primary/5 border border-primary/20 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">To complete your wishlist</p>
        {hasValue ? (
          <p className="text-2xl font-black text-primary">
            {unknownCount > 0 ? 'At least ' : ''}{formatMoney(value)}
            <span className="text-sm font-normal text-muted-foreground ml-2">{unknownNote}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No pricing data available for your wishlist polishes yet.</p>
        )}
      </div>
    )
  }

  return null
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function StashPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/stash')

  const { tab: tabParam } = await searchParams
  const activeTab: StashStatus = (['wishlist', 'bookmarked', 'destashed'] as StashStatus[]).includes(tabParam as StashStatus)
    ? tabParam as StashStatus
    : 'owned'

  const summary = await getUserStashSummary(user.id)
  const totalAll = summary.owned.items.length + summary.wishlist.items.length + summary.bookmarked.items.length

  const activeData = summary[activeTab]
  const activeItems: StashItemWithPolish[] = activeData.items

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black">My Stash</h1>
          <p className="text-muted-foreground mt-1">
            {totalAll} {totalAll === 1 ? 'polish' : 'polishes'} tracked
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <AddPolishModal />
          <CsvImportModal />
          {totalAll > 0 && (
            <Button asChild variant="outline" size="sm">
              <a href="/api/stash/export">Export CSV</a>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map(tab => {
          const count = summary[tab.value].items.length
          const isActive = tab.value === activeTab
          return (
            <Link
              key={tab.value}
              href={`/stash?tab=${tab.value}`}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
                  isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Spending stats */}
      <StashStats
        status={activeTab}
        value={activeData.value}
        unknownCount={activeData.unknownCount}
        total={activeItems.length}
      />

      {/* Grid or empty state */}
      {activeItems.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <p className="text-2xl font-black mb-2">
            {TABS.find(t => t.value === activeTab)!.emptyHeading}
          </p>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            {TABS.find(t => t.value === activeTab)!.emptyBody}
          </p>
          <Button asChild>
            <Link href="/polishes">Browse polishes</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {activeItems.map(item => {
            if (activeTab === 'owned') return <StashPolishCard key={item.id} item={item} />
            if (activeTab === 'destashed') return (
              <div key={item.id} className="flex flex-col opacity-70 hover:opacity-100 transition-opacity">
                <PolishCard polish={item.polish} showDupeCount />
                <Link
                  href={`/polishes/${item.polish.brand.slug}/${item.polish.slug}#dupes`}
                  className="mt-1.5 text-center text-[11px] font-semibold text-primary hover:underline"
                >
                  Find a dupe →
                </Link>
              </div>
            )
            return <PolishCard key={item.id} polish={item.polish} showDupeCount />
          })}
        </div>
      )}
    </div>
  )
}
