#!/usr/bin/env node
/**
 * DupeTroop — Real product seed
 *
 * Supplements the placeholder seed with real, well-known polishes.
 *
 * Sources:
 *   Holo Taco, Mooncat — fetched live from Shopify best-sellers collections
 *   KBShimmer, ILNP, Cirque Colors, Glisten & Glow, Rogue Lacquer — manually curated
 *   OPI, Essie, Zoya — manually curated mainstream picks
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-products.js
 *   node --env-file=.env.local scripts/seed-products.js --dry-run
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

// ─── Tag → DB field mappings ──────────────────────────────────────────────────

const FINISH_MAP = {
  'holographic': 'holo',
  'holo':        'holo',
  'flakie':      'flakies',
  'flakies':     'flakies',
  'glitter':     'glitter',
  'shimmer':     'shimmer',
  'duochrome':   'duochrome',
  'multichrome': 'multichrome',
  'chrome':      'multichrome',
  'magnetic':    'magnetic',
  'creme':       'cream',
  'cream':       'cream',
  'jelly':       'jelly',
  'matte':       'matte',
  'satin':       'satin',
  'topper':      'topper',
}

const COLOR_HEX_MAP = {
  'red':       '#CC1B2E',
  'maroon':    '#6B1A2A',
  'orange':    '#E8602C',
  'yellow':    '#E8B424',
  'green':     '#2E7D4A',
  'teal':      '#2A8A7A',
  'blue':      '#2458B8',
  'purple':    '#6B2EA0',
  'pink':      '#E03880',
  'rose-gold': '#D4856A',
  'white':     '#F8F8F8',
  'black':     '#111111',
  'silver':    '#C8C8D0',
  'gold':      '#C8A832',
  'brown':     '#8B5E3C',
  'neutral':   '#B8A8A0',
  'clear':     '#F0F0F0',
  'coral':     '#E06040',
}

const COLOR_FAMILY_MAP = {
  'red': 'red', 'maroon': 'red', 'coral': 'pink',
  'orange': 'orange',
  'yellow': 'yellow', 'gold': 'yellow',
  'green': 'green', 'teal': 'green',
  'blue': 'blue',
  'purple': 'purple',
  'pink': 'pink', 'rose-gold': 'pink',
  'white': 'neutral', 'clear': 'neutral', 'neutral': 'neutral', 'brown': 'neutral',
  'black': 'black',
  'silver': 'neutral',
}

// ─── Parse Shopify tags ───────────────────────────────────────────────────────

function parseTags(rawTags) {
  const tags = Array.isArray(rawTags)
    ? rawTags
    : (rawTags || '').split(',').map(t => t.trim())

  const finishTags = tags.filter(t => t.startsWith('finish:')).map(t => t.replace('finish:', ''))
  const colorTags  = tags.filter(t => t.startsWith('color:')).map(t => t.replace('color:', ''))

  // Pick best finish (prefer specific over generic)
  const finishOrder = ['magnetic', 'multichrome', 'duochrome', 'flakies', 'flakie', 'glitter', 'holographic', 'holo', 'shimmer', 'jelly', 'matte', 'satin', 'cream', 'creme', 'topper']
  let finish = 'other'
  for (const preferred of finishOrder) {
    if (finishTags.includes(preferred)) { finish = FINISH_MAP[preferred] ?? 'other'; break }
  }

  // Pick primary color (skip clear/silver for multi-color products)
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

// ─── Fetch from Shopify best-sellers ─────────────────────────────────────────

const BUNDLE_KEYWORDS = ['bundle', 'gift', 'kit', 'set', 'oil', 'remover', 'file', 'buffer',
  'sticker', 'nail art', 'replacement', 'brush', 'spatula', 'capsule collection', 'duo', 'trio',
  'quad', 'collection', 'thinner', 'dropper', 'refill', 'prep', 'restore']

function isActualPolish(product) {
  const t = product.title.toLowerCase()
  return !BUNDLE_KEYWORDS.some(k => t.includes(k))
}

async function fetchShopifyBestSellers(domain, collection, limit = 20) {
  const url = `https://${domain}/collections/${collection}/products.json?limit=${limit}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36' }
  })
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`)
  const data = await res.json()
  return (data.products ?? []).filter(isActualPolish)
}

function shopifyProductToPolish(product, brandId, msrp) {
  const { finish, hex, colorFamily, isLimited } = parseTags(product.tags)
  const image = product.images?.[0]?.src ?? null
  return {
    brand_id:        brandId,
    name:            product.title,
    slug:            product.handle,
    hex_color:       hex,
    finish_category: finish,
    color_family:    colorFamily,
    msrp_usd:        msrp,
    is_verified:     true,
    is_limited:      isLimited,
    images:          image ? [image] : [],
  }
}

// ─── Fetch from WooCommerce Store API (ILNP) ─────────────────────────────────

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

async function fetchILNPProducts(brandId, categories, limitPerCategory = 15) {
  const results = []
  const seen = new Set()
  const headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }

  for (const category of categories) {
    let page = 1
    let fetched = 0

    while (fetched < limitPerCategory) {
      const url = `https://www.ilnp.com/wp-json/wc/store/v1/products?per_page=100&page=${page}&category=${category}`
      const res = await fetch(url, { headers })
      if (!res.ok) break
      const products = await res.json()
      if (!products.length) break

      for (const p of products) {
        if (fetched >= limitPerCategory) break
        if (seen.has(p.id)) continue
        seen.add(p.id)

        const image = p.images?.[0]?.src ?? null
        const finish = parseWooTags(p.tags ?? [])
        results.push({
          brand_id: brandId,
          name: p.name,
          slug: p.slug,
          hex_color: '#888888',
          finish_category: finish,
          color_family: 'neutral',
          msrp_usd: parseFloat(p.prices?.price ?? '1100') / 100 || 11,
          is_verified: true,
          is_limited: false,
          images: image ? [image] : [],
        })
        fetched++
      }

      if (products.length < 100) break
      page++
    }
  }
  return results
}

// ─── Fetch from Glisten & Glow (BigCartel) ───────────────────────────────────

async function fetchGlistenAndGlow(brandId, limit = 20) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
  const base = 'https://www.glistenandglow.com'

  // Fetch homepage to collect all product links
  const homeRes = await fetch(base, { headers })
  if (!homeRes.ok) throw new Error(`Homepage fetch failed: HTTP ${homeRes.status}`)
  const homeHtml = await homeRes.text()
  const productPaths = [...new Set(
    [...homeHtml.matchAll(/href="(\/product\/[^"]+)"/gi)].map(m => m[1])
  )]

  const results = []
  const BUNDLE_KEYWORDS_LOWER = BUNDLE_KEYWORDS.map(k => k.toLowerCase())

  for (const path of productPaths) {
    if (results.length >= limit) break

    const res = await fetch(`${base}${path}`, { headers })
    if (!res.ok) continue
    const html = await res.text()

    const title = html.match(/<title>([^|<]+)/i)?.[1]?.trim() ?? null
    if (!title) continue
    if (BUNDLE_KEYWORDS_LOWER.some(k => title.toLowerCase().includes(k))) continue

    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
             ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
             ?? null
    // Skip if the og:image is just the store logo
    if (og?.includes('account_images')) continue

    const slug = path.replace('/product/', '')
    results.push({
      brand_id: brandId,
      name: title,
      slug,
      hex_color: '#888888',
      finish_category: 'other',
      color_family: 'neutral',
      msrp_usd: 11,
      is_verified: true,
      is_limited: false,
      images: og ? [og] : [],
    })
  }
  return results
}

// ─── Fetch from a custom storefront using a real browser ─────────────────────

const BUNDLE_KEYWORDS_LOWER = BUNDLE_KEYWORDS.map(k => k.toLowerCase())

/**
 * Fetch products from KBShimmer's custom PHP storefront via headless browser.
 * Returns array of { name, slug, images, finish_category, color_family, hex_color, msrp_usd }.
 */
