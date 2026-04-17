import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="font-display font-black text-xl tracking-tight uppercase leading-none">
            Doop<span className="text-primary">Troop</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/polishes" className="hover:text-foreground transition-colors">Polishes</Link>
            <Link href="/dupes" className="hover:text-foreground transition-colors">Dupes</Link>
            <Link href="/brands" className="hover:text-foreground transition-colors">Brands</Link>
            <Link href="/stash" className="hover:text-foreground transition-colors">My Stash</Link>
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} DoopTroop. Community-powered.
          </p>
        </div>
      </div>
    </footer>
  )
}
