#!/usr/bin/env node
/**
 * DupeTroop — Full catalog seed
 *
 * Fetches complete product catalogs (not just best-sellers) from each brand.
 * Non-polish products (base coats, top coats, tools, kits, etc.) are filtered out.
 *
 * Sources:
 *   Holo Taco, Mooncat, Cirque Colors, Rogue Lacquer — Shopify /collections/all (paginated)
 *   ILNP                                              — WooCommerce Store API (all categories)
 *   Glisten & Glow                                    — BigCartel /products.json
 *   KBShimmer                                         — Headless browser (Cloudflare protected)
 *   OPI, Essie, Zoya                                  — Manually curated (sites not scrapeable)
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-products.js
 *   node --env-file=.env.local scripts/seed-products.js --dry-run
 *   node --env-file=.env.local scripts/seed-products.js --brand mooncat
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Run with: node --env-file=.env.local scripts/seed-products.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')
const BRAND_FILTER = process.argv.find(a => a.startsWith('--brand='))?.split('=')[1]
  ?? (process.argv.includes('--brand') ? process.argv[process.argv.indexOf('--brand') + 1] : null)

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
}

// ─── Non-polish filter ────────────────────────────────────────────────────────
// "Topper" = a color-over-color polish — keep. "Top coat" = clear functional coat — exclude.

// Exclude accessories and non-polish consumables only.
// Top coats, base coats, treatments, and nail care products ARE kept —
// people own and dupe these just like regular polish.
const NON_POLISH_KEYWORDS = [
  'bundle', 'gift', 'kit', 'set', 'remover', 'file', 'buffer',
  'sticker', 'nail art', 'replacement', 'brush', 'spatula', 'duo', 'trio',
  'quad', 'thinner', 'dropper', 'refill', 'prep pad', 'nail glue',
  'acetone', 'cleanser', 'dehydrator', 'nail polish remover',
]

const NON_POLISH_PRODUCT_TYPES = [
  'nail tool', 'nail art',
]

function isActualPolish(name, productType = '') {
  const t = name.toLowerCase()
  const pt = productType.toLowerCase()
  if (NON_POLISH_KEYWORDS.some(k => t.includes(k))) return false
  if (NON_POLISH_PRODUCT_TYPES.some(k => pt.includes(k))) return false
  return true
}

// ─── Tag → DB field mappings ──────────────────────────────────────────────────

const FINISH_MAP = {
  'holographic': 'holo',   'holo':        'holo',
  'flakie':      'flakies', 'flakies':    'flakies',
  'glitter':     'glitter', 'shimmer':    'shimmer',
  'duochrome':   'duochrome', 'multichrome': 'multichrome', 'chrome': 'multichrome',
  'magnetic':    'magnetic',
  'creme':       'cream',  'cream':       'cream',
  'jelly':       'jelly',  'matte':       'matte',  'satin': 'satin',
  'topper':      'topper',
}

const COLOR_HEX_MAP = {
  'red': '#CC1B2E', 'maroon': '#6B1A2A', 'orange': '#E8602C', 'yellow': '#E8B424',
  'green': '#2E7D4A', 'teal': '#2A8A7A', 'blue': '#2458B8', 'purple': '#6B2EA0',
  'pink': '#E03880', 'rose-gold': '#D4856A', 'white': '#F8F8F8', 'black': '#111111',
  'silver': '#C8C8D0', 'gold': '#C8A832', 'brown': '#8B5E3C', 'neutral': '#B8A8A0',
  'clear': '#F0F0F0', 'coral': '#E06040',
}

const COLOR_FAMILY_MAP = {
  'red': 'red', 'maroon': 'red', 'coral': 'pink', 'orange': 'orange',
  'yellow': 'yellow', 'gold': 'yellow', 'green': 'green', 'teal': 'green',
  'blue': 'blue', 'purple': 'purple', 'pink': 'pink', 'rose-gold': 'pink',
  'white': 'neutral', 'clear': 'neutral', 'neutral': 'neutral', 'brown': 'neutral',
  'black': 'black', 'silver': 'neutral',
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
  const hex = primaryColor ? (COLOR_HEX_MAP[primaryColor] ?? '#888888') : '#888888'
  const colorFamily = primaryColor ? (COLOR_FAMILY_MAP[primaryColor] ?? 'neutral') : 'neutral'
  const isLimited = tags.some(t => ['limited', 'limited-edition', 'le'].includes(t.toLowerCase()))

  return { finish, hex, colorFamily, isLimited }
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Infer finish from product title keywords (used for brands that embed finish in the name)
function finishFromName(name) {
  const t = name.toLowerCase()
  if (t.includes('multichrome') || t.includes('multi-chrome')) return 'multichrome'
  if (t.includes('duochrome') || t.includes('duo-chrome')) return 'duochrome'
  if (t.includes('magnetic')) return 'magnetic'
  if (t.includes('holographic') || t.includes(' holo ') || t.includes('holo polish')) return 'holo'
  if (t.includes('reflective')) return 'holo'
  if (t.includes('flakie') || t.includes('flakies')) return 'flakies'
  if (t.includes('glitter')) return 'glitter'
  if (t.includes('shimmer')) return 'shimmer'
  if (t.includes('thermal')) return 'other'
  if (t.includes('jelly') || t.includes('crelly')) return 'jelly'
  if (t.includes('matte')) return 'matte'
  if (t.includes('crème') || t.includes('creme') || t.includes('crème')) return 'cream'
  if (t.includes('topper') || t.includes('top coat')) return 'topper'
  return 'other'
}

// ─── Shopify — full catalog with pagination ───────────────────────────────────

async function fetchShopifyAllProducts(domain, collection = 'all') {
  const results = []
  let page = 1
  while (true) {
    const url = `https://${domain}/collections/${collection}/products.json?limit=250&page=${page}`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) throw new Error(`${res.status} fetching ${url}`)
    const { products } = await res.json()
    if (!products?.length) break
    for (const p of products) {
      if (isActualPolish(p.title, p.product_type ?? '')) results.push(p)
    }
    if (products.length < 250) break
    page++
    await sleep(300)
  }
  return results
}

function shopifyProductToPolish(product, brandId, msrp) {
  const { finish, hex, colorFamily, isLimited } = parseTags(product.tags)
  const image = product.images?.[0]?.src ?? null
  const record = {
    brand_id:        brandId,
    name:            product.title,
    slug:            product.handle,
    hex_color:       hex,
    finish_category: finish,
    color_family:    colorFamily,
    msrp_usd:        msrp,
    is_verified:     true,
    is_limited:      isLimited,
  }
  // Only include images when we actually have one — omitting preserves any backfilled image on upsert
  if (image) record.images = [image]
  return record
}

// ─── ILNP — WooCommerce Store API (all categories, no limit) ─────────────────

const WOO_FINISH_MAP = {
  magnetic: 'magnetic', multichrome: 'multichrome', duochrome: 'duochrome',
  holographic: 'holo', holo: 'holo', glitter: 'glitter', shimmer: 'shimmer',
  flakies: 'flakies', flakie: 'flakies', jelly: 'jelly', matte: 'matte',
  satin: 'satin', cream: 'cream', creme: 'cream', topper: 'topper',
}

function parseWooTags(tags = []) {
  const tagNames = tags.map(t => (t.name ?? t).toLowerCase())
  const finishOrder = ['magnetic', 'multichrome', 'duochrome', 'flakies', 'flakie', 'glitter',
    'holographic', 'holo', 'shimmer', 'jelly', 'matte', 'satin', 'cream', 'creme', 'topper']
  for (const f of finishOrder) {
    if (tagNames.some(t => t.includes(f))) return WOO_FINISH_MAP[f] ?? 'other'
  }
  return 'other'
}

async function fetchILNPProducts(brandId) {
  const results = []
  const seen = new Set()
  const categories = ['boutique-effect-nail-polish', 'studio-color-nail-polish']

  for (const category of categories) {
    let page = 1
    while (true) {
      const url = `https://www.ilnp.com/wp-json/wc/store/v1/products?per_page=100&page=${page}&category=${category}`
      const res = await fetch(url, { headers: HEADERS })
      if (!res.ok) break
      const products = await res.json()
      if (!products.length) break

      for (const p of products) {
        if (seen.has(p.id)) continue
        if (!isActualPolish(p.name)) continue
        seen.add(p.id)

        const image = p.images?.[0]?.src ?? null
        const finish = parseWooTags(p.tags ?? [])
        const record = {
          brand_id: brandId,
          name: p.name,
          slug: p.slug,
          hex_color: '#888888',
          finish_category: finish,
          color_family: 'neutral',
          msrp_usd: parseFloat(p.prices?.price ?? '1100') / 100 || 11,
          is_verified: true,
          is_limited: false,
        }
        if (image) record.images = [image]
        results.push(record)
      }

      if (products.length < 100) break
      page++
      await sleep(200)
    }
  }
  return results
}

// ─── Glisten & Glow — BigCartel products.json ────────────────────────────────

async function fetchGlistenAndGlow(brandId) {
  const res = await fetch('https://www.glistenandglow.com/products.json', { headers: HEADERS })
  if (!res.ok) throw new Error(`BigCartel products.json failed: ${res.status}`)
  const data = await res.json()

  // Response is a plain array (numeric keys, not { products: [] })
  const products = Array.isArray(data) ? data : Object.values(data)

  return products
    .filter(p => p.status === 'active' && isActualPolish(p.name))
    .map(p => {
      const image = p.images?.[0]?.url ?? null
      const record = {
        brand_id:        brandId,
        name:            p.name,
        slug:            p.permalink,
        hex_color:       '#888888',
        finish_category: 'other',
        color_family:    'neutral',
        msrp_usd:        p.price ? Number(p.price) / 100 : 11,
        is_verified:     true,
        is_limited:      false,
      }
      if (image) record.images = [image]
      return record
    })
}

// ─── KBShimmer — headless browser (Cloudflare protected) ─────────────────────
// Uses the paginated catalog at /nail-polish/?p=catalog&parent=1041&pagesize=144
// Each page returns up to 144 products; we stop when a page returns 0 or times out.

async function fetchKBShimmerCatalog(brandId) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ userAgent: HEADERS['User-Agent'] })
  const page = await context.newPage()
  const results = []
  const seen = new Set()

  try {
    let pg = 1
    while (true) {
      const url = `https://www.kbshimmer.com/nail-polish/?p=catalog&mode=catalog&parent=1041&pg=${pg}&pagesize=144`
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
      } catch {
        console.error(`  KBShimmer page ${pg} timed out — stopping`)
        break
      }

      const products = await page.$$eval('.catalog-product', items =>
        items.map(el => {
          const anchor = el.querySelector('.catalog-product-title a')
          const title = anchor?.textContent?.trim() ?? null
          const href = anchor?.getAttribute('href') ?? null
          const imgs = [...el.querySelectorAll('img')]
          const img = imgs.find(i => {
            const s = i.getAttribute('src') ?? ''
            return s.includes('images/products') || s.includes('/products/')
          }) ?? null
          const src = img?.getAttribute('src') ?? null
          return { title, href, src }
        }).filter(p => p.title)
      )

      if (!products.length) break

      for (const { title, href, src } of products) {
        if (!isActualPolish(title)) continue
        if (seen.has(title)) continue
        seen.add(title)

        const image = src
          ? (src.startsWith('http') ? src : src.startsWith('//') ? `https:${src}` : `https://www.kbshimmer.com/${src.replace(/^\//, '')}`)
          : null

        const slugFromHref = href
          ? new URL(href, 'https://www.kbshimmer.com').pathname.replace(/^\/|\/$/g, '')
          : null

        const record = {
          brand_id: brandId, name: title,
          slug: slugFromHref || slugify(title),
          hex_color: '#888888', finish_category: finishFromName(title),
          color_family: 'neutral', msrp_usd: 13,
          is_verified: true, is_limited: false,
        }
        if (image) record.images = [image]
        results.push(record)
      }

      process.stdout.write(` (page ${pg}: ${products.length})`)
      if (products.length < 144) break
      pg++
      await sleep(1000) // polite delay between pages
    }
    process.stdout.write('\n')
  } finally {
    await context.close()
    await browser.close()
  }

  return results
}

// ─── Manually curated ─────────────────────────────────────────────────────────

function manual(brandId, products) {
  // Do NOT include images: [] — omitting leaves backfilled images untouched on upsert
  return products.map(p => ({ brand_id: brandId, is_verified: true, is_limited: false, ...p }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function upsertBatch(polishes, batchSize = 200) {
  let inserted = 0
  for (let i = 0; i < polishes.length; i += batchSize) {
    const batch = polishes.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('polishes')
      .upsert(batch, { onConflict: 'brand_id,slug', ignoreDuplicates: false })
      .select('id')
    if (error) { console.error('  Upsert error:', error.message); continue }
    inserted += data.length
  }
  return inserted
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '🔍  Dry run — no writes\n' : '✏️   Writing to Supabase\n')
  if (BRAND_FILTER) console.log(`Filtering to brand: ${BRAND_FILTER}\n`)

  const { data: brands } = await supabase.from('brands').select('id, slug')
  const brandId = Object.fromEntries(brands.map(b => [b.slug, b.id]))

  const should = slug => !BRAND_FILTER || BRAND_FILTER === slug

  let totalUpserted = 0

  // ── Holo Taco ────────────────────────────────────────────────────────────────
  if (should('holo-taco')) {
    process.stdout.write('Fetching Holo Taco (full catalog)... ')
    try {
      const products = await fetchShopifyAllProducts('holotaco.com')
      const polishes = products.map(p => shopifyProductToPolish(p, brandId['holo-taco'], 13))
      console.log(`${polishes.length} polishes`)
      if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
      else polishes.forEach(p => console.log(`  ${p.finish_category.padEnd(12)} ${p.name}`))
    } catch (e) { console.error('\n  Error:', e.message) }
  }

  // ── Mooncat ──────────────────────────────────────────────────────────────────
  if (should('mooncat')) {
    process.stdout.write('Fetching Mooncat (full catalog)... ')
    try {
      const products = await fetchShopifyAllProducts('mooncat.com')
      const polishes = products.map(p => shopifyProductToPolish(p, brandId['mooncat'], 12))
      console.log(`${polishes.length} polishes`)
      if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
      else polishes.forEach(p => console.log(`  ${p.finish_category.padEnd(12)} ${p.name}`))
    } catch (e) { console.error('\n  Error:', e.message) }
  }

  // ── Cirque Colors ─────────────────────────────────────────────────────────────
  if (should('cirque-colors')) {
    process.stdout.write('Fetching Cirque Colors (full catalog)... ')
    try {
      const products = await fetchShopifyAllProducts('cirquecolors.com')
      const polishes = products.map(p => shopifyProductToPolish(p, brandId['cirque-colors'], 16))
      console.log(`${polishes.length} polishes`)
      if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
      else polishes.forEach(p => console.log(`  ${p.finish_category.padEnd(12)} ${p.name}`))
    } catch (e) { console.error('\n  Error:', e.message) }
  }

  // ── Rogue Lacquer ─────────────────────────────────────────────────────────────
  if (should('rogue-lacquer')) {
    process.stdout.write('Fetching Rogue Lacquer (full catalog)... ')
    try {
      const products = await fetchShopifyAllProducts('roguelacquer.com')
      const polishes = products.map(p => shopifyProductToPolish(p, brandId['rogue-lacquer'], 13))
      console.log(`${polishes.length} polishes`)
      if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
      else polishes.forEach(p => console.log(`  ${p.finish_category.padEnd(12)} ${p.name}`))
    } catch (e) { console.error('\n  Error:', e.message) }
  }

  // ── ILNP ─────────────────────────────────────────────────────────────────────
  if (should('ilnp')) {
    process.stdout.write('Fetching ILNP (full catalog via WooCommerce API)... ')
    try {
      const polishes = await fetchILNPProducts(brandId['ilnp'])
      console.log(`${polishes.length} polishes`)
      if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
      else polishes.forEach(p => console.log(`  ${p.finish_category.padEnd(12)} ${p.name}`))
    } catch (e) { console.error('\n  Error:', e.message) }
  }

  // ── Glisten & Glow ────────────────────────────────────────────────────────────
  if (should('glisten-and-glow')) {
    process.stdout.write('Fetching Glisten & Glow (BigCartel products.json)... ')
    try {
      const polishes = await fetchGlistenAndGlow(brandId['glisten-and-glow'])
      console.log(`${polishes.length} polishes`)
      if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
      else polishes.forEach(p => console.log(`  ${p.finish_category.padEnd(12)} ${p.name}`))
    } catch (e) { console.error('\n  Error:', e.message) }
  }

  // ── KBShimmer ────────────────────────────────────────────────────────────────
  if (should('kbshimmer')) {
    process.stdout.write('Fetching KBShimmer (headless browser)... ')
    try {
      const polishes = await fetchKBShimmerCatalog(brandId['kbshimmer'])
      console.log(`${polishes.length} polishes`)
      if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
      else polishes.forEach(p => console.log(`  ${p.finish_category.padEnd(12)} ${p.name}`))
    } catch (e) { console.error('\n  Error:', e.message) }
  }

  // ── Pahlish (Shopify API) ─────────────────────────────────────────────────────
  if (should('pahlish')) {
    process.stdout.write('Fetching Pahlish (full catalog)... ')
    try {
      const products = await fetchShopifyAllProducts('pahlish.com')
      const polishes = products.map(p => shopifyProductToPolish(p, brandId['pahlish'], 13))
      console.log(`${polishes.length} polishes`)
      if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
      else polishes.forEach(p => console.log(`  ${p.finish_category.padEnd(12)} ${p.name}`))
    } catch (e) { console.error('\n  Error:', e.message) }
  }

  // ── Supernatural (manual — site blocked) ──────────────────────────────────────
  if (should('supernatural')) {
    console.log('Adding Supernatural (manual)...')
    const polishes = manual(brandId['supernatural'], [
      { name: "What's This?",           slug: 'whats-this',               hex_color: '#1A2060', hex_secondary: '#B84090', finish_category: 'multichrome', color_family: 'blue',    msrp_usd: 13 },
      { name: 'Foxglove',               slug: 'foxglove',                 hex_color: '#7B4B8A',                           finish_category: 'multichrome', color_family: 'purple',  msrp_usd: 13 },
      { name: 'Soul in the Sky',        slug: 'soul-in-the-sky',          hex_color: '#1A1878', hex_secondary: '#B83020', finish_category: 'multichrome', color_family: 'blue',    msrp_usd: 13 },
      { name: 'Kyber Crystal',          slug: 'kyber-crystal',            hex_color: '#E8E0DC',                           finish_category: 'holo',        color_family: 'neutral', msrp_usd: 13 },
      { name: 'Duel On Mustafar',       slug: 'duel-on-mustafar',         hex_color: '#0A0A0A', hex_secondary: '#C05020', finish_category: 'multichrome', color_family: 'black',   msrp_usd: 13 },
      { name: 'Yggdrasil',              slug: 'yggdrasil',                hex_color: '#4A5020',                           finish_category: 'multichrome', color_family: 'green',   msrp_usd: 13, is_limited: true },
      { name: '5th Gen Console Freak',  slug: '5th-gen-console-freak',    hex_color: '#787878', hex_secondary: '#9040B0', finish_category: 'multichrome', color_family: 'neutral', msrp_usd: 13 },
      { name: 'Poison',                 slug: 'poison',                   hex_color: '#8B1020',                           finish_category: 'magnetic',    color_family: 'red',     msrp_usd: 13 },
      { name: 'Venom',                  slug: 'venom',                    hex_color: '#2A4018',                           finish_category: 'magnetic',    color_family: 'green',   msrp_usd: 13 },
      { name: 'Chromosphere',           slug: 'chromosphere',             hex_color: '#B03060', hex_secondary: '#C07020', finish_category: 'holo',        color_family: 'pink',    msrp_usd: 13 },
    ])
    if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
  }

  // ── Girly Bits (manual — site protected) ──────────────────────────────────────
  if (should('girly-bits')) {
    console.log('Adding Girly Bits (manual)...')
    const polishes = manual(brandId['girly-bits'], [
      { name: 'Very Important Polish',                     slug: 'very-important-polish',                   hex_color: '#1A0820', hex_secondary: '#C05080', finish_category: 'multichrome', color_family: 'black',   msrp_usd: 11 },
      { name: 'Not Plain White',                           slug: 'not-plain-white',                         hex_color: '#E8E4F4', hex_secondary: '#C080D0', finish_category: 'multichrome', color_family: 'neutral', msrp_usd: 11 },
      { name: 'Dreamlike',                                 slug: 'dreamlike',                               hex_color: '#3A60A0', hex_secondary: '#A060D0', finish_category: 'holo',        color_family: 'blue',    msrp_usd: 11 },
      { name: 'Seriously Sassy',                           slug: 'seriously-sassy',                         hex_color: '#4A2060',                           finish_category: 'jelly',       color_family: 'purple',  msrp_usd: 11 },
      { name: 'Bird Is The Word',                          slug: 'bird-is-the-word',                        hex_color: '#B83090',                           finish_category: 'holo',        color_family: 'pink',    msrp_usd: 11 },
      { name: "What The Deuce?",                           slug: 'what-the-deuce',                          hex_color: '#2A8040',                           finish_category: 'holo',        color_family: 'green',   msrp_usd: 11 },
      { name: 'One Is Never Un Oeuf',                      slug: 'one-is-never-un-oeuf',                    hex_color: '#2A8078',                           finish_category: 'holo',        color_family: 'green',   msrp_usd: 11 },
      { name: "I Don't Think You're Ready For This Jelly", slug: 'i-dont-think-youre-ready-for-this-jelly', hex_color: '#C890D8',                           finish_category: 'flakies',     color_family: 'purple',  msrp_usd: 11 },
      { name: 'Chi Skyline',                               slug: 'chi-skyline',                             hex_color: '#E860A0',                           finish_category: 'flakies',     color_family: 'pink',    msrp_usd: 11 },
      { name: 'Bette Davis Eyes',                          slug: 'bette-davis-eyes',                        hex_color: '#E8E8F0',                           finish_category: 'holo',        color_family: 'neutral', msrp_usd: 11 },
      { name: 'Walk Like an Egyptian',                     slug: 'walk-like-an-egyptian',                   hex_color: '#C8A030',                           finish_category: 'holo',        color_family: 'yellow',  msrp_usd: 11 },
    ])
    if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
  }

  // ── Wildflower Lacquer (manual — API blocked) ─────────────────────────────────
  if (should('wildflower-lacquer')) {
    console.log('Adding Wildflower Lacquer (manual)...')
    const polishes = manual(brandId['wildflower-lacquer'], [
      { name: 'Aretha',                slug: 'aretha',                hex_color: '#E8B830', hex_secondary: '#C08030', finish_category: 'multichrome', color_family: 'yellow',  msrp_usd: 13 },
      { name: 'Audrey',                slug: 'audrey',                hex_color: '#8B1830',                           finish_category: 'holo',        color_family: 'red',     msrp_usd: 13 },
      { name: 'Billie',                slug: 'billie',                hex_color: '#D0D0D8', hex_secondary: '#E090B0', finish_category: 'multichrome', color_family: 'neutral', msrp_usd: 13 },
      { name: 'Judy',                  slug: 'judy',                  hex_color: '#6B1040', hex_secondary: '#A040A0', finish_category: 'multichrome', color_family: 'red',     msrp_usd: 13 },
      { name: 'Lucille',               slug: 'lucille',               hex_color: '#E8C8C4', hex_secondary: '#D09090', finish_category: 'multichrome', color_family: 'pink',    msrp_usd: 13 },
      { name: 'Marilyn',               slug: 'marilyn',               hex_color: '#C83020', hex_secondary: '#D06030', finish_category: 'multichrome', color_family: 'red',     msrp_usd: 13 },
      { name: 'Patsy',                 slug: 'patsy',                 hex_color: '#1A6868',                           finish_category: 'holo',        color_family: 'green',   msrp_usd: 13 },
      { name: 'Ceiling Full of Stars', slug: 'ceiling-full-of-stars', hex_color: '#C8E8D0', hex_secondary: '#A0D0B8', finish_category: 'holo',        color_family: 'green',   msrp_usd: 13 },
      { name: 'Juice Bar',             slug: 'juice-bar',             hex_color: '#D84080', hex_secondary: '#E06050', finish_category: 'multichrome', color_family: 'pink',    msrp_usd: 13 },
      { name: 'Retro Roller Skates',   slug: 'retro-roller-skates',   hex_color: '#F0F0F4', hex_secondary: '#80C8E0', finish_category: 'holo',        color_family: 'neutral', msrp_usd: 13 },
    ])
    if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
  }

  // ── OPI (manual — site not scrapeable) ───────────────────────────────────────
  if (should('opi')) {
    console.log('Adding OPI (manual)...')
    const polishes = manual(brandId['opi'], [
      { name: "I'm Not Really a Waitress",    slug: 'im-not-really-a-waitress',    hex_color: '#9B1B2C', finish_category: 'shimmer', color_family: 'red',     msrp_usd: 11 },
      { name: 'Lincoln Park After Dark',      slug: 'lincoln-park-after-dark',     hex_color: '#2D1A3A', finish_category: 'cream',   color_family: 'purple',  msrp_usd: 11 },
      { name: 'Bubble Bath',                  slug: 'bubble-bath',                 hex_color: '#F0E0E4', finish_category: 'shimmer', color_family: 'pink',    msrp_usd: 11 },
      { name: 'Malaga Wine',                  slug: 'malaga-wine',                 hex_color: '#6B1A2A', finish_category: 'cream',   color_family: 'red',     msrp_usd: 11 },
      { name: 'OPI Red',                      slug: 'opi-red',                     hex_color: '#C01828', finish_category: 'cream',   color_family: 'red',     msrp_usd: 11 },
      { name: "Don't Bossa Nova Me Around",   slug: 'dont-bossa-nova-me-around',   hex_color: '#C82030', finish_category: 'cream',   color_family: 'red',     msrp_usd: 11 },
      { name: 'Icelanded a Bottle of OPI',    slug: 'icelanded-a-bottle-of-opi',   hex_color: '#A8C8D0', finish_category: 'cream',   color_family: 'blue',    msrp_usd: 11 },
      { name: 'Funny Bunny',                  slug: 'funny-bunny',                 hex_color: '#F5F0F0', finish_category: 'cream',   color_family: 'neutral', msrp_usd: 11 },
      { name: 'Alpine Snow',                  slug: 'alpine-snow',                 hex_color: '#F5F5F5', finish_category: 'cream',   color_family: 'neutral', msrp_usd: 11 },
    ])
    if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
  }

  // ── Essie (manual — Sitecore CMS, JS-rendered, Playwright + sitemap worked for 7/8) ──
  if (should('essie')) {
    console.log('Adding Essie (manual)...')
    const polishes = manual(brandId['essie'], [
      { name: 'Bordeaux',       slug: 'bordeaux',       hex_color: '#5A1528', finish_category: 'cream',   color_family: 'red',     msrp_usd: 10 },
      { name: 'Ballet Slippers',slug: 'ballet-slippers',hex_color: '#F2E0E4', finish_category: 'cream',   color_family: 'pink',    msrp_usd: 10 },
      { name: 'Wicked',         slug: 'wicked',         hex_color: '#3D1040', finish_category: 'cream',   color_family: 'purple',  msrp_usd: 10 },
      { name: 'Marshmallow',    slug: 'marshmallow',    hex_color: '#F5F2EE', finish_category: 'cream',   color_family: 'neutral', msrp_usd: 10 },
      { name: 'Fiji',           slug: 'fiji',           hex_color: '#E87060', finish_category: 'cream',   color_family: 'pink',    msrp_usd: 10 },
      { name: 'Geranium',       slug: 'geranium',       hex_color: '#E85040', finish_category: 'cream',   color_family: 'red',     msrp_usd: 10 },
      { name: 'Midnight Cami',  slug: 'midnight-cami',  hex_color: '#1A1830', finish_category: 'shimmer', color_family: 'blue',    msrp_usd: 10 },
    ])
    if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
  }

  // ── Sally Hansen (manual — Coty corporate site) ───────────────────────────────
  if (should('sally-hansen')) {
    console.log('Adding Sally Hansen (manual)...')
    const polishes = manual(brandId['sally-hansen'], [
      // Complete Salon Manicure
      { name: 'Commander in Chic',  slug: 'commander-in-chic',  hex_color: '#8B7060', finish_category: 'cream',   color_family: 'neutral', msrp_usd: 7 },
      { name: 'Arm Candy',          slug: 'arm-candy',          hex_color: '#F0D8D8', finish_category: 'cream',   color_family: 'pink',    msrp_usd: 7 },
      { name: 'Gilty Party',        slug: 'gilty-party',        hex_color: '#C89870', finish_category: 'shimmer', color_family: 'neutral', msrp_usd: 7 },
      // Miracle Gel
      { name: 'Greyfitti',          slug: 'greyfitti',          hex_color: '#A0B0C0', finish_category: 'cream',   color_family: 'blue',    msrp_usd: 10 },
      { name: 'Stilettos & Studs',  slug: 'stilettos-and-studs', hex_color: '#606070', finish_category: 'shimmer', color_family: 'neutral', msrp_usd: 10 },
      { name: 'Metro Midnight',     slug: 'metro-midnight',     hex_color: '#1A1A30', finish_category: 'cream',   color_family: 'blue',    msrp_usd: 10 },
      { name: 'Jealous Boyfriend',  slug: 'jealous-boyfriend',  hex_color: '#6B1A1A', finish_category: 'cream',   color_family: 'red',     msrp_usd: 10 },
      { name: 'Bourbon Belle',      slug: 'bourbon-belle',      hex_color: '#6B1828', finish_category: 'cream',   color_family: 'red',     msrp_usd: 10 },
      // Insta-Dri Prismatic Shine
      { name: 'Moonstone',          slug: 'moonstone',          hex_color: '#E8F0F8', hex_secondary: '#A0C0E8', finish_category: 'shimmer', color_family: 'blue',    msrp_usd: 8 },
      { name: 'Pink Aurora',        slug: 'pink-aurora',        hex_color: '#E060A0', hex_secondary: '#A040C0', finish_category: 'holo',    color_family: 'pink',    msrp_usd: 8 },
      { name: 'Cosmic Blu',         slug: 'cosmic-blu',         hex_color: '#B0C8E8', hex_secondary: '#80A8D0', finish_category: 'shimmer', color_family: 'blue',    msrp_usd: 8 },
    ])
    if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
  }

  // ── Zoya (manual — Magento / artofbeauty.com, sitemap worked for 6/7) ────────
  if (should('zoya')) {
    console.log('Adding Zoya (manual)...')
    const polishes = manual(brandId['zoya'], [
      { name: 'Posh',      slug: 'posh',      hex_color: '#D4A8B8', finish_category: 'shimmer', color_family: 'pink',    msrp_usd: 10 },
      { name: 'Raven',     slug: 'raven',     hex_color: '#0A0A0A', finish_category: 'cream',   color_family: 'black',   msrp_usd: 10 },
      { name: 'Seraphina', slug: 'seraphina', hex_color: '#8B4570', finish_category: 'shimmer', color_family: 'purple',  msrp_usd: 10 },
      { name: 'Pippa',     slug: 'pippa',     hex_color: '#D83020', finish_category: 'cream',   color_family: 'red',     msrp_usd: 10 },
      { name: 'Sooki',     slug: 'sooki',     hex_color: '#E89070', finish_category: 'cream',   color_family: 'pink',    msrp_usd: 10 },
      { name: 'Frida',     slug: 'frida',     hex_color: '#C82060', finish_category: 'cream',   color_family: 'pink',    msrp_usd: 10 },
      { name: 'Storm',     slug: 'storm',     hex_color: '#6080A0', finish_category: 'cream',   color_family: 'blue',    msrp_usd: 10 },
    ])
    if (!DRY_RUN) totalUpserted += await upsertBatch(polishes)
  }

  if (!DRY_RUN) {
    console.log(`\n✓ Total upserted: ${totalUpserted}`)
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
