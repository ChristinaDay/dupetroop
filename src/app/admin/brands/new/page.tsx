import Link from 'next/link'
import { BrandForm } from '@/components/admin/BrandForm'

export const metadata = { title: 'Add Brand — Admin' }

export default function NewBrandPage() {
  return (
    <div>
      <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
        <Link href="/admin/brands" className="hover:text-foreground">Brands</Link>
        <span>/</span>
        <span className="text-foreground font-medium">New brand</span>
      </nav>
      <h2 className="text-xl font-black mb-6">Add brand</h2>
      <BrandForm />
    </div>
  )
}