async function fetchKBShimmerCatalog(brandId, limit = 30) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()
  const results = []

  try {
    await page.goto('https://www.kbshimmer.com/nail-polish/', { waitUntil: 'domcontentloaded', timeout: 20000 })

    const products = await page.$$eval('.catalog-product', items =>
      items.map(el => {
        const anchor = el.querySelector('.catalog-product-title a')
        const title = anchor?.textContent?.trim() ?? null
        const href = anchor?.getAttribute('href') ?? null
        // Prefer the product link's own image (the thumbnail anchor), not badge overlays.
        // Product images live under /images/products/; UI assets live under /content/skins/.
        const imgs = [...el.querySelectorAll('img')]
        const img = imgs.find(i => {
          const s = i.getAttribute('src') ?? ''
          return s.includes('images/products') || s.includes('/products/')
        }) ?? null
        const src = img?.getAttribute('src') ?? null
        return { title, href, src }
      }).filter(p => p.title && p.src)
    )

    for (const { title, href, src } of products) {
      if (BUNDLE_KEYWORDS_LOWER.some(k => title.toLowerCase().includes(k))) continue
      if (results.length >= limit) break

      // Make image URL absolute
      const image = src.startsWith('http') ? src
        : src.startsWith('//') ? `https:${src}`
        : `https://www.kbshimmer.com/${src.replace(/^\//, '')}`

      // Derive slug from the product page URL or from the title
      const slugFromHref = href
        ? new URL(href, 'https://www.kbshimmer.com').pathname.replace(/^\/|\/$/g, '')
        : null
      const slug = slugFromHref || slugify(title)

      results.push({
        brand_id: brandId,
        name: title,
        slug,
        hex_color: '#888888',
        finish_category: 'other',
        color_family: 'neutral',
        msrp_usd: 13,
        is_verified: true,
        is_limited: false,
        images: [image],
      })
    }
  } finally {
    await context.close()
    await browser.close()
  }

  return results
}

