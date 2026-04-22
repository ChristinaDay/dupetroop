import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#c0177a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'sans-serif',
            fontWeight: 900,
            fontSize: 18,
            color: 'white',
            letterSpacing: '-1px',
            lineHeight: 1,
          }}
        >
          DT
        </span>
      </div>
    ),
    { ...size }
  )
}
