'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  baseRadius: number
  baseAlpha: number
  color: string
  shimmerPhase: number
  shimmerSpeed: number
  angle: number
}

const PALETTE: string[] = [
  '#f59e0b', '#fbbf24', '#f0b429', '#d97706', '#f59e0b',
  '#e040fb', '#d946ef', '#e040fb',
  '#f43f5e', '#fb923c',
  '#a855f7',
  '#ffffff', '#fff8e7', '#ffffff',
]

const PARTICLE_COUNT = 4500
const MAGNETIC_RADIUS = 130
const DIPOLE_OFFSET = 40
const MAGNETIC_STRENGTH = 0.015
const ALIGN_STRENGTH = 0.035
const ALIGN_RADIUS = 280
const DAMPING = 0.93
const MAX_SPEED = 0.7
const BASE_SPEED = 0.04

const FF_A = 1.0
const FF_F1 = 0.0018
const FF_F2 = 0.0022
const FF_S1 = 0.000012
const FF_S2 = 0.000010
const FF_B = 0.5
const FF_F3 = 0.0035
const FF_F4 = 0.0028
const FF_S3 = 0.000018
const FF_S4 = 0.000015
const FF_SCALE = Math.PI / (FF_A + FF_B)

const CAT_EYE_SPEED = 0.000016
const CAT_EYE_WIDTH = 0.18

function initParticles(width: number, height: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const vel = Math.random() * Math.PI * 2
    const speed = (Math.random() * 0.5 + 0.5) * BASE_SPEED
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(vel) * speed,
      vy: Math.sin(vel) * speed,
      baseRadius: 0.3 + Math.random() * 0.9,
      baseAlpha: 0.65 + Math.random() * 0.30,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      shimmerPhase: Math.random() * Math.PI * 2,
      shimmerSpeed: 0.8 + Math.random() * 1.6,
      angle: Math.random() * Math.PI,
    })
  }
  particles.sort((a, b) => (a.color < b.color ? -1 : 1))
  return particles
}

function lineAngleDiff(target: number, current: number): number {
  const da = target - current
  return da - Math.PI * Math.round(da / Math.PI)
}

