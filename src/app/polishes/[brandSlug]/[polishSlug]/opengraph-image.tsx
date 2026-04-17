import { ImageResponse } from 'next/og'
import { getPolishBySlug } from '@/lib/queries/polishes'
import { finishLabel } from '@/lib/utils/format'

export const alt = 'Polish on DoopTroop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PRIMARY = '#c026d3'
const PRIMARY_LIGHT = '#fdf4ff'

async function loadFont() {
  const url = 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
  const res = await fetch(url)
  return res.arrayBuffer()
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ brandSlug: string; polishSlug: string }>
}) {
  const { brandSlug, polishSlug } = await params
  const polish = await getPolishBySlug(brandSlug, polishSlug).catch(() => null)

  const fontData = await loadFont().catch(() => null)

  const name = polish?.name ?? 'Polish'
  const brand = polish?.brand?.name ?? ''
  const finish = polish?.finish_category ? finishLabel(polish.finish_category) : null
  const imageUrl = polish?.images?.[0] ?? null
  const hexColor = polish?.hex_color ?? '#e5e7eb'
  const hexSecondary = polish?.hex_secondary ?? null
  const dupeCount = polish?.dupe_count ?? 0

  const swatchBackground = hexSecondary
    ? `linear-gradient(135deg, ${hexColor} 0%, ${hexSecondary} 100%)`
    : hexColor

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '1200px',
          height: '630px',
          background: '#ffffff',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Left swatch / image panel */}
        <div
          style={{
            display: 'flex',
            width: '380px',
            height: '630px',
            flexShrink: 0,
            overflow: 'hidden',
            background: swatchBackground,
          }}
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={name}
              width={380}
              height={630}
              style={{ width: '380px', height: '630px', objectFit: 'cover', objectPosition: 'top' }}
            />
          )}
        </div>

        {/* Right content panel */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            padding: '56px 60px',
            justifyContent: 'space-between',
          }}
        >
          {/* Top: brand + name + finish */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: '#6b7280',
                margin: 0,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {brand}
            </p>
            <p
              style={{
                fontSize: name.length > 24 ? '52px' : '64px',
                fontWeight: 900,
                color: '#0a0a0a',
                margin: 0,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
              }}
            >
              {name}
            </p>
            {finish && (
              <div
                style={{
                  display: 'inline-flex',
                  alignSelf: 'flex-start',
                  background: PRIMARY_LIGHT,
                  color: PRIMARY,
                  fontSize: '18px',
                  fontWeight: 700,
                  padding: '6px 18px',
                  borderRadius: '999px',
                  marginTop: '4px',
                }}
              >
                {finish}
              </div>
            )}
          </div>

          {/* Middle: dupe count */}
          {dupeCount > 0 && (
            <p style={{ fontSize: '20px', color: '#6b7280', margin: 0 }}>
              <span style={{ color: PRIMARY, fontWeight: 700 }}>{dupeCount}</span>
              {' '}
              {dupeCount === 1 ? 'dupe' : 'dupes'} found by the community
            </p>
          )}

          {/* Bottom: DoopTroop branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: PRIMARY,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              ✨
            </div>
            <span style={{ fontSize: '22px', fontWeight: 900, color: '#0a0a0a', letterSpacing: '-0.01em' }}>
              Dupe<span style={{ color: PRIMARY }}>Troop</span>
            </span>
          </div>
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
