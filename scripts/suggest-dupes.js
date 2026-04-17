#!/usr/bin/env node
/**
 * DupeTroop — Algorithmic Dupe Suggester
 *
 * Two matching modes:
 *
 *   PROFILE MODE (default) — groups polishes by finish_category + color_family
 *   and surfaces all cross-brand pairs within each group that aren't already
 *   in the dupes table. Works for the entire catalog regardless of hex quality.
 *   When both polishes have a precise hex, Delta-E is computed and shown.
 *
 *   PRECISE MODE (--precise) — ΔE-only matching. Filters to the ~17 polishes
 *   with hand-curated hex values and finds all pairs below --threshold.
 *
 * Usage:
 *   node --env-file=.env.local scripts/suggest-dupes.js
 *   node --env-file=.env.local scripts/suggest-dupes.js --finish=cream --color=red
 *   node --env-file=.env.local scripts/suggest-dupes.js --brand=mooncat
 *   node --env-file=.env.local scripts/suggest-dupes.js --top=50
 *   node --env-file=.env.local scripts/suggest-dupes.js --precise
 *   node --env-file=.env.local scripts/suggest-dupes.js --precise --threshold=6
 *   node --env-file=.env.local scripts/suggest-dupes.js --insert
 *   node --env-file=.env.local scripts/suggest-dupes.js --dry-run
 *
 * Flags:
 *   --precise         ΔE-only mode: only pairs with precise hex values
 *   --threshold=N     Delta-E cutoff for --precise mode (default: 8)
 *   --top=N           Max candidates per group / overall (default: 200)
 *   --finish=CAT      Filter to a specific finish category
 *   --color=FAMILY    Filter to a specific color family
 *   --brand=SLUG      Only show matches involving a specific brand
 *   --same-brand      Allow matches within the same brand (off by default)
 *   --include-other   Include polishes with finish_category='other' (noisy, off by default)
 *   --include-neutral Include polishes with color_family='neutral' (noisy, off by default)
 *   --insert          Insert displayed candidates as pending dupes
 *   --dry-run         With --insert: show what would be inserted, don't write
 */

import { createClient } from '@supabase/supabase-js'
import readline from 'readline'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Run with: node --env-file=.env.local scripts/suggest-dupes.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ─── CLI flags ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const flagVal = (name, def) => {
  const f = argv.find(a => a.startsWith(`--${name}=`))
  return f ? f.split('=').slice(1).join('=') : (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : def)
}

const PRECISE_MODE  = flag('precise')
const THRESHOLD     = parseFloat(flagVal('threshold', '8'))
const TOP_N         = parseInt(flagVal('top', '200'), 10)
const BRAND_FILTER  = flagVal('brand', null)
const FINISH_FILTER = flagVal('finish', null)
const COLOR_FILTER  = flagVal('color', null)
const SAME_BRAND       = flag('same-brand')
const INCLUDE_OTHER    = flag('include-other')
const INCLUDE_NEUTRAL  = flag('include-neutral')
const INSERT           = flag('insert')
const DRY_RUN          = flag('dry-run')

// ─── Generic hex values assigned by COLOR_HEX_MAP (not per-polish precise) ──
// All lowercased for case-insensitive comparison.
const GENERIC_HEXES = new Set([
  '#888888',
  '#cc1b2e', '#6b1a2a', '#e8602c', '#e8b424',
  '#2e7d4a', '#2a8a7a', '#2458b8', '#6b2ea0',
  '#e03880', '#d4856a', '#f8f8f8', '#111111',
  '#c8c8d0', '#c8a832', '#8b5e3c', '#b8a8a0',
  '#f0f0f0', '#e06040',
])

function isPrecise(hex) {
  return hex && !GENERIC_HEXES.has(hex.toLowerCase())
}

