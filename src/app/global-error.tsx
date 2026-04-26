'use client'

import { useEffect, useState } from 'react'

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
    console.error('Global app error:', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Something went wrong</h1>
        {error.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700, background: '#f0f0f0', padding: '0.25rem 0.75rem', borderRadius: '0.25rem' }}>
            Digest: {error.digest}
          </p>
        )}
        {url && (
          <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#666' }}>on {url}</p>
        )}
        <button onClick={reset} style={{ padding: '0.5rem 1rem', fontWeight: 700, cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  )
}
