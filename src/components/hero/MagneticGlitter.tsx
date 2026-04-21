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
}

// Magnetic polish palette: warm gold shimmer, hot magenta, rose copper, deep purple, white sparkle
const PALETTE: string[] = [
  '#f59e0b', '#fbbf24', '#f0b429', '#d97706', '#f59e0b',
  '#e040fb', '#d946ef', '#e040fb',
  '#f43f5e', '#fb923c',
  '#a855f7',
  '#ffffff', '#fff8e7', '#ffffff',
]

const PARTICLE_COUNT = 2500
const MAGNETIC_RADIUS = 80
const DIPOLE_OFFSET = 40         // px — separation between poles
const MAGNETIC_POWER = 1.5
const MAGNETIC_STRENGTH = 0.08
const DAMPING = 0.965            // high damping = thick fluid
const MAX_SPEED = 0.7
const BASE_SPEED = 0.07

// Flow field — very slow organic drift
const FF_A = 1.0
const FF_F1 = 0.0018
const FF_F2 = 0.0022
const FF_S1 = 0.000012           // 10x slower time coefficients
const FF_S2 = 0.000010
const FF_B = 0.5
const FF_F3 = 0.0035
const FF_F4 = 0.0028
const FF_S3 = 0.000018
const FF_S4 = 0.000015
const FF_SCALE = Math.PI / (FF_A + FF_B)

// Background micro-texture (ambient surface undulation)
const EMITTER_COUNT = 4
const TILE = 6
const EM_AMP = 3.5
const EM_K = 0.040
const EM_OMEGA = 0.0006
const EM_DECAY = 0.0022

// Mouse drag trail
const MAX_TRAIL = 32
const TRAIL_TAU = 800             // ms — how long a swirl persists
const TRAIL_SIGMA_SQ = 100 * 100  // spatial influence radius squared
const DRAG_AMP = 12               // pixels of drag displacement
const VORTEX_AMP = 9              // pixels of rotational displacement
const TRAIL_MAX_SPEED = 50        // cap stored velocity magnitude
const TRAIL_R2_CUTOFF = 280 * 280 // skip tiles too far from trail point

// Particle drag — mouse movement pushes nearby particles along
const DRAG_RADIUS = 65
const DRAG_RADIUS_SQ = DRAG_RADIUS * DRAG_RADIUS
const DRAG_STRENGTH = 0.055

// Cat-eye band — slowly sweeping diagonal shimmer
const CAT_EYE_SPEED = 0.000016
const CAT_EYE_WIDTH = 0.18

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
    })
  }
  particles.sort((a, b) => (a.color < b.color ? -1 : 1))
  return particles
}

