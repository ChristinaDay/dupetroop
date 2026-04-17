#!/usr/bin/env node
/**
 * DupeTroop — Image-Based Hex Color Backfill
 *
 * Extracts the dominant swatch color from each polish's product image and
 * writes it back to `polishes.hex_color`. This replaces the coarse
 * COLOR_HEX_MAP values (e.g. all blues → #2458B8) with precise per-polish
 * colors, which makes the suggest-dupes algorithm meaningful.
 *
 * Strategy:
 *   1. Fetch polishes where hex_color is a known generic value (or #888888)
 *   2. Download product image for each
 *   3. Crop to the center swatch region (avoid white backgrounds at edges)
 *   4. Resize to 32×32, extract raw RGB pixels
 *   5. Cluster pixels → find dominant color via k-means (k=1 is fine for
 *      a swatch; we're not doing full palette extraction)
 *   6. Skip pixels that are near-white (background) or near-transparent
 *   7. Write the dominant color back to the DB
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-hex-colors.js
 *   node --env-file=.env.local scripts/backfill-hex-colors.js --dry-run
 *   node --env-file=.env.local scripts/backfill-hex-colors.js --brand=mooncat
 *   node --env-file=.env.local scripts/backfill-hex-colors.js --limit=50
 *   node --env-file=.env.local scripts/backfill-hex-colors.js --force
 *      (re-process polishes that already have non-generic hex values)
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Run with: node --env-file=.env.local scripts/backfill-hex-colors.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const flagVal = (name, def) => {
  const f = argv.find(a => a.startsWith(`--${name}=`))
  return f ? f.split('=').slice(1).join('=') : (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : def)
}

const DRY_RUN      = flag('dry-run')
const FORCE        = flag('force')
const BRAND_FILTER = flagVal('brand', null)
const LIMIT        = parseInt(flagVal('limit', '0'), 10) || Infinity
const CONCURRENCY  = 8  // parallel image fetches

// These are the known generic COLOR_HEX_MAP values we want to replace.
// Also include #888888 (the absolute fallback).
const GENERIC_HEXES = new Set([
  '#888888',
  '#CC1B2E', '#6B1A2A', '#E8602C', '#E8B424',
  '#2E7D4A', '#2A8A7A', '#2458B8', '#6B2EA0',
  '#E03880', '#D4856A', '#F8F8F8', '#111111',
  '#C8C8D0', '#C8A832', '#8B5E3C', '#B8A8A0',
  '#F0F0F0', '#E06040',
])

// ─── Color math ───────────────────────────────────────────────────────────────

function toHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
}

/** Returns true if the pixel is too close to white (background) */
function isBackground(r, g, b, threshold = 240) {
  return r > threshold && g > threshold && b > threshold
}

/** Returns true if the pixel is near-black (very dark shadow/artifact) */
function isShadow(r, g, b, threshold = 15) {
  return r < threshold && g < threshold && b < threshold
}

/**
 * Find the dominant swatch color in a flat RGBA pixel buffer.
 * Strategy: median of all non-background, non-shadow pixels.
 * Median is more robust than mean for nail polish images because
 * specular highlights (bright spots) and label areas skew the mean.
 */
function dominantColor(buffer, width, height) {
  const pixels = []

  for (let i = 0; i < buffer.length; i += 4) {
    const r = buffer[i], g = buffer[i + 1], b = buffer[i + 2]
    if (isBackground(r, g, b)) continue
    if (isShadow(r, g, b)) continue
    pixels.push([r, g, b])
  }

  if (pixels.length === 0) return null  // fully white/black image

  // Sort by perceived luminance and take a central cluster
  // (avoids label text, glare spots, shadow edges)
  pixels.sort((a, b) => {
    const lumA = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2]
    const lumB = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]
    return lumA - lumB
  })

  // Take the middle 60% of pixels (skip top/bottom extremes)
  const lo = Math.floor(pixels.length * 0.2)
  const hi = Math.floor(pixels.length * 0.8)
  const mid = pixels.slice(lo, hi)

  if (mid.length === 0) return null

  // Median per channel
  mid.sort((a, b) => a[0] - b[0]); const r = mid[Math.floor(mid.length / 2)][0]
  mid.sort((a, b) => a[1] - b[1]); const g = mid[Math.floor(mid.length / 2)][1]
  mid.sort((a, b) => a[2] - b[2]); const b_ = mid[Math.floor(mid.length / 2)][2]

  return toHex(r, g, b_)
}

