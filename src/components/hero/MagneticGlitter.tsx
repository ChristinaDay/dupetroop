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
const PARTICLE_COUNT_2 = 4500
const PARTICLE_COUNT_BG = 3500  // background fill layer — uniform coverage, no blank spots

// Layer 2 — slower magnetic response (cursor influence felt less immediately)
const ALIGN_STRENGTH_2 = 0.013
const MAGNETIC_STRENGTH_2 = 0.006
const DAMPING_2 = 0.94
const MAX_SPEED_2 = 0.25
const BASE_SPEED_2 = 0.015

// Background layer — very slow drift, no magnetic response, stays dispersed
const BASE_SPEED_BG = 0.008
const MAX_SPEED_BG = 0.12

const HOLO_BAND_PX = 210
const HOLO_AXIS_SPEED = 0.000030
const HOLO_SWEEP_SPEED = 0.000090
const HOLO_WARP = 105

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

// Layer 1 chameleon palette: gold → green → teal → indigo → violet → (back via magenta)
const PALETTE_HUE_A = 0.13   // gold/amber
const PALETTE_HUE_B = 0.33   // green
const PALETTE_HUE_C = 0.50   // cyan/teal
const PALETTE_HUE_D = 0.66   // blue/indigo
const PALETTE_HUE_E = 0.82   // violet/purple

function paletteHue(raw: number): number {
  const t = ((raw % 1) + 1) % 1 * 5
  if (t < 1) return PALETTE_HUE_A + t * (PALETTE_HUE_B - PALETTE_HUE_A)
  if (t < 2) return PALETTE_HUE_B + (t - 1) * (PALETTE_HUE_C - PALETTE_HUE_B)
  if (t < 3) return PALETTE_HUE_C + (t - 2) * (PALETTE_HUE_D - PALETTE_HUE_C)
  if (t < 4) return PALETTE_HUE_D + (t - 3) * (PALETTE_HUE_E - PALETTE_HUE_D)
  // wrap back to A through magenta/red (short path over hue 1.0)
  return PALETTE_HUE_E + (t - 4) * (PALETTE_HUE_A + 1 - PALETTE_HUE_E)
}

// Layer 2 warm palette: oscillates fuchsia ↔ amber-gold through copper/red
// Triangle wave keeps it bouncing on the warm side of the wheel with no cool-color crossings
function paletteHue2(raw: number): number {
  const u = ((raw % 1) + 1) % 1
  const tri = u < 0.5 ? u * 2 : 2 - u * 2   // triangle 0→1→0
  return 0.91 + tri * 0.24                    // 0.91 (fuchsia) ↔ 1.15=0.15 (amber), via red/copper
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
      hueOffset: (Math.random() - 0.5) * 0.12,
      shimmerPhase: Math.random() * Math.PI * 2,
      shimmerSpeed: 0.8 + Math.random() * 1.6,
      angle: Math.random() * Math.PI,
    })
  }
  return particles
}

// Background: use both palette hues interleaved so the base field has chameleon colour
function initParticlesBg(width: number, height: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT_BG; i++) {
    const vel = Math.random() * Math.PI * 2
    const speed = (Math.random() * 0.5 + 0.5) * BASE_SPEED_BG
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(vel) * speed,
      vy: Math.sin(vel) * speed,
      baseRadius: 0.4 + Math.random() * 0.5,
      baseAlpha: 0.28 + Math.random() * 0.18,   // dim — just fills gaps
      hueOffset: (Math.random() - 0.5) * 0.14,
      shimmerPhase: Math.random() * Math.PI * 2,
      shimmerSpeed: 0.4 + Math.random() * 0.8,  // very slow shimmer
      angle: Math.random() * Math.PI,
    })
  }
  return particles
}