// ─── Manually curated products ───────────────────────────────────────────────

function manual(brandId, products) {
  return products.map(p => ({ brand_id: brandId, is_verified: true, is_limited: false, images: [], ...p }))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '🔍  Dry run — no writes\n' : '✏️   Writing to Supabase\n')

  // Load brand ID map
  const { data: brands } = await supabase.from('brands').select('id, slug')
  const brandId = Object.fromEntries(brands.map(b => [b.slug, b.id]))

  let allPolishes = []

  // ── Holo Taco (Shopify best-sellers) ────────────────────────────────────────
  console.log('Fetching Holo Taco best-sellers...')
  try {
    const htProducts = await fetchShopifyBestSellers('holotaco.com', 'best-sellers', 25)
    const htPolishes = htProducts.map(p => shopifyProductToPolish(p, brandId['holo-taco'], 13))
    console.log(`  ${htPolishes.length} products`)
    allPolishes.push(...htPolishes)
  } catch (e) {
    console.error('  Error:', e.message)
  }

  // ── Mooncat (Shopify best-sellers) ──────────────────────────────────────────
  console.log('Fetching Mooncat best-sellers...')
  try {
    const mcProducts = await fetchShopifyBestSellers('mooncat.com', 'best-sellers', 25)
    const mcPolishes = mcProducts.map(p => shopifyProductToPolish(p, brandId['mooncat'], 12))
    console.log(`  ${mcPolishes.length} products`)
    allPolishes.push(...mcPolishes)
  } catch (e) {
    console.error('  Error:', e.message)
  }

  // ── Cirque Colors (Shopify — only "all" collection is populated) ────────────
  console.log('Fetching Cirque Colors...')
  try {
    const ccProducts = await fetchShopifyBestSellers('cirquecolors.com', 'all', 20)
    const ccPolishes = ccProducts.map(p => shopifyProductToPolish(p, brandId['cirque-colors'], 16))
    console.log(`  ${ccPolishes.length} products`)
    allPolishes.push(...ccPolishes)
  } catch (e) {
    console.error('  Error:', e.message)
  }

  // ── Rogue Lacquer (Shopify best-sellers) ─────────────────────────────────────
  console.log('Fetching Rogue Lacquer best-sellers...')
  try {
    const rlProducts = await fetchShopifyBestSellers('roguelacquer.com', 'best-sellers', 20)
    const rlPolishes = rlProducts.map(p => shopifyProductToPolish(p, brandId['rogue-lacquer'], 13))
    console.log(`  ${rlPolishes.length} products`)
    allPolishes.push(...rlPolishes)
  } catch (e) {
    console.error('  Error:', e.message)
  }

  // ── KBShimmer (live browser fetch from kbshimmer.com/nail-polish/) ──────────
  console.log('Fetching KBShimmer catalog via browser...')
  try {
    const kbPolishes = await fetchKBShimmerCatalog(brandId['kbshimmer'], 30)
    console.log(`  ${kbPolishes.length} products (${kbPolishes.filter(p => p.images?.length).length} with images)`)
    allPolishes.push(...kbPolishes)
  } catch (e) {
    console.error('  Error:', e.message)
  }

  // ── ILNP (WooCommerce Store API — public, no auth) ──────────────────────────
  console.log('Fetching ILNP products via WooCommerce API...')
  try {
    const ilnpPolishes = await fetchILNPProducts(
      brandId['ilnp'],
      ['boutique-effect-nail-polish', 'studio-color-nail-polish'],
      15
    )
    console.log(`  ${ilnpPolishes.length} products (${ilnpPolishes.filter(p => p.images?.length).length} with images)`)
    allPolishes.push(...ilnpPolishes)
  } catch (e) {
    console.error('  Error:', e.message)
  }

  // ── Glisten & Glow (BigCartel — live fetch from homepage product links) ──────
  // Site redirects glistenandglow.com → www.glistenandglow.com.
  // All products appear on the homepage; og:image is in raw HTML per product page.
  console.log('Fetching Glisten & Glow catalog...')
  try {
    const gngPolishes = await fetchGlistenAndGlow(brandId['glisten-and-glow'], 20)
    console.log(`  ${gngPolishes.length} products (${gngPolishes.filter(p => p.images?.length).length} with images)`)
    allPolishes.push(...gngPolishes)
  } catch (e) {
    console.error('  Error:', e.message)
  }

  // ── OPI (manual) ────────────────────────────────────────────────────────────
  console.log('Adding OPI...')
  allPolishes.push(...manual(brandId['opi'], [
    { name: "I'm Not Really a Waitress",    slug: 'im-not-really-a-waitress',    hex_color: '#9B1B2C', finish_category: 'shimmer', color_family: 'red',     msrp_usd: 11 },
    { name: 'Lincoln Park After Dark',      slug: 'lincoln-park-after-dark',     hex_color: '#2D1A3A', finish_category: 'cream',   color_family: 'purple',  msrp_usd: 11 },
    { name: 'Bubble Bath',                  slug: 'bubble-bath',                  hex_color: '#F0E0E4', finish_category: 'shimmer', color_family: 'pink',    msrp_usd: 11 },
    { name: 'Malaga Wine',                  slug: 'malaga-wine',                  hex_color: '#6B1A2A', finish_category: 'cream',   color_family: 'red',     msrp_usd: 11 },
    { name: 'OPI Red',                      slug: 'opi-red',                      hex_color: '#C01828', finish_category: 'cream',   color_family: 'red',     msrp_usd: 11 },
    { name: "Don't Bossa Nova Me Around",   slug: 'dont-bossa-nova-me-around',   hex_color: '#C82030', finish_category: 'cream',   color_family: 'red',     msrp_usd: 11 },
    { name: 'Icelanded a Bottle of OPI',    slug: 'icelanded-a-bottle-of-opi',   hex_color: '#A8C8D0', finish_category: 'cream',   color_family: 'blue',    msrp_usd: 11 },
    { name: 'Funny Bunny',                  slug: 'funny-bunny',                  hex_color: '#F5F0F0', finish_category: 'cream',   color_family: 'neutral', msrp_usd: 11 },
    { name: 'Alpine Snow',                  slug: 'alpine-snow',                  hex_color: '#F5F5F5', finish_category: 'cream',   color_family: 'neutral', msrp_usd: 11 },
  ]))

  // ── Essie (manual) ──────────────────────────────────────────────────────────
  console.log('Adding Essie...')
  allPolishes.push(...manual(brandId['essie'], [
    { name: 'Bordeaux',       slug: 'bordeaux',       hex_color: '#5A1528', finish_category: 'cream',   color_family: 'red',     msrp_usd: 10 },
    { name: 'Ballet Slippers',slug: 'ballet-slippers',hex_color: '#F2E0E4', finish_category: 'cream',   color_family: 'pink',    msrp_usd: 10 },
    { name: 'Wicked',         slug: 'wicked',         hex_color: '#3D1040', finish_category: 'cream',   color_family: 'purple',  msrp_usd: 10 },
    { name: 'Marshmallow',    slug: 'marshmallow',    hex_color: '#F5F2EE', finish_category: 'cream',   color_family: 'neutral', msrp_usd: 10 },
    { name: 'Fiji',           slug: 'fiji',           hex_color: '#E87060', finish_category: 'cream',   color_family: 'pink',    msrp_usd: 10 },
    { name: 'Geranium',       slug: 'geranium',       hex_color: '#E85040', finish_category: 'cream',   color_family: 'red',     msrp_usd: 10 },
    { name: 'Midnight Cami',  slug: 'midnight-cami',  hex_color: '#1A1830', finish_category: 'shimmer', color_family: 'blue',    msrp_usd: 10 },
    { name: 'Good to Go',     slug: 'good-to-go',     hex_color: '#F0EEE8', finish_category: 'topper',  color_family: 'neutral', msrp_usd: 10 },
  ]))

  // ── Zoya (manual) ───────────────────────────────────────────────────────────
  console.log('Adding Zoya...')
  allPolishes.push(...manual(brandId['zoya'], [
    { name: 'Posh',      slug: 'posh',      hex_color: '#D4A8B8', finish_category: 'shimmer', color_family: 'pink',    msrp_usd: 10 },
    { name: 'Raven',     slug: 'raven',     hex_color: '#0A0A0A', finish_category: 'cream',   color_family: 'black',   msrp_usd: 10 },
    { name: 'Seraphina', slug: 'seraphina', hex_color: '#8B4570', finish_category: 'shimmer', color_family: 'purple',  msrp_usd: 10 },
    { name: 'Pippa',     slug: 'pippa',     hex_color: '#D83020', finish_category: 'cream',   color_family: 'red',     msrp_usd: 10 },
    { name: 'Sooki',     slug: 'sooki',     hex_color: '#E89070', finish_category: 'cream',   color_family: 'pink',    msrp_usd: 10 },
    { name: 'Frida',     slug: 'frida',     hex_color: '#C82060', finish_category: 'cream',   color_family: 'pink',    msrp_usd: 10 },
    { name: 'Storm',     slug: 'storm',     hex_color: '#6080A0', finish_category: 'cream',   color_family: 'blue',    msrp_usd: 10 },
  ]))

  // ─── Upsert ────────────────────────────────────────────────────────────────

  console.log(`\nTotal polishes to upsert: ${allPolishes.length}`)

  if (DRY_RUN) {
    allPolishes.forEach(p => {
      const img = p.images?.[0] ? '✓ image' : '○ no image'
      console.log(`  [${p.finish_category.padEnd(12)}] ${p.name} (${img})`)
    })
    console.log('\nRun without --dry-run to write.')
    return
  }

  const { data, error } = await supabase
    .from('polishes')
    .upsert(allPolishes, { onConflict: 'brand_id,slug', ignoreDuplicates: false })
    .select('id, name')

  if (error) {
    console.error('Upsert error:', error)
    process.exit(1)
  }

  console.log(`✓ Upserted ${data.length} polishes`)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