export function MagneticGlitter() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

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

    const offscreen = document.createElement('canvas')
    const offCtx = offscreen.getContext('2d')!

    // Ambient background emitters
    const emX = new Float32Array(EMITTER_COUNT)
    const emY = new Float32Array(EMITTER_COUNT)
    const emVX = new Float32Array(EMITTER_COUNT)
    const emVY = new Float32Array(EMITTER_COUNT)
    const emPhase = new Float32Array(EMITTER_COUNT)

    function initEmitters(w: number, h: number) {
      for (let e = 0; e < EMITTER_COUNT; e++) {
        emX[e] = (e + 0.5) / EMITTER_COUNT * w + (Math.random() - 0.5) * w * 0.25
        emY[e] = h * (0.15 + Math.random() * 0.7)
        emVX[e] = (Math.random() - 0.5) * 0.04
        emVY[e] = (Math.random() - 0.5) * 0.03
        emPhase[e] = (e / EMITTER_COUNT) * Math.PI * 2
      }
    }

    // Mouse drag trail — ring buffer of recent positions + velocities
    const trailX = new Float32Array(MAX_TRAIL)
    const trailY = new Float32Array(MAX_TRAIL)
    const trailVX = new Float32Array(MAX_TRAIL)
    const trailVY = new Float32Array(MAX_TRAIL)
    const trailTime = new Float32Array(MAX_TRAIL)
    let trailHead = 0
    let trailSize = 0

    function setSize() {
      const { width, height } = container!.getBoundingClientRect()
      const w = Math.floor(width)
      const h = Math.floor(height)
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w
        canvas!.height = h
        offscreen.width = w
        offscreen.height = h
        particles = initParticles(w, h)
        initEmitters(w, h)
      }
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const nx = e.clientX - rect.left
      const ny = e.clientY - rect.top
      const prev = mouseRef.current

      // First event — just record position, don't generate a trail point
      if (!prev) {
        mouseRef.current = { x: nx, y: ny, vx: 0, vy: 0 }
        return
      }

      let vx = nx - prev.x
      let vy = ny - prev.y
      const speed = Math.sqrt(vx * vx + vy * vy)

      mouseRef.current = { x: nx, y: ny, vx, vy }

      if (speed < 0.8) return  // skip jitter

      // Cap velocity so fast swipes don't blow out the displacement
      if (speed > TRAIL_MAX_SPEED) {
        const s = TRAIL_MAX_SPEED / speed
        vx *= s; vy *= s
      }

      const idx = trailHead % MAX_TRAIL
      trailX[idx] = nx
      trailY[idx] = ny
      trailVX[idx] = vx
      trailVY[idx] = vy
      trailTime[idx] = performance.now()
      trailHead = (trailHead + 1) % MAX_TRAIL
      trailSize = Math.min(trailSize + 1, MAX_TRAIL)
    }

    function update(t: number, dt: number) {
      const dtFactor = dt / 16.67
      const mouse = mouseRef.current
      const w = canvas!.width
      const h = canvas!.height
      const magRadSq = MAGNETIC_RADIUS * MAGNETIC_RADIUS

      // Drift emitters
      for (let e = 0; e < EMITTER_COUNT; e++) {
        emX[e] += emVX[e] * dtFactor
        emY[e] += emVY[e] * dtFactor
        if (emX[e] < 0)  { emX[e] = 0;  emVX[e] = Math.abs(emVX[e]) }
        else if (emX[e] > w) { emX[e] = w; emVX[e] = -Math.abs(emVX[e]) }
        if (emY[e] < 0)  { emY[e] = 0;  emVY[e] = Math.abs(emVY[e]) }
        else if (emY[e] > h) { emY[e] = h; emVY[e] = -Math.abs(emVY[e]) }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Flow field — glacially slow organic drift
        const ffRaw =
          FF_A * Math.sin(p.x * FF_F1 + t * FF_S1) * Math.cos(p.y * FF_F2 + t * FF_S2) +
          FF_B * Math.sin(p.x * FF_F3 + t * FF_S3) * Math.cos(p.y * FF_F4 + t * FF_S4)
        const ffAngle = ffRaw * FF_SCALE
        p.vx += Math.cos(ffAngle) * 0.003 * dtFactor
        p.vy += Math.sin(ffAngle) * 0.003 * dtFactor

        if (!mouse) continue

        // Dipole field: superimpose north (attracts) + south (repels)
        // Particles follow the combined field vector → natural curved field lines
        const dnx = mouse.x - p.x
        const dny = mouse.y - p.y
        const rn = Math.sqrt(dnx * dnx + dny * dny) + 0.1

        if (rn < MAGNETIC_RADIUS * 2.5) {
          const dsx = p.x - mouse.x
          const dsy = p.y - (mouse.y + DIPOLE_OFFSET)
          const rs = Math.sqrt(dsx * dsx + dsy * dsy) + 0.1

          // 1/r² field from each pole, clamped near the poles to avoid singularity
          const cn = Math.max(rn, 10)
          const cs = Math.max(rs, 10)
          const Bx = dnx / (cn * cn) + dsx / (cs * cs) * 0.45
          const By = dny / (cn * cn) + dsy / (cs * cs) * 0.45
          const Bmag = Math.sqrt(Bx * Bx + By * By)

          if (Bmag > 0.00001) {
            const falloff = Math.max(0, 1 - rn / (MAGNETIC_RADIUS * 2.5))
            const fScale = falloff * MAGNETIC_STRENGTH * dtFactor
            p.vx += (Bx / Bmag) * fScale
            p.vy += (By / Bmag) * fScale
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

      // --- Pass 1: particles to offscreen ---
      offCtx.clearRect(0, 0, w, h)

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
        const radius = Math.max(0.5, p.baseRadius * (0.55 + 0.45 * shimmer + 0.25 * catEye))
        const alpha = Math.min(0.92, p.baseAlpha * (0.15 + 0.85 * brightness))

        offCtx.fillStyle = p.color
        offCtx.globalAlpha = alpha
        offCtx.beginPath()
        offCtx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        offCtx.fill()

        const specStrength = shimmer * 0.3 + catEye * 1.1
        if (specStrength > 0.06) {
          offCtx.globalAlpha = Math.min(1, p.baseAlpha * specStrength * 1.5)
          offCtx.fillStyle = '#ffffff'
          offCtx.beginPath()
          offCtx.arc(
            p.x + catEyeLightX * radius * 0.4,
            p.y + catEyeLightY * radius * 0.4,
            radius * 0.35,
            0, Math.PI * 2
          )
          offCtx.fill()
        }
      }
      offCtx.globalAlpha = 1

      // --- Pass 2: displacement field ---
      // Background: ambient wave texture from slow emitters
      // Mouse: drag trail creates directional smear + trailing vortex swirl
      ctx!.clearRect(0, 0, w, h)
      const now = performance.now()

      for (let ty = 0; ty < h; ty += TILE) {
        const th = Math.min(TILE, h - ty)
        const cy = ty + th * 0.5
        for (let tx = 0; tx < w; tx += TILE) {
          const tw = Math.min(TILE, w - tx)
          const cx = tx + tw * 0.5

          let gdx = 0
          let gdy = 0

          // Ambient background undulation
          for (let e = 0; e < EMITTER_COUNT; e++) {
            const ddx = cx - emX[e]
            const ddy = cy - emY[e]
            const r = Math.sqrt(ddx * ddx + ddy * ddy) + 0.1
            const envelope = Math.exp(-r * EM_DECAY)
            const wave = Math.cos(r * EM_K - t * EM_OMEGA + emPhase[e])
            const contrib = envelope * wave * EM_AMP
            gdx += contrib * ddx / r
            gdy += contrib * ddy / r
          }

          // Drag trail — each recent mouse position contributes:
          //   1. Drag: push tiles in the direction the mouse was moving
          //   2. Vortex: tangential rotation around the trail point (trailing swirl)
          for (let ti = 0; ti < trailSize; ti++) {
            const idx = (trailHead - 1 - ti + MAX_TRAIL) % MAX_TRAIL
            const age = now - trailTime[idx]
            if (age > TRAIL_TAU * 3.5) break  // older points contribute nothing

            const ddx = cx - trailX[idx]
            const ddy = cy - trailY[idx]
            const dist2 = ddx * ddx + ddy * ddy
            if (dist2 > TRAIL_R2_CUTOFF) continue

            const timeFade = Math.exp(-age / TRAIL_TAU)
            const distFade = Math.exp(-dist2 / (2 * TRAIL_SIGMA_SQ))
            const r = Math.sqrt(dist2) + 0.1

            const tvx = trailVX[idx]
            const tvy = trailVY[idx]
            const tspeed = Math.sqrt(tvx * tvx + tvy * tvy)
            if (tspeed < 0.5) continue

            const fade = timeFade * distFade

            // Drag: smear tiles in the movement direction
            gdx += (tvx / tspeed) * fade * DRAG_AMP
            gdy += (tvy / tspeed) * fade * DRAG_AMP
          }

          ctx!.drawImage(offscreen, tx, ty, tw, th, tx + Math.round(gdx), ty + Math.round(gdy), tw, th)
        }
      }
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
