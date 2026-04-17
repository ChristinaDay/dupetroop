import { ImageResponse } from 'next/og'
import { getDupeById } from '@/lib/queries/dupes'

export const alt = 'Dupe comparison on DoopTroop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PRIMARY = '#c026d3'

async function loadFont() {
  const url = 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
  const res = await fetch(url)
  return res.arrayBuffer()
}

function scoreColor(score: number | null) {
  if (score === null) return '#9ca3af'
  if (score >= 4) return '#059669'
  if (score >= 3) return '#d97706'
  return '#dc2626'
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ dupeId: string }>
}) {
  const { dupeId } = await params
  const dupe = await getDupeById(dupeId).catch(() => null)
  const fontData = await loadFont().catch(() => null)

  const a = dupe?.polish_a
  const b = dupe?.polish_b
  const score = dupe?.avg_overall ?? null

  const nameA = a?.name ?? 'Polish A'
  const nameB = b?.name ?? 'Polish B'
  const brandA = a?.brand?.name ?? ''
  const brandB = b?.brand?.name ?? ''
  const imgA = a?.images?.[0] ?? null
  const imgB = b?.images?.[0] ?? null
  const hexA = a?.hex_color ?? '#e5e7eb'
  const hexB = b?.hex_color ?? '#e5e7eb'
  const hexASecondary = a?.hex_secondary ?? null
  const hexBSecondary = b?.hex_secondary ?? null

  const bgA = hexASecondary
    ? `linear-gradient(180deg, ${hexA} 0%, ${hexASecondary} 100%)`
    : hexA
  const bgB = hexBSecondary
    ? `linear-gradient(180deg, ${hexB} 0%, ${hexBSecondary} 100%)`
    : hexB

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '1200px',
          height: '630px',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
        }}
      >
        {/* Polish A — left half */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '600px',
            height: '630px',
            background: bgA,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {imgA && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgA}
              alt={nameA}
              width={600}
              height={630}
              style={{ width: '600px', height: '630px', objectFit: 'cover', objectPosition: 'top', position: 'absolute', inset: 0 }}
            />
          )}
          {/* Gradient overlay for text legibility */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 50%)',
            }}
          />
          {/* Text */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {brandA}
            </p>
            <p style={{ fontSize: nameA.length > 20 ? '28px' : '34px', fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              {nameA}
            </p>
          </div>
        </div>

        {/* Polish B — right half */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '600px',
            height: '630px',
            background: bgB,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {imgB && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgB}
              alt={nameB}
              width={600}
              height={630}
              style={{ width: '600px', height: '630px', objectFit: 'cover', objectPosition: 'top', position: 'absolute', inset: 0 }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 50%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {brandB}
            </p>
            <p style={{ fontSize: nameB.length > 20 ? '28px' : '34px', fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              {nameB}
            </p>
          </div>
        </div>

        {/* Center divider + score badge */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {/* VS pill */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '999px',
              padding: '8px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#6b7280', letterSpacing: '0.08em' }}>VS</span>
            {score !== null && (
              <>
                <div style={{ width: '1px', height: '16px', background: '#e5e7eb' }} />
                <span style={{ fontSize: '18px', fontWeight: 900, color: scoreColor(score) }}>
                  {score.toFixed(1)}/5
                </span>
              </>
            )}
          </div>
        </div>

        {/* Top-right: DoopTroop brand */}
        <div
          style={{
            position: 'absolute',
            top: '24px',
            right: '28px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            borderRadius: '999px',
            padding: '8px 16px',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>
            Dupe<span style={{ color: PRIMARY }}>Troop</span>
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fontData ? {
        fonts: [{ name: 'Inter', data: fontData, weight: 900 }],
      } : {}),
    },
  )
}
