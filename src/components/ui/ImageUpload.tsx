'use client'

import { useRef, useState, DragEvent, ChangeEvent } from 'react'
import { Upload, X, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface ImageUploadProps {
  value: string | null        // current public URL (or null)
  onChange: (url: string | null) => void
  userId: string
  bucket?: string
  className?: string
}

export function ImageUpload({
  value,
  onChange,
  userId,
  bucket = 'polish-images',
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setError(null)
    setUploading(true)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/${Date.now()}.${ext}`
    const supabase = createClient()

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    onChange(data.publicUrl)
    setUploading(false)
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.')
      return
    }
    upload(file)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0])
    e.target.value = '' // reset so same file can be re-selected
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const handleRemove = async () => {
    if (!value) return
    // Best-effort delete from storage — don't block the UX on failure
    try {
      const supabase = createClient()
      const url = new URL(value)
      // path after /object/public/{bucket}/
      const pathMatch = url.pathname.match(new RegExp(`/object/public/${bucket}/(.+)`))
      if (pathMatch?.[1]) {
        await supabase.storage.from(bucket).remove([decodeURIComponent(pathMatch[1])])
      }
    } catch {
      // ignore — file may already be gone
    }
    onChange(null)
  }

  if (value) {
    return (
      <div className={`relative rounded-xl overflow-hidden border border-border ${className ?? ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Swatch preview" className="w-full h-48 object-cover" />
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-2 right-2 rounded-full bg-background/80 backdrop-blur-sm border border-border p-1 hover:bg-background transition-colors"
          aria-label="Remove image"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
          h-48 cursor-pointer transition-colors select-none
          ${dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-accent/50'
          }
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        {uploading ? (
          <>
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading…</p>
          </>
        ) : (
          <>
            <div className="rounded-full bg-muted p-3">
              {dragging ? <ImageIcon className="h-5 w-5 text-primary" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">
                {dragging ? 'Drop to upload' : 'Upload swatch image'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drag & drop or click — JPG, PNG, WebP up to 5 MB
              </p>
            </div>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />
      {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
    </div>
  )
}
