import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BrandForm } from '@/components/admin/BrandForm'

interface PageProps {
  params: Promise<{ brandId: string }>
}

export const metadata = { title: 'Edit Brand — Admin' }

export default async function EditBrandPage({ params }: PageProps) {
  const { brandId } = await params
  const supabase = await createClient()
  const { data: brand } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .single()

  if (!brand) notFound()

  return (
    <div>
      <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
        <Link href="/admin/brands" className="hover:text-foreground">Brands</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{brand.name}</span>
      </nav>
      <h2 className="text-xl font-black mb-6">Edit brand</h2>
      <BrandForm brand={brand} />
    </div>
  )
}
