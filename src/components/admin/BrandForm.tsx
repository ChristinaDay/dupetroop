'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createBrand, updateBrand } from '@/lib/actions/brand.actions'
import { toast } from 'sonner'
import type { Brand } from '@/lib/types/app.types'

const PRICE_TIER_LABELS: Record<number, string> = {
  1: '1 — Drugstore',
  2: '2 — Mid-range',
  3: '3 — Indie standard',
  4: '4 — Premium indie',
  5: '5 — Luxury',
}

interface BrandFormProps {
  brand?: Brand
}

export function BrandForm({ brand }: BrandFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(brand?.name ?? '')
  const [slug, setSlug] = useState(brand?.slug ?? '')
  const [description, setDescription] = useState(brand?.description ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(brand?.website_url ?? '')
  const [logoUrl, setLogoUrl] = useState(brand?.logo_url ?? '')
  const [isIndie, setIsIndie] = useState(brand?.is_indie ?? true)
  const [countryOfOrigin, setCountryOfOrigin] = useState(brand?.country_of_origin ?? '')
  const [priceTier, setPriceTier] = useState<string>(brand?.price_tier?.toString() ?? '')
  const [isActive, setIsActive] = useState(brand?.is_active ?? true)

  const isEditing = Boolean(brand)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = {
      name,
      slug: slug || undefined,
      description: description || undefined,
      website_url: websiteUrl || undefined,
      logo_url: logoUrl || undefined,
      is_indie: isIndie,
      country_of_origin: countryOfOrigin || undefined,
      price_tier: priceTier ? parseInt(priceTier) : null,
      is_active: isActive,
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateBrand(brand!.id, input)
        : await createBrand(input)

      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? 'Brand updated.' : 'Brand created.')
        router.push('/admin/brands')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      {/* Name */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">Name <span className="text-destructive">*</span></label>
        <input
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Holo Taco"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          Slug
          <span className="text-muted-foreground font-normal ml-1.5">(auto-generated if blank)</span>
        </label>
        <input
          value={slug}
          onChange={e => setSlug(e.target.value)}
          placeholder="holo-taco"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="A short description of the brand…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>

      {/* Website URL */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">Website URL</label>
        <input
          type="url"
          value={websiteUrl}
          onChange={e => setWebsiteUrl(e.target.value)}
          placeholder="https://holotaco.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Logo URL */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">Logo URL</label>
        <input
          type="url"
          value={logoUrl}
          onChange={e => setLogoUrl(e.target.value)}
          placeholder="https://…/logo.png"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo preview" className="mt-2 h-12 w-12 rounded-full object-contain border border-border" />
        )}
      </div>

      {/* Country */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">Country of origin</label>
        <input
          value={countryOfOrigin}
          onChange={e => setCountryOfOrigin(e.target.value)}
          placeholder="USA"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Price tier */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">Price tier</label>
        <select
          value={priceTier}
          onChange={e => setPriceTier(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">— Not set —</option>
          {Object.entries(PRICE_TIER_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Toggles */}
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isIndie}
            onChange={e => setIsIndie(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <span className="text-sm font-semibold">Indie brand</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <span className="text-sm font-semibold">Active</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Create brand'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/admin/brands')}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
