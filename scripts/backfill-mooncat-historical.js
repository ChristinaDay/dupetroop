#!/usr/bin/env node
/**
 * Backfill discontinued Mooncat polishes using Wayback Machine + live Shopify product JSON.
 *
 * Strategy:
 *   1. Query the Wayback Machine CDX API for all www.mooncat.com/products/*.json URLs
 *      it has ever seen — this gives a comprehensive list of handles including ones
 *      no longer reachable from any live collection page.
 *   2. Diff against existing DB polishes to find unknowns.
 *   3. Fetch each unknown from the LIVE Mooncat site (/products/{handle}.json) —
 *      Shopify keeps individual product JSON accessible even after discontinuation.
 *   4. Fall back to the most recent Wayback Machine snapshot for any that 404 live.
 *   5. Upsert new polishes with is_discontinued: true.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-mooncat-historical.js
 *   node --env-file=.env.local scripts/backfill-mooncat-historical.js --insert
 *   node --env-file=.env.local scripts/backfill-mooncat-historical.js --dry-run
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Run with: node --env-file=.env.local scripts/backfill-mooncat-historical.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const DRY_RUN  = process.argv.includes('--dry-run')
const INSERT   = process.argv.includes('--insert')

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ─── Tag → DB field mappings (mirrors seed-products.js) ───────────────────────

const FINISH_MAP = {
  holographic: 'holo',   holo:        'holo',
  flakie:     'flakies', flakies:     'flakies',
  glitter:    'glitter', shimmer:     'shimmer',
  duochrome:  'duochrome', multichrome: 'multichrome', chrome: 'multichrome',
  magnetic:   'magnetic',
  creme:      'cream',   cream:       'cream',
  jelly:      'jelly',   matte:       'matte',  satin: 'satin',
  topper:     'topper',
}

const COLOR_HEX_MAP = {
  red: '#CC1B2E', maroon: '#6B1A2A', orange: '#E8602C', yellow: '#E8B424',
  green: '#2E7D4A', teal: '#2A8A7A', blue: '#2458B8', purple: '#6B2EA0',
  pink: '#E03880', 'rose-gold': '#D4A8B8', white: '#F8F8F8', black: '#111111',
  silver: '#C8C8D0', gold: '#C8A832', brown: '#8B5E3C', neutral: '#B8A8A0',
  clear: '#F0F0F0', coral: '#E06040',
}

const COLOR_FAMILY_MAP = {
  red: 'red', maroon: 'red', coral: 'pink', orange: 'orange',
  yellow: 'yellow', gold: 'yellow', green: 'green', teal: 'green',
  blue: 'blue', purple: 'purple', pink: 'pink', 'rose-gold': 'pink',
  white: 'neutral', clear: 'neutral', neutral: 'neutral', brown: 'neutral',
  black: 'black', silver: 'neutral',
}

function parseTags(rawTags) {
  const tags = Array.isArray(rawTags)
    ? rawTags
    : (rawTags || '').split(',').map(t => t.trim())

  const finishTags = tags.filter(t => t.startsWith('finish:')).map(t => t.replace('finish:', ''))
  const colorTags  = tags.filter(t => t.startsWith('color:')).map(t => t.replace('color:', ''))

  const finishOrder = ['magnetic', 'multichrome', 'duochrome', 'flakies', 'flakie', 'glitter',
    'holographic', 'holo', 'shimmer', 'jelly', 'matte', 'satin', 'cream', 'creme', 'topper']
  let finish = 'other'
  for (const preferred of finishOrder) {
    if (finishTags.includes(preferred)) { finish = FINISH_MAP[preferred] ?? 'other'; break }
  }

  const meaningfulColors = colorTags.filter(c => !['clear', 'silver'].includes(c))
  const primaryColor = meaningfulColors[0] ?? colorTags[0] ?? null
  const hex         = primaryColor ? (COLOR_HEX_MAP[primaryColor] ?? '#888888') : '#888888'
  const colorFamily = primaryColor ? (COLOR_FAMILY_MAP[primaryColor] ?? 'neutral') : 'neutral'
  const isLimited   = tags.some(t => ['limited', 'limited-edition', 'le'].includes(t.toLowerCase()))

  return { finish, hex, colorFamily, isLimited }
}

// ─── Non-polish filter ────────────────────────────────────────────────────────

const NON_POLISH_KEYWORDS = [
  'bundle', 'gift', 'kit', 'set', 'remover', 'file', 'buffer',
  'sticker', 'nail art', 'replacement', 'brush', 'spatula', 'duo', 'trio',
  'quad', 'thinner', 'dropper', 'refill', 'prep pad', 'nail glue',
  'acetone', 'cleanser', 'dehydrator', 'cuticle oil', 'stanley', 'tumbler',
  'mug', 'wand', 'gift card', 'ring', 'necklace', 'bracelet', 'earring',
  'jewelry', 'jewellery', 'chain', 'pendant', 'revitalizer', 'magnet',
  'horseshoe', 'cuticle', 'collection set',
]

const NON_POLISH_SLUG_PATTERNS = [
  /gift.card/, /^\d+-gift/, /bundle/, /kit$/, /set$/, /wand$/,
  /marie.june/, /-ring-/, /ring$/, /necklace/, /bracelet/, /earring/,
  /revitalizer/, /horseshoe/, /magnet$/, /-collection$/,
]

function isActualPolish(name, handle = '') {
  const t = name.toLowerCase()
  const h = handle.toLowerCase()
  if (NON_POLISH_KEYWORDS.some(k => t.includes(k))) return false
  if (NON_POLISH_SLUG_PATTERNS.some(p => p.test(h))) return false
  return true
}

// ─── Wayback Machine CDX: get all known Mooncat product handles ───────────────

async function getHandlesFromCdx() {
  // Collapse by urlkey — one row per unique URL, regardless of how many times crawled.
  // matchType=prefix on /products/ catches all product pages.
  // We filter for .json URLs since those are the structured data endpoints.
  const url =
    'http://web.archive.org/cdx/search/cdx' +
    '?url=www.mooncat.com/products/' +
    '&matchType=prefix' +
    '&output=json' +
    '&fl=original' +
    '&filter=statuscode:200' +
    '&filter=original:.*\\.json$' +
    '&collapse=urlkey' +
    '&limit=5000'

  console.log('Querying Wayback Machine CDX for all known Mooncat product handles...')
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`CDX API ${res.status}`)

  const rows = await res.json()
  if (!rows || rows.length <= 1) return []

  // Extract handle from URL: /products/{handle}.json
  const handles = []
  for (const [original] of rows.slice(1)) {
    const match = original.match(/\/products\/([^/?]+)\.json/)
    if (match) handles.push(match[1])
  }

  return [...new Set(handles)] // deduplicate
}

// ─── Fetch product data — live site first, Wayback Machine fallback ───────────

async function fetchProductJson(handle) {
  // Try the live Shopify endpoint first — Mooncat keeps product JSON accessible
  // even after products are removed from all collections.
  const liveUrl = `https://www.mooncat.com/products/${handle}.json`
  try {
    const res = await fetch(liveUrl, { headers: HEADERS, signal: AbortSignal.timeout(15000) })
    if (res.ok) {
      const data = await res.json()
      if (data?.product) return { product: data.product, source: 'live' }
    }
  } catch {}

  // Fall back to the most recent Wayback Machine snapshot
  const cdxUrl =
    'http://web.archive.org/cdx/search/cdx' +
    `?url=www.mooncat.com/products/${handle}.json` +
    '&output=json&fl=timestamp&filter=statuscode:200&limit=1&sort=desc'

  try {
    const cdxRes = await fetch(cdxUrl, { headers: HEADERS, signal: AbortSignal.timeout(15000) })
    if (!cdxRes.ok) return null
    const rows = await cdxRes.json()
    if (!rows || rows.length <= 1) return null

    const timestamp = rows[1][0]
    const wbUrl = `https://web.archive.org/web/${timestamp}if_/https://www.mooncat.com/products/${handle}.json`
    const wbRes = await fetch(wbUrl, { headers: HEADERS, signal: AbortSignal.timeout(20000) })
    if (!wbRes.ok) return null
    const data = await wbRes.json()
    if (data?.product) return { product: data.product, source: 'wayback' }
  } catch {}

  return null
}

// ─── Parse a Shopify product object into a DB record ─────────────────────────

function productToRecord(product, brandId) {
  const { finish, hex, colorFamily, isLimited } = parseTags(product.tags)
  const image = product.images?.[0]?.src?.split('?')[0] ?? null
  const price = parseFloat(product.variants?.[0]?.price)

  const record = {
    brand_id:        brandId,
    name:            product.title,
    slug:            product.handle,
    hex_color:       hex,
    finish_category: finish,
    color_family:    colorFamily,
    msrp_usd:        (!isNaN(price) && price > 0) ? price : 17,
    is_verified:     true,
    is_limited:      isLimited,
    is_discontinued: true,
  }

  if (image) record.images = [image]
  return record
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load existing Mooncat slugs from DB
  const { data: brand } = await supabase.from('brands').select('id').eq('slug', 'mooncat').single()
  if (!brand) { console.error('Mooncat not found in DB'); process.exit(1) }

  const { data: existing } = await supabase
    .from('polishes').select('slug').eq('brand_id', brand.id)

  const existingSlugs = new Set(existing.map(p => p.slug))
  console.log(`${existingSlugs.size} Mooncat polishes already in DB\n`)

  // Get the full universe of known handles from the Wayback Machine
  const allHandles = await getHandlesFromCdx()
  console.log(`${allHandles.length} unique product handles found in Wayback Machine index`)

  // Filter to handles we don't already have and that look like polish
  const unknown = allHandles.filter(h => !existingSlugs.has(h) && isActualPolish(h, h))
  console.log(`${unknown.length} handles not in DB (after filtering non-polish)\n`)

  if (unknown.length === 0) {
    console.log('Nothing new to add.')
    return
  }

  // Fetch product data for each unknown handle
  const records = []
  let liveCount = 0, waybackCount = 0, failCount = 0

  for (let i = 0; i < unknown.length; i++) {
    const handle = unknown[i]
    process.stdout.write(`  [${i + 1}/${unknown.length}] ${handle}... `)
    await sleep(250)

    const result = await fetchProductJson(handle)
    if (!result) {
      console.log('not found')
      failCount++
      continue
    }

    const { product, source } = result
    if (!isActualPolish(product.title, product.handle)) {
      console.log('skip (non-polish)')
      continue
    }

    const record = productToRecord(product, brand.id)
    records.push(record)
    if (source === 'live') liveCount++; else waybackCount++

    const img = record.images?.length ? '📸' : '  '
    const le  = record.is_limited ? ' [LE]' : ''
    console.log(`${source === 'live' ? '✓' : '⏱'} ${img} ${record.finish_category.padEnd(12)} ${record.name}${le}`)
  }

  console.log(`\n── Summary ─────────────────────────────────────────────────────────────`)
  console.log(`  ${records.length} polishes ready to add`)
  console.log(`  ${liveCount} fetched live · ${waybackCount} from Wayback · ${failCount} not found`)
  console.log(`  ${records.filter(r => r.images?.length).length} with images`)

  if (DRY_RUN || !INSERT) {
    console.log('\nPass --insert to upsert into the DB.')
    return
  }

  console.log('\nUpserting...')
  let total = 0
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100)
    const { error } = await supabase
      .from('polishes')
      .upsert(batch, { onConflict: 'brand_id,slug', ignoreDuplicates: false })
    if (error) { console.error('Upsert error:', error); process.exit(1) }
    total += batch.length
    process.stdout.write(`  ${total}/${records.length}\r`)
  }

  console.log(`\nDone — ${total} discontinued Mooncat polishes added.`)
}

main().catch(e => { console.error(e); process.exit(1) })
