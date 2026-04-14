'use client'

import { useState, useTransition, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { importStashFromCSV } from '@/lib/actions/stash.actions'
import { useRouter } from 'next/navigation'

export function CsvImportModal() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      startTransition(async () => {
        const result = await importStashFromCSV(text)
        if ('error' in result) {
          setStatus(`Error: ${result.error}`)
        } else {
          setStatus(`Imported ${result.imported} polishes. ${result.skipped > 0 ? `${result.skipped} rows skipped (not found).` : ''}`)
          router.refresh()
        }
      })
    }
    reader.readAsText(file)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Import CSV
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
        <h2 className="text-xl font-black">Import from CSV</h2>
        <p className="text-sm text-muted-foreground">
          Your CSV must have <strong>brand</strong> and <strong>name</strong> columns.
          Rows that don&apos;t match a verified polish will be skipped.
        </p>
        <div className="bg-muted rounded-lg p-3 font-mono text-xs">
          brand,name<br />
          Mooncat,Bloodbender<br />
          Holo Taco,Blue Moon
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
          disabled={isPending}
        />
        {status && (
          <p className={`text-sm font-medium ${status.startsWith('Error') ? 'text-destructive' : 'text-green-600'}`}>
            {status}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => { setOpen(false); setStatus(null) }}>
            {status ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  )
}
