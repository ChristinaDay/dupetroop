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
  noiseOffsetX: number
  noiseOffsetY: number
}

const PALETTE: string[] = [
  '#e040fb', '#d946ef', '#e040fb', '#d946ef', '#d946ef',
  '#f0e040', '#f0e040',
  '#22d3ee', '#22d3ee', '#0bc5c5', '#0bc5c5',
  '#ffffff', '#ffffff', '#e0e0ff',
]

const PARTICLE_COUNT = 2500
const MAGNETIC_RADIUS = 180
const MAGNETIC_POWER = 1.5
const MAGNETIC_STRENGTH = 0.18
const DAMPING = 0.92
const MAX_SPEED = 3.5
const BASE_SPEED = 0.35

const FF_A = 1.0
const FF_F1 = 0.0018
const FF_F2 = 0.0022
const FF_S1 = 0.00045
const FF_S2 = 0.00038
const FF_B = 0.5
const FF_F3 = 0.0035
const FF_F4 = 0.0028
const FF_S3 = 0.00062
const FF_S4 = 0.00055
const FF_SCALE = Math.PI / (FF_A + FF_B)

function initParticles(width: number, height: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = (Math.random() * 0.5 + 0.5) * BASE_SPEED
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      baseRadius: 1.0 + Math.random() * 1.5,
      baseAlpha: 0.55 + Math.random() * 0.40,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      shimmerPhase: Math.random() * Math.PI * 2,
      shimmerSpeed: 0.8 + Math.random() * 1.6,
      noiseOffsetX: Math.random() * 1000,
      noiseOffsetY: Math.random() * 1000,
    })
  }
  particles.sort((a, b) => (a.color < b.color ? -1 : 1))
  return particles
}

export function MagneticGlitter() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 })

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
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }

    function update(t: number, dt: number) {
      const dtFactor = dt / 16.67
      const mouse = mouseRef.current
      const w = canvas!.width
      const h = canvas!.height
      const magRadSq = MAGNETIC_RADIUS * MAGNETIC_RADIUS

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Flow field
        const ffRaw =
          FF_A * Math.sin(p.x * FF_F1 + t * FF_S1) * Math.cos(p.y * FF_F2 + t * FF_S2) +
          FF_B * Math.sin(p.x * FF_F3 + t * FF_S3) * Math.cos(p.y * FF_F4 + t * FF_S4)
        const ffAngle = ffRaw * FF_SCALE
        p.vx += Math.cos(ffAngle) * 0.018 * dtFactor
        p.vy += Math.sin(ffAngle) * 0.018 * dtFactor

        // Magnetic force
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const distSq = dx * dx + dy * dy
        if (distSq < magRadSq && distSq > 0.01) {
          const dist = Math.sqrt(distSq)
          const tFrac = 1 - dist / MAGNETIC_RADIUS
          const force = Math.pow(tFrac, MAGNETIC_POWER) * MAGNETIC_STRENGTH * dtFactor
          const invDist = 1 / dist
          p.vx += dx * invDist * force
          p.vy += dy * invDist * force
        }

        // Damping
        p.vx *= DAMPING
        p.vy *= DAMPING

        // Speed cap
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > MAX_SPEED) {
          const inv = MAX_SPEED / speed
          p.vx *= inv
          p.vy *= inv
        }

        // Integrate
        p.x += p.vx * dtFactor
        p.y += p.vy * dtFactor

        // Edge wrap
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

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const shimmer = 0.5 + 0.5 * Math.sin(t * 0.001 * p.shimmerSpeed + p.shimmerPhase)
        const radius = Math.max(0.5, p.baseRadius * (0.6 + 0.4 * shimmer))
        const alpha = p.baseAlpha * (0.3 + 0.7 * shimmer)

        ctx!.globalAlpha = alpha
        ctx!.fillStyle = p.color
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx!.fill()
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
