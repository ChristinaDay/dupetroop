'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Menu, X, Search, ChevronDown, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SearchModal } from '@/components/search/SearchModal'
import { cn } from '@/lib/utils'

const FINISH_NAV = [
  { finish: 'holo', emoji: '🌈', label: 'Holo' },
  { finish: 'multichrome', emoji: '✨', label: 'Multichrome' },
  { finish: 'glitter', emoji: '💎', label: 'Glitter' },
  { finish: 'duochrome', emoji: '🔮', label: 'Duochrome' },
  { finish: 'flakies', emoji: '🌸', label: 'Flakies' },
  { finish: 'cream', emoji: '🍦', label: 'Cream' },
  { finish: 'shimmer', emoji: '⭐', label: 'Shimmer' },
  { finish: 'magnetic', emoji: '🧲', label: 'Magnetic' },
]

const COLOR_NAV = [
  { color: 'red', hex: '#dc2626' },
  { color: 'orange', hex: '#ea580c' },
  { color: 'yellow', hex: '#ca8a04' },
  { color: 'green', hex: '#16a34a' },
  { color: 'blue', hex: '#2563eb' },
  { color: 'purple', hex: '#9333ea' },
  { color: 'pink', hex: '#db2777' },
  { color: 'neutral', hex: '#a8a29e' },
  { color: 'black', hex: '#1c1917' },
]

interface HeaderProps {
  user: { id: string; email?: string } | null
  username?: string | null
  isAdmin?: boolean
}

