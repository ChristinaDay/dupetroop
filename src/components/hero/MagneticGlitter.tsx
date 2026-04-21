'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  baseRadius: number
  baseAlpha: number
  hueOffset: number
  shimmerPhase: number
  shimmerSpeed: number
  angle: number
}

interface Smoke {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  phase: number
}

const PARTICLE_COUNT = 7000

const HOLO_BAND_PX = 160
const HOLO_AXIS_SPEED = 0.00006
const HOLO_SWEEP_SPEED = 0.00018
// Warp strength: bends the holo bands into organic curves instead of straight stripes
const HOLO_WARP = 55

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

const SMOKE_COUNT = 70
const SMOKE_SPEED = 0.018
const SMOKE_DAMPING = 0.975
const SMOKE_MAX_SPEED = 0.35
const SMOKE_MAGNET_RADIUS = 420
const SMOKE_MAGNET_STRENGTH = 0.006

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
      hueOffset: (Math.random() - 0.5) * 0.06,
      shimmerPhase: Math.random() * Math.PI * 2,
      shimmerSpeed: 0.8 + Math.random() * 1.6,
      angle: Math.random() * Math.PI,
    })
  }
  return particles
}

function initSmoke(width: number, height: number): Smoke[] {
  const smoke: Smoke[] = []
  for (let i = 0; i < SMOKE_COUNT; i++) {
    const vel = Math.random() * Math.PI * 2
    smoke.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(vel) * SMOKE_SPEED * (0.4 + Math.random() * 0.6),
      vy: Math.sin(vel) * SMOKE_SPEED * (0.4 + Math.random() * 0.6) - 0.008, // faint upward drift
      radius: 40 + Math.random() * 70,
      alpha: 0.025 + Math.random() * 0.04,
      phase: Math.random() * Math.PI * 2,
    })
  }
  return smoke
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
    let smoke: Smoke[] = []
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
        smoke = initSmoke(w, h)
      }
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function updateSmoke(dt: number) {
      const dtFactor = dt / 16.67
      const mouse = mouseRef.current
      const w = canvas!.width
      const h = canvas!.height
      for (let i = 0; i < smoke.length; i++) {
        const s = smoke[i]

        if (mouse) {
          const dx = mouse.x - s.x
          const dy = mouse.y - s.y
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1
          if (dist < SMOKE_MAGNET_RADIUS) {
            const falloff = (1 - dist / SMOKE_MAGNET_RADIUS) ** 2
            const force = SMOKE_MAGNET_STRENGTH * falloff * dtFactor
            s.vx += (dx / dist) * force
            s.vy += (dy / dist) * force
          }
        }

        s.vx *= SMOKE_DAMPING
        s.vy *= SMOKE_DAMPING
        const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy)
        if (spd > SMOKE_MAX_SPEED) {
          s.vx = s.vx / spd * SMOKE_MAX_SPEED
          s.vy = s.vy / spd * SMOKE_MAX_SPEED
        }

        s.x += s.vx * dtFactor
        s.y += s.vy * dtFactor
        const m = s.radius
        if (s.x < -m) s.x += w + m * 2
        else if (s.x > w + m) s.x -= w + m * 2
        if (s.y < -m) s.y += h + m * 2
        else if (s.y > h + m) s.y -= h + m * 2
      }
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

    function renderSmoke(t: number) {
      const holoAxis = t * HOLO_AXIS_SPEED
      const holoSweep = t * HOLO_SWEEP_SPEED
      const warpAxis = holoAxis + Math.PI * 0.4

      for (let i = 0; i < smoke.length; i++) {
        const s = smoke[i]

        // Same holo color derivation as particles — smoke blobs pick up the field color at their center
        const projPrimary = s.x * Math.cos(holoAxis) + s.y * Math.sin(holoAxis)
        const projWarp = s.x * Math.cos(warpAxis) + s.y * Math.sin(warpAxis)
        const proj = projPrimary + Math.sin(projWarp / (HOLO_BAND_PX * 1.4)) * HOLO_WARP
        const hue = ((proj / HOLO_BAND_PX + holoSweep) % 1 + 1) % 1

        const breathe = 0.75 + 0.25 * Math.sin(t * 0.00022 + s.phase)
        const a = s.alpha * breathe

        const grad = ctx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius)
        grad.addColorStop(0, `hsla(${hue}turn, 75%, 72%, ${a})`)
        grad.addColorStop(1, `hsla(${hue}turn, 75%, 72%, 0)`)
        ctx!.fillStyle = grad
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    function render(t: number) {
      const w = canvas!.width
      const h = canvas!.height

      ctx!.clearRect(0, 0, w, h)

      // Smoke layer — underneath particles
      renderSmoke(t)

      ctx!.lineCap = 'round'

      const catEyeSweep = (t * CAT_EYE_SPEED) % 1.0
      const catEyeLightX = 0.707
      const catEyeLightY = -0.707

      const holoAxis = t * HOLO_AXIS_SPEED
      const holoSweep = t * HOLO_SWEEP_SPEED
      // Perpendicular axis for 2D warp — bends straight stripes into curves
      const warpAxis = holoAxis + Math.PI * 0.4

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        const diagProj = p.x / w * 0.6 + p.y / h * 0.4
        const bandDist = Math.abs(diagProj - catEyeSweep)
        const catEye = Math.max(0, 1 - Math.min(bandDist, 1 - bandDist) / CAT_EYE_WIDTH) ** 2

        const shimmer = 0.5 + 0.5 * Math.sin(t * 0.00028 * p.shimmerSpeed + p.shimmerPhase)
        const brightness = shimmer + catEye * 2.8
        const alpha = Math.min(0.92, p.baseAlpha * (0.40 + 0.60 * brightness))

        // Primary projection + sinusoidal warp along perpendicular axis
        // makes the hue bands curve organically instead of running in straight lines
        const projPrimary = p.x * Math.cos(holoAxis) + p.y * Math.sin(holoAxis)
        const projWarp = p.x * Math.cos(warpAxis) + p.y * Math.sin(warpAxis)
        const proj = projPrimary + Math.sin(projWarp / (HOLO_BAND_PX * 1.4)) * HOLO_WARP
        const hue = ((proj / HOLO_BAND_PX + holoSweep + p.hueOffset) % 1 + 1) % 1
        const lightness = 55 + shimmer * 15 + catEye * 10

        const strokeHalf = p.baseRadius * (1.4 + catEye * 2.2 + shimmer * 0.6)
        const strokeW = Math.max(0.3, p.baseRadius * (0.55 + 0.18 * shimmer))
        const cosA = Math.cos(p.angle)
        const sinA = Math.sin(p.angle)

        ctx!.strokeStyle = `hsl(${hue}turn 85% ${lightness}%)`
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
      updateSmoke(dt)
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
