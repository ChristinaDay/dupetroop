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

interface TrailPoint {
  x: number
  y: number
  vx: number
  vy: number
  t: number
}

const PARTICLE_COUNT = 7000

const HOLO_BAND_PX = 160
const HOLO_AXIS_SPEED = 0.000030
const HOLO_SWEEP_SPEED = 0.000090
const HOLO_WARP = 55

const MAGNETIC_RADIUS = 130
const DIPOLE_OFFSET = 40
const MAGNETIC_STRENGTH = 0.015
const ALIGN_STRENGTH = 0.035
const ALIGN_RADIUS = 280
const DAMPING = 0.91
const MAX_SPEED = 0.38
const BASE_SPEED = 0.02

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


// Clear fluid layer — 2D tile-based refraction via analytic height-field gradient
// H(x,y,t) = three sine-wave components; ∂H/∂x and ∂H/∂y drive coupled (dx,dy) per tile
// so the displacement field is physically consistent (curl-free), not two independent waves
const FLUID_TILE = 12
const FLUID_REFRACT = 11.0     // max refraction displacement in px

const H_A1 = 0.50; const H_FX1 = 0.0040; const H_FY1 = 0.0026; const H_FT1 = 0.0000090
const H_A2 = 0.32; const H_FX2 = 0.0024; const H_FY2 = 0.0046; const H_FT2 = 0.0000120
const H_A3 = 0.18; const H_FX3 = 0.0058; const H_FY3 = 0.0018; const H_FT3 = 0.0000170
// Max Laplacian magnitude — normalises caustic threshold to [-1, +1]
const H_MAX_LAP =
  H_A1 * (H_FX1 * H_FX1 + H_FY1 * H_FY1) +
  H_A2 * (H_FX2 * H_FX2 + H_FY2 * H_FY2) +
  H_A3 * (H_FX3 * H_FX3 + H_FY3 * H_FY3)

// Caustic spots — bright halos at height-field peaks (convex hill = converging lens)
const CAUSTIC_STEP = 28
const CAUSTIC_THRESHOLD = -0.52  // normalised Laplacian; < 0 means hill = focusing
const CAUSTIC_ALPHA_MAX = 0.048
const CAUSTIC_RADIUS = 34

// Cursor trail / chromatic aberration
const TRAIL_MAX_AGE = 1200
const FLUID_TRAIL_RADIUS = 88
const FLUID_TRAIL_STRENGTH = 0.024
const FLUID_TRAIL_DECAY = 480
const CHROMA_OFFSET = 2.5
const CHROMA_ALPHA = 0.13

// Pearl palette: blue-violet → purple → fuchsia/pink
const PALETTE_HUE_A = 0.640
const PALETTE_HUE_B = 0.800
const PALETTE_HUE_C = 0.930

function paletteHue(raw: number): number {
  const t = ((raw % 1) + 1) % 1 * 3
  if (t < 1) return PALETTE_HUE_A + t * (PALETTE_HUE_B - PALETTE_HUE_A)
  if (t < 2) return PALETTE_HUE_B + (t - 1) * (PALETTE_HUE_C - PALETTE_HUE_B)
  return PALETTE_HUE_C + (t - 2) * (PALETTE_HUE_A - PALETTE_HUE_C)
}

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
      baseAlpha: 0.70 + Math.random() * 0.25,
      hueOffset: (Math.random() - 0.5) * 0.02,
      shimmerPhase: Math.random() * Math.PI * 2,
      shimmerSpeed: 0.8 + Math.random() * 1.6,
      angle: Math.random() * Math.PI,
    })
  }
  return particles
}

function lineAngleDiff(target: number, current: number): number {
  const da = target - current
  return da - Math.PI * Math.round(da / Math.PI)
}

