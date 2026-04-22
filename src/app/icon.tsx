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
          background: '#000',
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
            letterSpacing: '-1px',
            lineHeight: 1,
            display: 'flex',
          }}
        >
          <span style={{ color: '#c0177a' }}>D</span>
          <span style={{ color: 'white' }}>T</span>
        </span>
      </div>
    ),
    { ...size }
  )
}