// ─── Image fetching + processing ─────────────────────────────────────────────

async function extractHexFromUrl(imageUrl) {
  const resp = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 DupeTroop-bot/1.0' },
    signal: AbortSignal.timeout(15000),
  })

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

  const arrayBuffer = await resp.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Resize to 64×64 and extract raw RGBA pixels.
  // We crop to the center 50% of the image first — product photos often have
  // white borders, labels, and backgrounds at the edges; the center is purest swatch.
  const { data: raw, info } = await sharp(buffer)
    .resize(128, 128, { fit: 'cover' })   // normalise size
    .extract({ left: 32, top: 32, width: 64, height: 64 })  // center crop
    .raw()
    .toBuffer({ resolveWithObject: true })

  return dominantColor(raw, info.width, info.height)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Build query
  let query = supabase
    .from('polishes')
    .select(`
      id, name, slug, hex_color,
      images,
      brands:brand_id (name, slug)
    `)
    .eq('is_verified', true)
    .not('images', 'eq', '{}')  // must have at least one image

  if (!FORCE) {
    // Only process polishes with known-generic hex values
    // Supabase doesn't support `in` on nullable, so we check hex_color is not null
    // and then filter client-side for the generic set
    // (the list is small enough that fetching all and filtering is fine)
  }

  if (BRAND_FILTER) {
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', BRAND_FILTER)
      .single()
    if (!brand) { console.error(`Brand not found: ${BRAND_FILTER}`); process.exit(1) }
    query = query.eq('brand_id', brand.id)
  }

  const { data: polishes, error } = await query.order('name')
  if (error) { console.error('Fetch error:', error.message); process.exit(1) }

  // Filter to only polishes with generic hex values (unless --force)
  const targets = FORCE
    ? polishes
    : polishes.filter(p => !p.hex_color || GENERIC_HEXES.has(p.hex_color.toLowerCase()))

  const limited = targets.slice(0, LIMIT)

  console.log(`Polishes with images:   ${polishes.length}`)
  console.log(`Needing hex backfill:   ${targets.length}`)
  console.log(`Processing this run:    ${limited.length}${LIMIT < Infinity ? ` (--limit=${LIMIT})` : ''}`)
  console.log(DRY_RUN ? '(dry-run — no writes)\n' : '')

  if (limited.length === 0) {
    console.log('Nothing to do.')
    return
  }

  let updated = 0, failed = 0, skipped = 0

  // Process in batches of CONCURRENCY
  for (let i = 0; i < limited.length; i += CONCURRENCY) {
    const batch = limited.slice(i, i + CONCURRENCY)

    await Promise.all(batch.map(async (polish) => {
      const imageUrl = polish.images?.[0]
      if (!imageUrl) { skipped++; return }

      try {
        const hex = await extractHexFromUrl(imageUrl)

        if (!hex) {
          console.log(`  SKIP  ${polish.brands.name} — ${polish.name} (no swatch pixels found)`)
          skipped++
          return
        }

        const oldHex = polish.hex_color ?? 'null'
        console.log(`  ${hex}  ← ${oldHex.padEnd(8)}  ${polish.brands.name} — ${polish.name}`)

        if (!DRY_RUN) {
          const { error: updateError } = await supabase
            .from('polishes')
            .update({ hex_color: hex })
            .eq('id', polish.id)

          if (updateError) throw updateError
        }

        updated++
      } catch (err) {
        console.log(`  ERR   ${polish.brands.name} — ${polish.name}: ${err.message}`)
        failed++
      }
    }))

    // Polite delay between batches (avoid hammering CDNs)
    if (i + CONCURRENCY < limited.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  console.log(`\n────────────────────────────────────────`)
  console.log(`Updated:  ${updated}`)
  console.log(`Skipped:  ${skipped}`)
  console.log(`Failed:   ${failed}`)
  if (!DRY_RUN && updated > 0) {
    console.log(`\nRun suggest-dupes.js again to see improved matches.`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
