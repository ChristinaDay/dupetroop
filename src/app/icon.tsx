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
          borderRadius: 16,
          background: '#000',
          border: '2px solid white',
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
          <span style={{ color: 'white' }}>D</span>
          <span style={{ color: '#e8359e' }}>T</span>
        </span>
      </div>
    ),
    { ...size }
  )
}
