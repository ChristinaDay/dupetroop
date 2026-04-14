'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X, Sparkles, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SearchModal } from '@/components/search/SearchModal'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/polishes', label: 'Polishes' },
  { href: '/dupes', label: 'Dupes' },
  { href: '/brands', label: 'Brands' },
]

interface HeaderProps {
  user: { id: string; email?: string } | null
  username?: string | null
}

export function Header({ user, username }: HeaderProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

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

  return (
    <>
    <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-black text-xl tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>
              Dupe<span className="text-primary">Troop</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  pathname.startsWith(link.href)
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Search"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search</span>
              <kbd className="ml-1 hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground lg:inline">
                ⌘K
              </kbd>
            </button>
            <ThemeToggle />
            {user ? (
              <>
                <Button asChild size="sm">
                  <Link href="/dupes/submit">+ Submit Dupe</Link>
                </Button>
                <Link
                  href="/profile"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {username ?? 'Profile'}
                </Link>
              </>
            ) : (
              <>
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

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 pb-4 pt-2">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                  pathname.startsWith(link.href) ? 'text-primary' : ''
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-sm text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
              {user ? (
                <>
                  <Button asChild size="sm">
                    <Link href="/dupes/submit" onClick={() => setMobileOpen(false)}>
                      + Submit Dupe
                    </Link>
                  </Button>
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2 text-sm text-muted-foreground hover:text-primary"
                  >
                    {username ?? 'Profile'}
                  </Link>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>Log in</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/signup" onClick={() => setMobileOpen(false)}>Sign up</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
    </>
  )
}