export function Header({ user, username, isAdmin = false }: HeaderProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  function openDropdown(name: string) {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    setActiveDropdown(name)
  }

  function scheduleClose() {
    closeTimeoutRef.current = setTimeout(() => setActiveDropdown(null), 120)
  }

  return (
    <>
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />

      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">

        {/* Announcement bar */}
        <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-xs font-medium tracking-wide">
          Find dupes, discover recipes, track your stash —{' '}
          <Link
            href="/polishes"
            className="font-bold underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            browse polishes
          </Link>
        </div>

        {/* Main nav row */}
        <div className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between gap-4">

              {/* Logo */}
              <Link
                href="/"
                className="font-display font-black text-2xl tracking-tight shrink-0 leading-none uppercase"
              >
                Doop<span className="text-primary">Troop</span>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center">

                {/* Polishes dropdown */}
                <div
                  className="relative"
                  onMouseEnter={() => openDropdown('polishes')}
                  onMouseLeave={scheduleClose}
                >
                  <Link
                    href="/polishes"
                    className={cn(
                      'flex items-center gap-1 px-4 py-5 text-sm font-medium transition-colors hover:text-primary',
                      (pathname.startsWith('/polishes') || pathname.startsWith('/brands')) ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    Polishes
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-150',
                        activeDropdown === 'polishes' && 'rotate-180'
                      )}
                    />
                  </Link>

                  {activeDropdown === 'polishes' && (
                    <div
                      className="absolute top-full left-0"
                      onMouseEnter={() => openDropdown('polishes')}
                      onMouseLeave={scheduleClose}
                    >
                      <div className="mt-px w-72 rounded-b-xl rounded-tr-xl border border-border bg-popover shadow-lg">
                        <div className="p-4">
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            By Finish
                          </p>
                          <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
                            {FINISH_NAV.map(({ finish, emoji, label }) => (
                              <Link
                                key={finish}
                                href={`/polishes?finish=${finish}`}
                                onClick={() => setActiveDropdown(null)}
                                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                              >
                                <span className="text-base leading-none">{emoji}</span>
                                <span className="font-medium">{label}</span>
                              </Link>
                            ))}
                          </div>

                          <div className="mt-3 border-t border-border pt-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              By Color
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {COLOR_NAV.map(({ color, hex }) => (
                                <Link
                                  key={color}
                                  href={`/polishes?color=${color}`}
                                  onClick={() => setActiveDropdown(null)}
                                  title={color.charAt(0).toUpperCase() + color.slice(1)}
                                  className="h-6 w-6 rounded-full border border-border/50 hover:ring-2 hover:ring-primary hover:ring-offset-1 transition-all"
                                  style={{ background: hex }}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="mt-3 border-t border-border pt-3 flex items-center justify-between">
                            <Link
                              href="/polishes"
                              onClick={() => setActiveDropdown(null)}
                              className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                            >
                              All polishes →
                            </Link>
                            <Link
                              href="/brands"
                              onClick={() => setActiveDropdown(null)}
                              className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-primary transition-colors hover:underline"
                            >
                              Browse brands →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dupes dropdown */}
                <div
                  className="relative"
                  onMouseEnter={() => openDropdown('dupes')}
                  onMouseLeave={scheduleClose}
                >
                  <Link
                    href="/dupes"
                    className={cn(
                      'flex items-center gap-1 px-4 py-5 text-sm font-medium transition-colors hover:text-primary',
                      pathname.startsWith('/dupes') ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    Dupes
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-150',
                        activeDropdown === 'dupes' && 'rotate-180'
                      )}
                    />
                  </Link>

                  {activeDropdown === 'dupes' && (
                    <div
                      className="absolute top-full left-0"
                      onMouseEnter={() => openDropdown('dupes')}
                      onMouseLeave={scheduleClose}
                    >
                      <div className="mt-px w-48 rounded-b-xl rounded-tr-xl border border-border bg-popover shadow-lg">
                        <div className="p-2">
                          <Link
                            href="/dupes"
                            onClick={() => setActiveDropdown(null)}
                            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
                          >
                            Browse All
                          </Link>
                          <Link
                            href="/dupes?sort=top_rated"
                            onClick={() => setActiveDropdown(null)}
                            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
                          >
                            Top Rated
                          </Link>
                          <Link
                            href="/dupes?sort=newest"
                            onClick={() => setActiveDropdown(null)}
                            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
                          >
                            Recently Added
                          </Link>
                          <div className="my-1 border-t border-border" />
                          <Link
                            href="/dupes/submit"
                            onClick={() => setActiveDropdown(null)}
                            className="flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-accent transition-colors"
                          >
                            Submit a swap →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* My Stash — logged-in only */}
                {user && (
                  <Link
                    href="/stash"
                    className={cn(
                      'px-4 py-5 text-sm font-medium transition-colors hover:text-primary',
                      pathname.startsWith('/stash') ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    My Stash
                  </Link>
                )}
              </nav>

              {/* Desktop actions */}
              <div className="hidden md:flex items-center gap-3 shrink-0">
                {/* Full search bar — lg+ only */}
                <button
                  onClick={() => setSearchOpen(true)}
                  className="hidden lg:flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:border-primary/50 w-64"
                  aria-label="Search"
                >
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left truncate">Search polishes…</span>
                  <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono shrink-0">
                    ⌘K
                  </kbd>
                </button>
                {/* Icon-only search — md only */}
                <button
                  onClick={() => setSearchOpen(true)}
                  className="lg:hidden p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground"
                  aria-label="Search"
                >
                  <Search className="h-4 w-4" />
                </button>
                {user ? (
                  <>
                    {/* User dropdown */}
                    <div
                      className="relative"
                      onMouseEnter={() => openDropdown('user')}
                      onMouseLeave={scheduleClose}
                    >
                      <button
                        className={cn(
                          'flex items-center gap-1 transition-colors hover:text-primary',
                          activeDropdown === 'user' ? 'text-primary' : 'text-muted-foreground'
                        )}
                      >
                        <User className="h-5 w-5" />
                        <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', activeDropdown === 'user' && 'rotate-180')} />
                      </button>
                      {activeDropdown === 'user' && (
                        <div
                          className="absolute top-full right-0"
                          onMouseEnter={() => openDropdown('user')}
                          onMouseLeave={scheduleClose}
                        >
                          <div className="mt-2 w-44 rounded-xl border border-border bg-popover shadow-lg p-1.5">
                            <Link
                              href="/profile"
                              onClick={() => setActiveDropdown(null)}
                              className="flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
                            >
                              Profile
                            </Link>
                            {isAdmin && (
                              <Link
                                href="/admin"
                                onClick={() => setActiveDropdown(null)}
                                className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                              >
                                Admin
                              </Link>
                            )}
                            <div className="my-1 border-t border-border" />
                            <div className="flex items-center justify-between px-3 py-2">
                              <span className="text-sm font-medium">Theme</span>
                              <ThemeToggle />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <ThemeToggle />
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/login">Log in</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/signup">Sign up</Link>
                    </Button>
                  </>
                )}
              </div>

              {/* Mobile actions */}
              <div className="md:hidden flex items-center gap-1">
                <button
                  className="p-2 rounded-md hover:bg-accent"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                >
                  <Search className="h-5 w-5" />
                </button>
                <button
                  className="p-2 rounded-md hover:bg-accent"
                  onClick={() => setMobileOpen(v => !v)}
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-b border-border bg-background">
            <nav className="mx-auto max-w-7xl px-4 pb-5 pt-3 flex flex-col gap-4">

              {/* Polishes */}
              <div className="border-t border-border pt-3">
                <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Polishes
                </p>
                <Link
                  href="/polishes"
                  className="block rounded-lg px-2 py-2 text-sm font-semibold hover:bg-accent transition-colors"
                >
                  Browse All Polishes
                </Link>
                <div className="mt-1 grid grid-cols-2 gap-x-1">
                  {FINISH_NAV.map(({ finish, emoji, label }) => (
                    <Link
                      key={finish}
                      href={`/polishes?finish=${finish}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                    >
                      <span>{emoji}</span>
                      <span className="font-medium">{label}</span>
                    </Link>
                  ))}
                </div>
                <Link
                  href="/brands"
                  className="mt-1 block rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  Browse Brands
                </Link>
              </div>

              {/* Dupes */}
              <div className="border-t border-border pt-3">
                <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Dupes
                </p>
                <Link href="/dupes" className="block rounded-lg px-2 py-2 text-sm font-medium hover:bg-accent transition-colors">Browse All</Link>
                <Link href="/dupes?sort=top_rated" className="block rounded-lg px-2 py-2 text-sm font-medium hover:bg-accent transition-colors">Top Rated</Link>
                <Link href="/dupes?sort=newest" className="block rounded-lg px-2 py-2 text-sm font-medium hover:bg-accent transition-colors">Recently Added</Link>
                <Link href="/dupes/submit" className="block rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:bg-accent transition-colors">Submit a swap →</Link>
              </div>

              {/* Auth + utils */}
              <div className="border-t border-border pt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-sm text-muted-foreground">Theme</span>
                  <ThemeToggle />
                </div>
                {user ? (
                  <>
                    <Link
                      href="/stash"
                      className="px-2 py-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      My Stash
                    </Link>
                    <Link
                      href="/profile"
                      className="px-2 py-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {username ?? 'Profile'}
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        className="px-2 py-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        Admin
                      </Link>
                    )}
                  </>
                ) : (
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href="/login">Log in</Link>
                    </Button>
                    <Button asChild size="sm" className="flex-1">
                      <Link href="/signup">Sign up</Link>
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  )
}
