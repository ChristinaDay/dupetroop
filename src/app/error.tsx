'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    setUrl(window.location.href)
    console.error('App error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-black">Something went wrong</h1>
      {error.digest && (
        <p className="font-mono text-sm font-bold bg-muted px-3 py-1 rounded">
          Digest: {error.digest}
        </p>
      )}
      {url && (
        <p className="text-xs text-muted-foreground font-mono">on {url}</p>
      )}
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