export function MagneticGlitter() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const container = canvas.parentElement
    if (!container) return

    let particles: Particle[] = []
    let animId: number
    let lastTime = 0

    function setSize() {
      const { width, height } = container!.getBoundingClientRect()
      const w = Math.floor(width)
      const h = Math.floor(height)
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w
        canvas!.height = h
        particles = initParticles(w, h)
      }
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function update(t: number, dt: number) {
      const dtFactor = dt / 16.67
      const mouse = mouseRef.current
      const w = canvas!.width
      const h = canvas!.height

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        const ffRaw =
          FF_A * Math.sin(p.x * FF_F1 + t * FF_S1) * Math.cos(p.y * FF_F2 + t * FF_S2) +
          FF_B * Math.sin(p.x * FF_F3 + t * FF_S3) * Math.cos(p.y * FF_F4 + t * FF_S4)
        const ffAngle = ffRaw * FF_SCALE
        p.vx += Math.cos(ffAngle) * 0.003 * dtFactor
        p.vy += Math.sin(ffAngle) * 0.003 * dtFactor
        p.angle += lineAngleDiff(ffAngle, p.angle) * 0.003 * dtFactor

        if (mouse) {
          const dnx = mouse.x - p.x
          const dny = mouse.y - p.y
          const rn = Math.sqrt(dnx * dnx + dny * dny) + 0.1

          if (rn < ALIGN_RADIUS) {
            const dsx = p.x - mouse.x
            const dsy = p.y - (mouse.y + DIPOLE_OFFSET)
            const rs = Math.sqrt(dsx * dsx + dsy * dsy) + 0.1

            const cn = Math.max(rn, 10)
            const cs = Math.max(rs, 10)

            const Bx = dnx / (cn * cn) + dsx / (cs * cs) * 0.45
            const By = dny / (cn * cn) + dsy / (cs * cs) * 0.45
            const Bmag = Math.sqrt(Bx * Bx + By * By)

            if (Bmag > 0.00001) {
              const alignFalloff = Math.max(0, 1 - rn / ALIGN_RADIUS)
              const fieldAngle = Math.atan2(By, Bx)
              p.angle += lineAngleDiff(fieldAngle, p.angle) * ALIGN_STRENGTH * alignFalloff * dtFactor

              const moveFalloff = Math.max(0, 1 - rn / (MAGNETIC_RADIUS * 2.5))
              if (moveFalloff > 0) {
                p.vx += (Bx / Bmag) * moveFalloff * MAGNETIC_STRENGTH * dtFactor
                p.vy += (By / Bmag) * moveFalloff * MAGNETIC_STRENGTH * dtFactor
              }
            }
          }
        }

        p.vx *= DAMPING
        p.vy *= DAMPING

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > MAX_SPEED) {
          const inv = MAX_SPEED / speed
          p.vx *= inv
          p.vy *= inv
        }

        p.x += p.vx * dtFactor
        p.y += p.vy * dtFactor

        if (p.x < -2) p.x += w + 4
        else if (p.x > w + 2) p.x -= w + 4
        if (p.y < -2) p.y += h + 4
        else if (p.y > h + 2) p.y -= h + 4
      }
    }

    function render(t: number) {
      const w = canvas!.width
      const h = canvas!.height

      ctx!.clearRect(0, 0, w, h)
      ctx!.lineCap = 'round'

      const sweep = (t * CAT_EYE_SPEED) % 1.0
      const catEyeLightX = 0.707
      const catEyeLightY = -0.707

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        const diagProj = p.x / w * 0.6 + p.y / h * 0.4
        const bandDist = Math.abs(diagProj - sweep)
        const catEye = Math.max(0, 1 - Math.min(bandDist, 1 - bandDist) / CAT_EYE_WIDTH) ** 2

        const shimmer = 0.5 + 0.5 * Math.sin(t * 0.00028 * p.shimmerSpeed + p.shimmerPhase)
        const brightness = shimmer + catEye * 2.8
        const alpha = Math.min(0.92, p.baseAlpha * (0.15 + 0.85 * brightness))

        const strokeHalf = p.baseRadius * (1.4 + catEye * 2.2 + shimmer * 0.6)
        const strokeW = Math.max(0.3, p.baseRadius * (0.55 + 0.18 * shimmer))
        const cosA = Math.cos(p.angle)
        const sinA = Math.sin(p.angle)

        ctx!.strokeStyle = p.color
        ctx!.globalAlpha = alpha
        ctx!.lineWidth = strokeW
        ctx!.beginPath()
        ctx!.moveTo(p.x - cosA * strokeHalf, p.y - sinA * strokeHalf)
        ctx!.lineTo(p.x + cosA * strokeHalf, p.y + sinA * strokeHalf)
        ctx!.stroke()

        const specStrength = shimmer * 0.3 + catEye * 1.1
        if (specStrength > 0.06) {
          ctx!.globalAlpha = Math.min(1, p.baseAlpha * specStrength * 1.3)
          ctx!.strokeStyle = '#ffffff'
          ctx!.lineWidth = Math.max(0.25, strokeW * 0.45)
          const specHalf = strokeHalf * 0.45
          const specOx = catEyeLightX * p.baseRadius * 0.3
          const specOy = catEyeLightY * p.baseRadius * 0.3
          ctx!.beginPath()
          ctx!.moveTo(p.x + specOx - cosA * specHalf, p.y + specOy - sinA * specHalf)
          ctx!.lineTo(p.x + specOx + cosA * specHalf, p.y + specOy + sinA * specHalf)
          ctx!.stroke()
        }
      }
      ctx!.globalAlpha = 1
    }

    function tick(timestamp: number) {
      const dt = Math.min(timestamp - lastTime, 50)
      lastTime = timestamp
      update(timestamp, dt)
      render(timestamp)
      animId = requestAnimationFrame(tick)
    }

    const ro = new ResizeObserver(setSize)
    ro.observe(container)
    setSize()
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    animId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full"
    />
  )
}