function initParticles2(width: number, height: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT_2; i++) {
    const vel = Math.random() * Math.PI * 2
    const speed = (Math.random() * 0.5 + 0.5) * BASE_SPEED_2
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(vel) * speed,
      vy: Math.sin(vel) * speed,
      baseRadius: 0.5 + Math.random() * 0.8,
      baseAlpha: 0.65 + Math.random() * 0.25,
      hueOffset: (Math.random() - 0.5) * 0.12,
      shimmerPhase: Math.random() * Math.PI * 2,
      shimmerSpeed: 0.6 + Math.random() * 1.4,
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
  const parallaxRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const container = canvas.parentElement
    if (!container) return

    let particles: Particle[] = []
    let particles2: Particle[] = []
    let particlesBg: Particle[] = []
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
        particlesBg = initParticlesBg(w, h)
        particles = initParticles(w, h)
        particles2 = initParticles2(w, h)
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

      // --- Background layer: pure flow field, no magnetic response ---
      // Slower, larger-scale swirls + phase offset so it never syncs with the mid/near layers
      for (let i = 0; i < particlesBg.length; i++) {
        const p = particlesBg[i]
        const ffRaw =
          FF_A * Math.sin(p.x * FF_F1 * 0.60 + t * FF_S1 * 0.65 + 3.71) * Math.cos(p.y * FF_F2 * 0.60 + t * FF_S2 * 0.65 + 3.71) +
          FF_B * Math.sin(p.x * FF_F3 * 0.60 + t * FF_S3 * 0.65 + 3.71) * Math.cos(p.y * FF_F4 * 0.60 + t * FF_S4 * 0.65 + 3.71)
        const ffAngle = ffRaw * FF_SCALE
        p.vx += Math.cos(ffAngle) * 0.0008 * dtFactor
        p.vy += Math.sin(ffAngle) * 0.0008 * dtFactor
        p.angle += lineAngleDiff(ffAngle, p.angle) * 0.0008 * dtFactor
        p.vx *= 0.96
        p.vy *= 0.96
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (spd > MAX_SPEED_BG) { p.vx *= MAX_SPEED_BG / spd; p.vy *= MAX_SPEED_BG / spd }
        p.x += p.vx * dtFactor
        p.y += p.vy * dtFactor
        if (p.x < -2) p.x += w + 4
        else if (p.x > w + 2) p.x -= w + 4
        if (p.y < -2) p.y += h + 4
        else if (p.y > h + 2) p.y -= h + 4
      }

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

      // --- Layer 2: tighter, faster flow field + phase offset — visibly distinct from mid layer
      for (let i = 0; i < particles2.length; i++) {
        const p = particles2[i]

        const ffRaw =
          FF_A * Math.sin(p.x * FF_F1 * 1.30 + t * FF_S1 * 1.35 + 7.31) * Math.cos(p.y * FF_F2 * 1.30 + t * FF_S2 * 1.35 + 7.31) +
          FF_B * Math.sin(p.x * FF_F3 * 1.30 + t * FF_S3 * 1.35 + 7.31) * Math.cos(p.y * FF_F4 * 1.30 + t * FF_S4 * 1.35 + 7.31)
        const ffAngle = ffRaw * FF_SCALE
        p.vx += Math.cos(ffAngle) * 0.0015 * dtFactor
        p.vy += Math.sin(ffAngle) * 0.0015 * dtFactor
        p.angle += lineAngleDiff(ffAngle, p.angle) * 0.0012 * dtFactor

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
              p.angle += lineAngleDiff(Math.atan2(By, Bx), p.angle) * ALIGN_STRENGTH_2 * alignFalloff * dtFactor
              const moveFalloff = Math.max(0, 1 - rn / (MAGNETIC_RADIUS * 2.5))
              if (moveFalloff > 0) {
                p.vx += (Bx / Bmag) * moveFalloff * MAGNETIC_STRENGTH_2 * dtFactor
                p.vy += (By / Bmag) * moveFalloff * MAGNETIC_STRENGTH_2 * dtFactor
              }
            }
          }
        }

        p.vx *= DAMPING_2
        p.vy *= DAMPING_2
        const speed2 = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed2 > MAX_SPEED_2) { p.vx *= MAX_SPEED_2 / speed2; p.vy *= MAX_SPEED_2 / speed2 }
        p.x += p.vx * dtFactor
        p.y += p.vy * dtFactor
        if (p.x < -2) p.x += w + 4
        else if (p.x > w + 2) p.x -= w + 4
        if (p.y < -2) p.y += h + 4
        else if (p.y > h + 2) p.y -= h + 4
      }

      // Smoothly lerp parallax toward cursor (normalized -0.5..0.5 from canvas centre)
      const par = parallaxRef.current
      const targetPx = mouse ? (mouse.x / w - 0.5) : 0
      const targetPy = mouse ? (mouse.y / h - 0.5) : 0
      par.x += (targetPx - par.x) * 0.028 * dtFactor
      par.y += (targetPy - par.y) * 0.028 * dtFactor
    }

    function render(t: number) {
      if (!offscreen || !offCtx) return
      const w = canvas!.width
      const h = canvas!.height

      // Per-layer parallax offsets — bg moves least (far), layer2 moves most (near)
      const par = parallaxRef.current
      const bgOffX = par.x * 7,  bgOffY = par.y * 5
      const midOffX = par.x * 20, midOffY = par.y * 13
      const nearOffX = par.x * 36, nearOffY = par.y * 22
      // Slowly orbiting specular light direction — shared across all passes
      const lightAngle = t * 0.000022

      // --- Pass 0: background fill layer — drawn first so it sits beneath everything ---
      offCtx.clearRect(0, 0, w, h)
      offCtx.save()
      offCtx.translate(bgOffX, bgOffY)
      const bgHoloSweep = t * HOLO_SWEEP_SPEED * 0.6 + 0.8

      for (let i = 0; i < particlesBg.length; i++) {
        const p = particlesBg[i]
        const shimmer = 0.5 + 0.5 * Math.sin(t * 0.00008 * p.shimmerSpeed + p.shimmerPhase)
        // Hue from flake orientation vs light — particles at same position but different angles get different colors
        const facing = Math.cos(p.angle + Math.PI / 2 - lightAngle * 0.6)
        const rawHue = ((facing * 0.38 + bgHoloSweep + p.hueOffset) % 1 + 1) % 1
        const hue = i % 2 === 0 ? paletteHue(rawHue) : paletteHue2(rawHue) % 1
        const specular = Math.max(0, facing) ** 3
        const lightness = 30 + shimmer * 8 + specular * 22
        const saturation = Math.max(52, 82 - specular * 25)
        const r = p.baseRadius * (0.9 + shimmer * 0.2)
        offCtx.fillStyle = `hsl(${hue}turn ${saturation}% ${lightness}%)`
        offCtx.globalAlpha = p.baseAlpha * (0.28 + 0.45 * shimmer + 0.18 * specular)
        offCtx.beginPath()
        offCtx.arc(p.x, p.y, r, 0, Math.PI * 2)
        offCtx.fill()
      }
      offCtx.globalAlpha = 1
      offCtx.restore()

      // --- Pass 1: particles to offscreen ---
      offCtx.save()
      offCtx.translate(midOffX, midOffY)

      const mouse = mouseRef.current
      const holoSweep = t * HOLO_SWEEP_SPEED

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        let catEye = 0
        if (mouse) {
          const mdx = mouse.x - p.x
          const mdy = mouse.y - p.y
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy)
          const proximity = Math.max(0, 1 - mdist / 380) ** 2
          const perpFactor = 0.5 + 0.5 * Math.abs(Math.sin(p.angle - Math.atan2(mdy, mdx)))
          catEye = proximity * perpFactor * 2.5
        }

        const shimmer = 0.5 + 0.5 * Math.sin(t * 0.00014 * p.shimmerSpeed + p.shimmerPhase)

        // Hue from orientation vs light: same position, different angle = different color
        const facing = Math.cos(p.angle + Math.PI / 2 - lightAngle)
        const rawHue = ((facing * 0.45 + holoSweep + p.hueOffset) % 1 + 1) % 1
        const hue = paletteHue(rawHue)

        const specular = Math.max(0, facing) ** 2.5
        const brightness = shimmer * 0.3 + specular * 0.9 + catEye * 0.5
        const lightness = Math.min(88, 36 + brightness * 44)
        const saturation = Math.max(48, 95 - specular * 42)
        const alpha = Math.min(0.95, p.baseAlpha * Math.max(0.06, 0.2 + 0.8 * (shimmer * 0.35 + specular * 0.5 + catEye * 0.25)))

        const r = p.baseRadius * (1.0 + shimmer * 0.25 + catEye * 0.2)
        offCtx.fillStyle = `hsl(${hue}turn ${saturation}% ${lightness}%)`
        offCtx.globalAlpha = alpha
        offCtx.beginPath()
        offCtx.arc(p.x, p.y, r, 0, Math.PI * 2)
        offCtx.fill()
      }
      offCtx.globalAlpha = 1
      offCtx.restore()

      // --- Pass 1b: layer 2 particles — warm copper/rose palette, slower cursor response ---
      offCtx.save()
      offCtx.translate(nearOffX, nearOffY)
      const holoSweep2 = t * HOLO_SWEEP_SPEED * 0.75 + 0.42

      for (let i = 0; i < particles2.length; i++) {
        const p = particles2[i]

        let catEye2 = 0
        if (mouse) {
          const mdx = mouse.x - p.x
          const mdy = mouse.y - p.y
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy)
          const proximity = Math.max(0, 1 - mdist / 340) ** 2
          const perpFactor = 0.5 + 0.5 * Math.abs(Math.sin(p.angle - Math.atan2(mdy, mdx)))
          catEye2 = proximity * perpFactor * 2.0
        }

        const shimmer = 0.5 + 0.5 * Math.sin(t * 0.00014 * p.shimmerSpeed + p.shimmerPhase)

        const facing = Math.cos(p.angle + Math.PI / 2 - lightAngle)
        const rawHue2 = ((facing * 0.45 + holoSweep2 + p.hueOffset) % 1 + 1) % 1
        const hue2 = paletteHue2(rawHue2) % 1

        const specular = Math.max(0, facing) ** 2.5
        const brightness = shimmer * 0.3 + specular * 0.9 + catEye2 * 0.45
        const lightness2 = Math.min(88, 36 + brightness * 44)
        const saturation2 = Math.max(48, 95 - specular * 42)
        const alpha = Math.min(0.90, p.baseAlpha * Math.max(0.06, 0.2 + 0.8 * (shimmer * 0.35 + specular * 0.5 + catEye2 * 0.2)))

        const r = p.baseRadius * (1.0 + shimmer * 0.25 + catEye2 * 0.2)
        offCtx.fillStyle = `hsl(${hue2}turn ${saturation2}% ${lightness2}%)`
        offCtx.globalAlpha = alpha
        offCtx.beginPath()
        offCtx.arc(p.x, p.y, r, 0, Math.PI * 2)
        offCtx.fill()
      }
      offCtx.globalAlpha = 1
      offCtx.restore()

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