// ─── Delta-E (CIELAB) — no dependencies ──────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  if (h.length !== 6) return null
  return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255]
}
function linearize(c) { return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }
function rgbToXyz([r,g,b]) {
  const [rl,gl,bl] = [r,g,b].map(linearize)
  return [rl*0.4124564+gl*0.3575761+bl*0.1804375, rl*0.2126729+gl*0.7151522+bl*0.0721750, rl*0.0193339+gl*0.1191920+bl*0.9503041]
}
function xyzToLab([x,y,z]) {
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787*t+16/116
  const [fx,fy,fz] = [x/0.95047, y/1.00000, z/1.08883].map(f)
  return [116*fy-16, 500*(fx-fy), 200*(fy-fz)]
}
function hexToLab(hex) {
  const rgb = hexToRgb(hex); if (!rgb) return null
  return xyzToLab(rgbToXyz(rgb))
}
function blendLab([l1,a1,b1],[l2,a2,b2]) { return [(l1+l2)/2,(a1+a2)/2,(b1+b2)/2] }
function polishLab(p) {
  const primary = hexToLab(p.hex_color); if (!primary) return null
  if (p.hex_secondary) { const sec = hexToLab(p.hex_secondary); if (sec) return blendLab(primary,sec) }
  return primary
}
function deltaE([l1,a1,b1],[l2,a2,b2]) {
  return Math.sqrt((l1-l2)**2+(a1-a2)**2+(b1-b2)**2)
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchAllPolishes() {
  // Supabase default limit is 1000 — paginate to get all
  let all = [], from = 0
  while (true) {
    const { data, error } = await supabase
      .from('polishes')
      .select('id, name, slug, hex_color, hex_secondary, finish_category, color_family, msrp_usd, is_verified, brands:brand_id(id, name, slug, price_tier)')
      .eq('is_verified', true)
      .eq('is_discontinued', false)
      .order('name')
      .range(from, from + 999)

    if (error) { console.error('Fetch error:', error.message); process.exit(1) }
    all.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return all
}

async function fetchExistingPairs() {
  const { data, error } = await supabase.from('dupes').select('polish_a_id, polish_b_id')
  if (error) { console.error('Dupes fetch error:', error.message); process.exit(1) }
  const pairs = new Set()
  for (const d of data) pairs.add([d.polish_a_id, d.polish_b_id].sort().join(':'))
  return pairs
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function priceLabel(a, b) {
  if (!a.msrp_usd || !b.msrp_usd) return null
  const diff = Math.abs(a.msrp_usd - b.msrp_usd)
  if (diff === 0) return `$${a.msrp_usd} each`
  const lo = Math.min(a.msrp_usd, b.msrp_usd), hi = Math.max(a.msrp_usd, b.msrp_usd)
  return `$${lo} vs $${hi} (save $${diff.toFixed(0)})`
}

function valueBadge(a, b) {
  if (!a.brands?.price_tier || !b.brands?.price_tier) return ''
  return Math.abs(a.brands.price_tier - b.brands.price_tier) >= 1 ? ' 💰 value play' : ''
}

// ─── PROFILE MODE ─────────────────────────────────────────────────────────────
// Group by (finish_category, color_family). Show all cross-brand pairs in each
// group that aren't already known dupes. When both have precise hex, show ΔE.

function profileMode(polishes, existingPairs) {
  // Apply filters
  let pool = polishes
  if (!INCLUDE_OTHER)   pool = pool.filter(p => p.finish_category !== 'other')
  if (!INCLUDE_NEUTRAL) pool = pool.filter(p => p.color_family !== 'neutral')
  if (BRAND_FILTER)     pool = pool.filter(p => p.brands.slug === BRAND_FILTER)
  if (FINISH_FILTER)    pool = pool.filter(p => p.finish_category === FINISH_FILTER)
  if (COLOR_FILTER)     pool = pool.filter(p => p.color_family === COLOR_FILTER)

  // Group by (finish_category, color_family)
  const groups = new Map()
  for (const p of pool) {
    const key = `${p.finish_category}|${p.color_family}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(p)
  }

  // For each group, find cross-brand pairs not in the dupes table
  const allCandidates = []
  for (const [groupKey, members] of groups) {
    const [finish, colorFamily] = groupKey.split('|')
    if (members.length < 2) continue

    const groupCandidates = []
    for (let i = 0; i < members.length; i++) {
      const a = members[i]
      for (let j = i + 1; j < members.length; j++) {
        const b = members[j]
        if (!SAME_BRAND && a.brands.id === b.brands.id) continue

        const pairKey = [a.id, b.id].sort().join(':')
        if (existingPairs.has(pairKey)) continue

        // Compute ΔE if both have precise hex
        let dE = null
        if (isPrecise(a.hex_color) && isPrecise(b.hex_color)) {
          const labA = polishLab(a), labB = polishLab(b)
          if (labA && labB) dE = Math.round(deltaE(labA, labB) * 100) / 100
        }

        groupCandidates.push({ a, b, finish, colorFamily, dE })
      }
    }

    if (groupCandidates.length === 0) continue

    // Sort: precise ΔE first (ascending), then alphabetically
    groupCandidates.sort((x, y) => {
      if (x.dE !== null && y.dE !== null) return x.dE - y.dE
      if (x.dE !== null) return -1
      if (y.dE !== null) return 1
      return x.a.name.localeCompare(y.a.name)
    })

    allCandidates.push({ groupKey, finish, colorFamily, members, candidates: groupCandidates })
  }

  // Sort groups: most cross-brand pairs first (richest groups at top)
  allCandidates.sort((x, y) => y.candidates.length - x.candidates.length)

  // Render
  let totalCandidates = 0, totalGroups = 0
  const shown = []

  for (const group of allCandidates) {
    const top = group.candidates.slice(0, TOP_N)
    totalCandidates += group.candidates.length
    totalGroups++
    shown.push({ ...group, top })
  }

  console.log(`────────────────────────────────────────────────────────────────────────────`)
  console.log(` Profile Match Results`)
  console.log(`────────────────────────────────────────────────────────────────────────────`)
  console.log(` Total groups:           ${totalGroups}`)
  console.log(` Total candidate pairs:  ${totalCandidates.toLocaleString()}`)
  console.log(` Showing top ${TOP_N} pairs per group`)
  console.log(`────────────────────────────────────────────────────────────────────────────\n`)

  let shownCount = 0
  for (const { finish, colorFamily, members, candidates, top } of shown) {
    const brandNames = [...new Set(members.map(p => p.brands.name))].join(', ')
    const preciseCount = candidates.filter(c => c.dE !== null).length

    console.log(`${'━'.repeat(70)}`)
    console.log(` ${finish.toUpperCase()} + ${colorFamily.toUpperCase()}  ·  ${members.length} polishes  ·  ${candidates.length} unmatched pairs  ·  ${members.filter(p=>isPrecise(p.hex_color)).length} w/ precise hex`)
    console.log(` Brands: ${brandNames}`)
    console.log()

    for (const { a, b, dE } of top) {
      const dELabel = dE !== null ? ` ΔE ${dE.toFixed(2)}` : ''
      const price = priceLabel(a, b)
      const value = valueBadge(a, b)
      console.log(`  ${a.brands.name} — ${a.name}${a.hex_color ? ` [${a.hex_color}]` : ''}`)
      console.log(`  ${b.brands.name} — ${b.name}${b.hex_color ? ` [${b.hex_color}]` : ''}`)
      console.log(`  ${price ? price + ' ·' : ''} ${finish} + ${colorFamily}${dELabel}${value}`)
      console.log()
      shownCount++
    }
    if (candidates.length > TOP_N) {
      console.log(`  … and ${candidates.length - TOP_N} more pairs in this group\n`)
    }
  }

  return shown.flatMap(g => g.top)
}

// ─── PRECISE MODE ─────────────────────────────────────────────────────────────
// ΔE matching among polishes with hand-curated hex values only.

function preciseMode(polishes, existingPairs) {
  const pool = polishes.filter(p => isPrecise(p.hex_color))

  if (BRAND_FILTER) {
    const brandsInPool = [...new Set(pool.map(p => p.brands.name))]
    if (!brandsInPool.find(b => b.toLowerCase().includes(BRAND_FILTER))) {
      console.log(`No precise-hex polishes found for brand: ${BRAND_FILTER}`)
      process.exit(0)
    }
  }

  console.log(`Precise-hex pool: ${pool.length} polishes\n`)

  const candidates = []
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i]
    if (BRAND_FILTER && a.brands.slug !== BRAND_FILTER) continue
    if (FINISH_FILTER && a.finish_category !== FINISH_FILTER) continue
    if (COLOR_FILTER && a.color_family !== COLOR_FILTER) continue

    for (let j = i + 1; j < pool.length; j++) {
      const b = pool[j]
      if (BRAND_FILTER && b.brands.slug !== BRAND_FILTER) continue
      if (!SAME_BRAND && a.brands.id === b.brands.id) continue
      const pairKey = [a.id, b.id].sort().join(':')
      if (existingPairs.has(pairKey)) continue

      const labA = polishLab(a), labB = polishLab(b)
      if (!labA || !labB) continue

      const dE = deltaE(labA, labB)
      if (dE > THRESHOLD) continue

      const sameFinish = a.finish_category === b.finish_category
      const priceTierDiff = !!(a.brands?.price_tier && b.brands?.price_tier && Math.abs(a.brands.price_tier - b.brands.price_tier) >= 1)
      const matchScore = Math.max(0, 15 - dE) + (sameFinish ? 3 : 0) + (priceTierDiff ? 1 : 0) + (!( a.brands.id === b.brands.id) ? 1 : 0)

      candidates.push({ a, b, dE: Math.round(dE*100)/100, sameFinish, priceTierDiff, matchScore })
    }
  }

  candidates.sort((x, y) => y.matchScore - x.matchScore || x.dE - y.dE)
  const shown = candidates.slice(0, TOP_N)

  console.log(`────────────────────────────────────────────────────────────────────────────`)
  console.log(` Precise ΔE Matches  (threshold: ΔE ≤ ${THRESHOLD}, top ${TOP_N})`)
  console.log(`────────────────────────────────────────────────────────────────────────────`)
  console.log(` Candidates: ${candidates.length}\n`)

  for (let idx = 0; idx < shown.length; idx++) {
    const { a, b, dE, sameFinish, priceTierDiff } = shown[idx]
    const finishLabel = sameFinish ? a.finish_category : `${a.finish_category} ↔ ${b.finish_category}`
    const price = priceLabel(a, b)
    const value = valueBadge(a, b)
    console.log(`#${String(idx+1).padStart(3,'0')}  ΔE ${dE.toFixed(2)}  ${sameFinish ? '✓ same finish' : '~ cross-finish'}${value}`)
    console.log(`      ${a.brands.name} — ${a.name}  [${a.hex_color}]`)
    console.log(`      ${b.brands.name} — ${b.name}  [${b.hex_color}]`)
    console.log(`      ${finishLabel}${price ? '  ·  ' + price : ''}`)
    console.log()
  }

  return shown
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching all verified polishes...')
  const polishes = await fetchAllPolishes()
  console.log(`  ${polishes.length} polishes loaded\n`)

  console.log('Fetching existing dupe pairs...')
  const existingPairs = await fetchExistingPairs()
  console.log(`  ${existingPairs.size} existing pairs (will be skipped)\n`)

  const candidates = PRECISE_MODE
    ? preciseMode(polishes, existingPairs)
    : profileMode(polishes, existingPairs)

  if (candidates.length === 0) {
    console.log('No candidates found.')
    return
  }

  if (INSERT) {
    const rows = candidates.map(({ a, b }) => ({
      polish_a_id: a.id,
      polish_b_id: b.id,
      submitted_by: null,
      status: 'pending',
      notes: `Auto-suggested by suggest-dupes.js`,
    }))

    if (DRY_RUN) {
      console.log(`[dry-run] Would insert ${rows.length} pending dupes.`)
      return
    }

    const answer = await confirm(`Insert ${rows.length} candidates as pending dupes? [y/N] `)
    if (!answer) { console.log('Aborted.'); return }

    const { error } = await supabase.from('dupes').insert(rows)
    if (error) console.error('Insert error:', error.message)
    else console.log(`✓ Inserted ${rows.length} pending dupes — review at /admin/dupes`)
  }
}

function confirm(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, (answer) => { rl.close(); resolve(answer.trim().toLowerCase() === 'y') })
  })
}

main().catch(err => { console.error(err); process.exit(1) })