export function MagneticGlitter() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const trailRef = useRef<TrailPoint[]>([])

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

    let offscreen: HTMLCanvasElement | null = null
    let offCtx: CanvasRenderingContext2D | null = null

    function setSize() {
      const { width, height } = container!.getBoundingClientRect()
      const w = Math.floor(width)
      const h = Math.floor(height)
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w
        canvas!.height = h
        particles = initParticles(w, h)
        offscreen = document.createElement('canvas')
        offscreen.width = w
        offscreen.height = h
        offCtx = offscreen.getContext('2d')!
      }
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const nx = e.clientX - rect.left
      const ny = e.clientY - rect.top
      const prev = mouseRef.current
      const vx = prev ? nx - prev.x : 0
      const vy = prev ? ny - prev.y : 0
      mouseRef.current = { x: nx, y: ny, vx, vy }

      const now = performance.now()
      const trail = trailRef.current
      if (!trail.length || now - trail[trail.length - 1].t > 20) {
        trail.push({ x: nx, y: ny, vx, vy, t: now })
      }
    }

    function update(t: number, dt: number) {
      const dtFactor = dt / 16.67
      const mouse = mouseRef.current
      const trail = trailRef.current
      const w = canvas!.width
      const h = canvas!.height

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        const ffRaw =
          FF_A * Math.sin(p.x * FF_F1 + t * FF_S1) * Math.cos(p.y * FF_F2 + t * FF_S2) +
          FF_B * Math.sin(p.x * FF_F3 + t * FF_S3) * Math.cos(p.y * FF_F4 + t * FF_S4)
        const ffAngle = ffRaw * FF_SCALE
        p.vx += Math.cos(ffAngle) * 0.0015 * dtFactor
        p.vy += Math.sin(ffAngle) * 0.0015 * dtFactor
        p.angle += lineAngleDiff(ffAngle, p.angle) * 0.0015 * dtFactor

        if (mouse) {
          // --- Magnetic wand: dipole alignment (unchanged) ---
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
      if (!offscreen || !offCtx) return
      const w = canvas!.width
      const h = canvas!.height

      // --- Pass 1: particles to offscreen ---
      offCtx.clearRect(0, 0, w, h)
      offCtx.lineCap = 'round'

      // Specular highlight direction tracks the cursor; falls back to upper-right
      const mouse = mouseRef.current
      const mNorm = mouse
        ? Math.sqrt((mouse.x / w - 0.5) ** 2 + (mouse.y / h - 0.5) ** 2) + 0.01
        : 1
      const catEyeLightX = mouse ? (mouse.x / w - 0.5) / mNorm : 0.707
      const catEyeLightY = mouse ? (mouse.y / h - 0.5) / mNorm : -0.707
      const holoAxis = t * HOLO_AXIS_SPEED
      const holoSweep = t * HOLO_SWEEP_SPEED
      const warpAxis = holoAxis + Math.PI * 0.4

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Cat-eye: bright zone radiates from cursor; particles perpendicular to cursor
        // direction catch the most light (mimics magnetic platelet alignment under a magnet)
        let catEye = 0
        if (mouse) {
          const mdx = mouse.x - p.x
          const mdy = mouse.y - p.y
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy)
          const proximity = Math.max(0, 1 - mdist / 380) ** 2
          const perpFactor = 0.5 + 0.5 * Math.abs(Math.sin(p.angle - Math.atan2(mdy, mdx)))
          catEye = proximity * perpFactor * 2.2
        }

        const shimmer = 0.5 + 0.5 * Math.sin(t * 0.00014 * p.shimmerSpeed + p.shimmerPhase)
        const brightness = shimmer + catEye
        const alpha = Math.min(0.95, p.baseAlpha * Math.max(0.05, 0.35 + 0.65 * brightness))

        const projPrimary = p.x * Math.cos(holoAxis) + p.y * Math.sin(holoAxis)
        const projWarp = p.x * Math.cos(warpAxis) + p.y * Math.sin(warpAxis)
        const proj = projPrimary + Math.sin(projWarp / (HOLO_BAND_PX * 1.4)) * HOLO_WARP
        const rawHue = ((proj / HOLO_BAND_PX + holoSweep + p.hueOffset) % 1 + 1) % 1
        const hue = paletteHue(rawHue)
        const lightness = 50 + shimmer * 15 + catEye * 27
        const saturation = Math.max(48, 88 - Math.max(0, lightness - 68) * 1.8)

        const strokeHalf = p.baseRadius * (1.4 + Math.max(0, catEye) * 2.2 + shimmer * 0.6)
        const strokeW = Math.max(0.3, p.baseRadius * (0.55 + 0.18 * shimmer))
        const cosA = Math.cos(p.angle)
        const sinA = Math.sin(p.angle)

        offCtx.strokeStyle = `hsl(${hue}turn ${saturation}% ${lightness}%)`
        offCtx.globalAlpha = alpha
        offCtx.lineWidth = strokeW
        offCtx.beginPath()
        offCtx.moveTo(p.x - cosA * strokeHalf, p.y - sinA * strokeHalf)
        offCtx.lineTo(p.x + cosA * strokeHalf, p.y + sinA * strokeHalf)
        offCtx.stroke()

        const specStrength = shimmer * 0.3 + Math.max(0, catEye) * 1.1
        if (specStrength > 0.06) {
          offCtx.globalAlpha = Math.min(1, p.baseAlpha * specStrength * 1.3)
          offCtx.strokeStyle = '#ffffff'
          offCtx.lineWidth = Math.max(0.25, strokeW * 0.45)
          const specHalf = strokeHalf * 0.45
          const specOx = catEyeLightX * p.baseRadius * 0.3
          const specOy = catEyeLightY * p.baseRadius * 0.3
          offCtx.beginPath()
          offCtx.moveTo(p.x + specOx - cosA * specHalf, p.y + specOy - sinA * specHalf)
          offCtx.lineTo(p.x + specOx + cosA * specHalf, p.y + specOy + sinA * specHalf)
          offCtx.stroke()
        }
      }
      offCtx.globalAlpha = 1

      // --- Pass 2: clear-fluid refraction (tile-based, height-field gradient) ---
      // Each tile samples the particle layer displaced by (∂H/∂x, ∂H/∂y) * FLUID_REFRACT.
      // Because dx and dy both come from the same scalar field H, the displacement is
      // curl-free — physically consistent with light bending through a refractive surface.
      ctx!.clearRect(0, 0, w, h)

      const trail = trailRef.current
      const now = performance.now()

      for (let ty = 0; ty < h; ty += FLUID_TILE) {
        const tileH = Math.min(FLUID_TILE, h - ty)
        const cy = ty + tileH * 0.5

        for (let tx = 0; tx < w; tx += FLUID_TILE) {
          const tileW = Math.min(FLUID_TILE, w - tx)
          const cx = tx + tileW * 0.5

          // Analytic gradient of H at tile centre
          const ph1 = cx * H_FX1 + cy * H_FY1 + t * H_FT1
          const ph2 = cx * H_FX2 + cy * H_FY2 + t * H_FT2
          const ph3 = cx * H_FX3 + cy * H_FY3 + t * H_FT3
          const c1 = Math.cos(ph1), c2 = Math.cos(ph2), c3 = Math.cos(ph3)

          let gx = H_A1 * H_FX1 * c1 + H_A2 * H_FX2 * c2 + H_A3 * H_FX3 * c3
          let gy = H_A1 * H_FY1 * c1 + H_A2 * H_FY2 * c2 + H_A3 * H_FY3 * c3

          // Cursor trail: dragging the wand disturbs the fluid surface
          for (let j = 0; j < trail.length; j++) {
            const tp = trail[j]
            const ddx = cx - tp.x, ddy = cy - tp.y
            const distSq = ddx * ddx + ddy * ddy
            if (distSq < FLUID_TRAIL_RADIUS * FLUID_TRAIL_RADIUS * 9) {
              const fade = Math.exp(-(now - tp.t) / FLUID_TRAIL_DECAY) *
                           Math.exp(-distSq / (2 * FLUID_TRAIL_RADIUS * FLUID_TRAIL_RADIUS))
              gx += tp.vx * fade * FLUID_TRAIL_STRENGTH
              gy += tp.vy * fade * FLUID_TRAIL_STRENGTH
            }
          }

          const srcX = Math.max(0, Math.min(w - tileW, tx + gx * FLUID_REFRACT))
          const srcY = Math.max(0, Math.min(h - tileH, ty + gy * FLUID_REFRACT))
          ctx!.drawImage(offscreen!, srcX, srcY, tileW, tileH, tx, ty, tileW, tileH)
        }
      }

      // --- Pass 2b: fluid surface caustics ---
      // Where the height field is convex (hill = converging lens), draw a faint warm halo.
      // Laplacian L = -(A*(Fx²+Fy²)*sin(ph) + …); negative L = hill = focusing zone.
      ctx!.globalCompositeOperation = 'screen'
      for (let cy = CAUSTIC_STEP * 0.5; cy < h; cy += CAUSTIC_STEP) {
        for (let cx = CAUSTIC_STEP * 0.5; cx < w; cx += CAUSTIC_STEP) {
          const ph1 = cx * H_FX1 + cy * H_FY1 + t * H_FT1
          const ph2 = cx * H_FX2 + cy * H_FY2 + t * H_FT2
          const ph3 = cx * H_FX3 + cy * H_FY3 + t * H_FT3
          const s1 = Math.sin(ph1), s2 = Math.sin(ph2), s3 = Math.sin(ph3)
          const lap = -(H_A1 * (H_FX1 * H_FX1 + H_FY1 * H_FY1) * s1 +
                        H_A2 * (H_FX2 * H_FX2 + H_FY2 * H_FY2) * s2 +
                        H_A3 * (H_FX3 * H_FX3 + H_FY3 * H_FY3) * s3)
          const lapNorm = lap / H_MAX_LAP
          if (lapNorm < CAUSTIC_THRESHOLD) {
            const strength = Math.min(1, (CAUSTIC_THRESHOLD - lapNorm) / 0.38)
            const a = (CAUSTIC_ALPHA_MAX * strength).toFixed(3)
            const cg = ctx!.createRadialGradient(cx, cy, 0, cx, cy, CAUSTIC_RADIUS)
            cg.addColorStop(0, `rgba(255,252,245,${a})`)
            cg.addColorStop(1, 'rgba(255,252,245,0)')
            ctx!.fillStyle = cg
            ctx!.fillRect(cx - CAUSTIC_RADIUS, cy - CAUSTIC_RADIUS, CAUSTIC_RADIUS * 2, CAUSTIC_RADIUS * 2)
          }
        }
      }
      ctx!.globalCompositeOperation = 'source-over'

      // --- Pass 3: gel surface color layer — visible presence of the clear fluid itself ---
      // Three large slow-drifting soft gradients: the iridescent quality of the gel catching light
      const gelBlobs = [
        { xf: 0.25 + 0.20 * Math.sin(t * 0.000014),        yf: 0.35 + 0.18 * Math.cos(t * 0.000010),        hue: PALETTE_HUE_A, alpha: 0.055 },
        { xf: 0.65 + 0.18 * Math.cos(t * 0.0000095 + 1.2), yf: 0.55 + 0.15 * Math.sin(t * 0.0000125 + 2.1), hue: PALETTE_HUE_B, alpha: 0.050 },
        { xf: 0.50 + 0.22 * Math.sin(t * 0.0000115 + 3.8), yf: 0.25 + 0.20 * Math.cos(t * 0.0000085 + 0.7), hue: PALETTE_HUE_C, alpha: 0.045 },
      ]
      const gelR = Math.max(w, h) * 0.50
      for (const blob of gelBlobs) {
        const bx = blob.xf * w
        const by = blob.yf * h
        const g = ctx!.createRadialGradient(bx, by, 0, bx, by, gelR)
        g.addColorStop(0,   `hsla(${blob.hue}turn, 65%, 75%, ${blob.alpha})`)
        g.addColorStop(0.5, `hsla(${blob.hue}turn, 55%, 65%, ${blob.alpha * 0.4})`)
        g.addColorStop(1,   `hsla(${blob.hue}turn, 45%, 60%, 0)`)
        ctx!.fillStyle = g
        ctx!.fillRect(0, 0, w, h)
      }

      // --- Pass 4: chromatic aberration (color fringing through clear medium) ---
      ctx!.globalAlpha = CHROMA_ALPHA
      ctx!.filter = 'hue-rotate(-30deg) saturate(1.4)'
      ctx!.drawImage(offscreen!, Math.round(CHROMA_OFFSET), 0)
      ctx!.filter = 'hue-rotate(30deg) saturate(1.4)'
      ctx!.drawImage(offscreen!, -Math.round(CHROMA_OFFSET), 0)
      ctx!.filter = 'none'
      ctx!.globalAlpha = 1

      // --- Pass 5: surface sheen (specular highlight on fluid surface) ---
      const sheenX = w * (0.35 + 0.18 * Math.sin(t * 0.000021))
      const sheenY = h * (0.28 + 0.12 * Math.cos(t * 0.000018))
      const sheenR = Math.max(w, h) * 0.55
      const sheen = ctx!.createRadialGradient(sheenX, sheenY, 0, sheenX, sheenY, sheenR)
      sheen.addColorStop(0,   'rgba(255,245,255,0.07)')
      sheen.addColorStop(0.3, 'rgba(255,240,255,0.03)')
      sheen.addColorStop(1,   'rgba(255,240,255,0)')
      ctx!.fillStyle = sheen
      ctx!.fillRect(0, 0, w, h)
    }

    function tick(timestamp: number) {
      const dt = Math.min(timestamp - lastTime, 50)
      lastTime = timestamp

      // Prune trail to TRAIL_MAX_AGE
      const now = performance.now()
      trailRef.current = trailRef.current.filter(p => now - p.t < TRAIL_MAX_AGE)

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
