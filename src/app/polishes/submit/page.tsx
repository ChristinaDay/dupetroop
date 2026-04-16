'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { PolishSwatch } from '@/components/polish/PolishSwatch'
import { submitPolish } from '@/lib/actions/polish.actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useEffect } from 'react'
import type { Brand, FinishCategory, ColorFamily } from '@/lib/types/app.types'

const FINISH_CATEGORIES: { value: FinishCategory; label: string }[] = [
  { value: 'cream',       label: 'Cream' },
  { value: 'shimmer',     label: 'Shimmer' },
  { value: 'glitter',     label: 'Glitter' },
  { value: 'flakies',     label: 'Flakies' },
  { value: 'duochrome',   label: 'Duochrome' },
  { value: 'multichrome', label: 'Multichrome' },
  { value: 'holo',        label: 'Holo' },
  { value: 'magnetic',    label: 'Magnetic' },
  { value: 'jelly',       label: 'Jelly' },
  { value: 'tinted',      label: 'Tinted' },
  { value: 'matte',       label: 'Matte' },
  { value: 'satin',       label: 'Satin' },
  { value: 'topper',      label: 'Topper' },
  { value: 'other',       label: 'Other' },
]

const COLOR_FAMILIES: { value: ColorFamily; label: string }[] = [
  { value: 'red',        label: 'Red' },
  { value: 'orange',     label: 'Orange' },
  { value: 'yellow',     label: 'Yellow' },
  { value: 'green',      label: 'Green' },
  { value: 'blue',       label: 'Blue' },
  { value: 'purple',     label: 'Purple' },
  { value: 'pink',       label: 'Pink' },
  { value: 'neutral',    label: 'Neutral' },
  { value: 'white',      label: 'White' },
  { value: 'black',      label: 'Black' },
  { value: 'brown',      label: 'Brown' },
  { value: 'grey',       label: 'Grey' },
  { value: 'multicolor', label: 'Multicolor' },
]

function isValidHex(val: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(val)
}

export default function SubmitPolishPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Auth
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  // Brands
  const [brands, setBrands] = useState<Brand[]>([])
  useEffect(() => {
    createClient()
      .from('brands')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setBrands((data ?? []) as Brand[]))
  }, [])

  // Form state
  const [brandId, setBrandId] = useState('')
  const [name, setName] = useState('')
  const [finish, setFinish] = useState<FinishCategory | ''>('')
  const [colorFamily, setColorFamily] = useState<ColorFamily | ''>('')
  const [hex, setHex] = useState('')
  const [hexSecondary, setHexSecondary] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [description, setDescription] = useState('')
  const [isLimited, setIsLimited] = useState(false)

  const hexPreview = isValidHex(hex) ? hex : null
  const hexSecondaryPreview = isValidHex(hexSecondary) ? hexSecondary : null

  const canSubmit = brandId && name.trim() && finish && userId && !isPending

  const handleSubmit = () => {
    if (!canSubmit) return
    startTransition(async () => {
      const result = await submitPolish({
        brandId,
        name: name.trim(),
        finishCategory: finish as FinishCategory,
        colorFamily: (colorFamily || undefined) as ColorFamily | undefined,
        hexColor: isValidHex(hex) ? hex : undefined,
        hexSecondary: isValidHex(hexSecondary) ? hexSecondary : undefined,
        images: imageUrl ? [imageUrl] : [],
        msrpUsd: price ? parseFloat(price) : undefined,
        productUrl: productUrl.trim() || undefined,
        description: description.trim() || undefined,
        isLimited,
      })
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Polish submitted! It will appear after review.')
        router.push('/polishes')
      }
    })
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <p className="text-muted-foreground">You must be logged in to submit a polish.</p>
        <Button className="mt-4" onClick={() => router.push('/login')}>Log in</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">Submit a polish</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Submissions are reviewed by moderators before going live.
        </p>
      </div>

      <div className="space-y-6">

        {/* Brand + Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="brand">Brand <span className="text-destructive">*</span></Label>
            <Select value={brandId} onValueChange={v => setBrandId(v ?? '')}>
              <SelectTrigger id="brand" className="w-full">
                <SelectValue placeholder="Select brand…" />
              </SelectTrigger>
              <SelectContent>
                {brands.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Bloodbender"
            />
          </div>
        </div>

        {/* Finish + Color family */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="finish">Finish <span className="text-destructive">*</span></Label>
            <Select value={finish || undefined} onValueChange={v => setFinish((v ?? '') as FinishCategory)}>
              <SelectTrigger id="finish" className="w-full">
                <SelectValue placeholder="Select finish…" />
              </SelectTrigger>
              <SelectContent>
                {FINISH_CATEGORIES.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color-family">Color family</Label>
            <Select value={colorFamily || undefined} onValueChange={v => setColorFamily((v ?? '') as ColorFamily)}>
              <SelectTrigger id="color-family" className="w-full">
                <SelectValue placeholder="Select color…" />
              </SelectTrigger>
              <SelectContent>
                {COLOR_FAMILIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Hex colors */}
        <div className="space-y-1.5">
          <Label>Hex color</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div
                  className="h-7 w-7 rounded-md border border-border shrink-0 transition-colors"
                  style={{ backgroundColor: hexPreview ?? 'transparent' }}
                />
                <Input
                  value={hex}
                  onChange={e => setHex(e.target.value)}
                  placeholder="#A8167D"
                  maxLength={7}
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground pl-9">Primary color</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div
                  className="h-7 w-7 rounded-md border border-border shrink-0 transition-colors"
                  style={{ backgroundColor: hexSecondaryPreview ?? 'transparent' }}
                />
                <Input
                  value={hexSecondary}
                  onChange={e => setHexSecondary(e.target.value)}
                  placeholder="#3A1F8A"
                  maxLength={7}
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground pl-9">Secondary (duochrome)</p>
            </div>
          </div>
          {(hexPreview || hexSecondaryPreview) && (
            <div className="flex items-center gap-2 pt-1">
              <PolishSwatch
                hexColor={hexPreview}
                hexSecondary={hexSecondaryPreview}
                imageUrl={null}
                size="md"
              />
              <p className="text-xs text-muted-foreground">Preview</p>
            </div>
          )}
        </div>

        {/* Image upload */}
        <div className="space-y-1.5">
          <Label>Swatch image</Label>
          <ImageUpload
            value={imageUrl}
            onChange={setImageUrl}
            userId={userId}
          />
        </div>

        {/* Price + Product URL */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="price">Price (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="13.00"
                className="pl-6"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-url">Product URL</Label>
            <Input
              id="product-url"
              type="url"
              value={productUrl}
              onChange={e => setProductUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Anything worth noting about this polish — formula, special effect, collection context…"
            rows={3}
          />
        </div>

        {/* Flags */}
        <div className="flex items-center gap-2">
          <input
            id="limited"
            type="checkbox"
            checked={isLimited}
            onChange={e => setIsLimited(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <Label htmlFor="limited" className="font-normal cursor-pointer">
            Limited edition / seasonal release
          </Label>
        </div>

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {isPending ? 'Submitting…' : 'Submit polish'}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Submissions are reviewed before going live. Fields marked <span className="text-destructive">*</span> are required.
        </p>
      </div>
    </div>
  )
}
