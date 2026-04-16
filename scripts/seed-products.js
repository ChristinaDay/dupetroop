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
