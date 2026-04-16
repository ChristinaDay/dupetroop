#!/usr/bin/env node
/**
 * DupeTroop — Image backfill script
 *
 * Strategy (in order of reliability):
 *
 *   1. shopify-bulk  — Fetch /collections/all/products.json (all pages), build a
 *                      name→image map, match DB polishes by normalized name.
 *                      Best for Shopify brands: sidesteps slug-guessing entirely.
 *
 *   2. shopify-json  — /products/{handle}.json per polish. Faster when the API is
 *                      open but the catalog is large.
 *
 *   3. html          — Fetch product page HTML, extract og:image meta tag.
 *                      Works on any site with decent SEO (WooCommerce, custom, etc.).
 *                      Tries productPaths[] in order; falls back to alt slug variants.
 *
 *   4. product_url   — If the polish has a product_url stored in the DB, that URL
 *                      is always tried first regardless of brand strategy.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-images.js
 *   node --env-file=.env.local scripts/backfill-images.js --dry-run
 *   node --env-file=.env.local scripts/backfill-images.js --brand kbshimmer
 *   node --env-file=.env.local scripts/backfill-images.js --brand kbshimmer --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Run with: node --env-file=.env.local scripts/backfill-images.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')
const BRAND_FILTER = process.argv.includes('--brand')
  ? process.argv[process.argv.indexOf('--brand') + 1]
  : null

// Polite delay between requests (ms)
const REQUEST_DELAY = 600

// ─── Per-polish slug overrides ────────────────────────────────────────────────
//
// When a polish's slug in our DB doesn't match the store's product handle,
// add an override here: { 'our-db-slug': 'actual-store-handle' }
//
const HANDLE_OVERRIDES = {
  'supernova': 'im-a-mf-supernova',
}

// ─── Brand config ──────────────────────────────────────────────────────────────
//
// strategy:
//   'shopify-bulk'  — fetch full catalog via /collections/{collection}/products.json
//   'shopify-json'  — per-product /products/{handle}.json
//   'html'          — og:image scraping from product page HTML
//
// collection: (shopify-bulk only) collection handle, default 'all'
//
// productPath:  single path template, e.g. '/product/{slug}'
// productPaths: array of path templates to try in order (html strategy)
//               Default for html: ['/products/{slug}', '/product/{slug}']
//
const BRAND_CONFIG = {
  // ── Shopify brands with open collection APIs ────────────────────────────────
  // Bulk-fetch the entire catalog, match by normalized name → no slug-guessing.
  'holo-taco':    { domain: 'holotaco.com',     strategy: 'shopify-bulk', collection: 'all' },
  'mooncat':      { domain: 'mooncat.com',       strategy: 'shopify-bulk', collection: 'all' },
  'cirque-colors':{ domain: 'cirquecolors.com',  strategy: 'shopify-bulk', collection: 'all' },
  'rogue-lacquer':{ domain: 'roguelacquer.com',  strategy: 'shopify-bulk', collection: 'all' },
  // Zoya is on Magento (artofbeauty.com). Sitemap at zoya.com indexes product
  // pages on zoya.artofbeauty.com which return og:image in raw HTML.
  'zoya': {
    domain: 'www.zoya.com',
    strategy: 'zoya',
    sitemapUrl: 'https://www.zoya.com/sitemap_zoya.xml',
  },

  // ── WooCommerce Store API (public, no auth) ────────────────────────────────
  // Fetches /wp-json/wc/store/v1/products with browser UA — no browser needed.
  // categories: array of category slugs to fetch from (in order).
  'ilnp': {
    domain: 'www.ilnp.com',
    strategy: 'woocommerce-api',
    categories: ['boutique-effect-nail-polish', 'studio-color-nail-polish'],
  },

  // ── Custom PHP storefront behind Cloudflare JS challenge — real browser ──────
  // Not WooCommerce. Catalog at /nail-polish/, product cards use custom classes.
  'kbshimmer': {
    domain: 'www.kbshimmer.com',
    strategy: 'browser',
    catalogPath: '/nail-polish/',
    selectors: {
      productContainer: '.catalog-product',
      productName: '.catalog-product-title a',
      productImage: 'a[href*="kbshimmer.com"] img',
    },
  },

  // ── Site down — holding page only, no product catalog accessible ─────────────
  // differentdimension.com redirects to /lander. Manual image URLs required.
  'different-dimension': {
    domain: 'differentdimension.com',
    strategy: 'html',
    productPaths: ['/products/{slug}'],
  },
  // BigCartel store. Site redirects bare domain → www; og:image in raw HTML.
  // Old polishes are discontinued — seed script now fetches current catalog.
  // Backfill matches by normalized name after re-seeding.
  'glisten-and-glow': {
    domain: 'www.glistenandglow.com',
    strategy: 'html',
    productPaths: ['/product/{slug}'],
  },

  // ── OPI — Shopify store, products at /products/nail-lacquer-{slug} ────────────
  // Their collections API is locked, but individual product HTML returns og:image.
  // The slug in our DB is just the name (e.g. "bubble-bath"); OPI's handle is
  // "nail-lacquer-bubble-bath", so we use a handlePrefix to prepend it.
  'opi': {
    domain: 'www.opi.com',
    strategy: 'html',
    handlePrefix: 'nail-lacquer-',
    productPaths: [
      '/products/nail-lacquer-{slug}',
    ],
  },
  // ── Essie — Sitecore CMS, no og:image in raw HTML, JS-rendered product images ─
  // Strategy: parse their public sitemap to resolve slug → full URL (which includes
  // the color-category segment we can't guess), then load each page with a real
  // browser and grab the product img by alt-text match.
  'essie': {
    domain: 'www.essie.com',
    strategy: 'essie',
    sitemapUrl: 'https://a82962.sitemaphosting.com/3956201/sitemap.xml',
  },
}

// ─── Shared fetch headers ─────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Normalize a product name for fuzzy matching: lowercase, strip punctuation, collapse spaces. */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[''`]/g, '')        // apostrophes
    .replace(/[^a-z0-9\s]/g, ' ') // everything else non-alphanumeric → space
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extract og:image from HTML. Handles both attribute orderings. */
function extractOgImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    // Also try twitter:image as a fallback
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) {
      const url = m[1].trim()
      return url.startsWith('//') ? `https:${url}` : url
    }
  }
  return null
}

// ─── Strategy: Shopify bulk collection fetch ──────────────────────────────────

/**
 * Fetch all products from a Shopify collection (handles pagination).
 * Returns a Map of normalizedName → imageUrl.
 */
async function fetchShopifyBulk(domain, collection = 'all') {
  const nameToImage = new Map()
  let page = 1
  const limit = 250

  while (true) {
    const url = `https://${domain}/collections/${collection}/products.json?limit=${limit}&page=${page}`
    console.log(`    Fetching page ${page}: ${url}`)

    const res = await fetch(url, { headers: BROWSER_HEADERS })
    if (!res.ok) {
      console.log(`    HTTP ${res.status} — ${page === 1 ? 'collection unavailable' : 'no more pages'}`)
      break
    }

    let data
    try {
      data = await res.json()
    } catch {
      console.log(`    Could not parse JSON on page ${page}`)
      break
    }

    const products = data?.products ?? []
    if (products.length === 0) break

    for (const product of products) {
      const image = product.images?.[0]?.src ?? null
      if (image) {
        nameToImage.set(normalizeName(product.title), image)
        // Also index by handle in case name matching fails
        nameToImage.set(`__handle__${product.handle}`, image)
      }
    }

    console.log(`    Page ${page}: ${products.length} products (${nameToImage.size} with images so far)`)

    if (products.length < limit) break // last page
    page++
    await sleep(REQUEST_DELAY)
  }

  return nameToImage
}

// ─── Strategy: WooCommerce Store API ─────────────────────────────────────────
//
// Fetches /wp-json/wc/store/v1/products — public endpoint, no auth needed,
// but requires browser-like User-Agent. Handles pagination via Link header.
// Returns a Map of normalizedName → imageUrl across all specified categories.
//

async function fetchWooCommerceApi(domain, categories = []) {
  const nameToImage = new Map()
  const perPage = 100

  const categoriesToFetch = categories.length > 0 ? categories : ['']

  for (const category of categoriesToFetch) {
    let pageNum = 1

    while (true) {
      const params = new URLSearchParams({ per_page: perPage, page: pageNum })
      if (category) params.set('category', category)
      const url = `https://${domain}/wp-json/wc/store/v1/products?${params}`
      console.log(`    Fetching ${url}`)

      const res = await fetch(url, { headers: BROWSER_HEADERS })
      if (!res.ok) {
        console.log(`    HTTP ${res.status} — stopping`)
        break
      }

      let products
      try { products = await res.json() } catch {
        console.log(`    JSON parse error`)
        break
      }

      if (!products.length) break

      for (const p of products) {
        const image = p.images?.[0]?.src ?? null
        if (image) nameToImage.set(normalizeName(p.name), image)
      }

      console.log(`    Page ${pageNum}: ${products.length} products (${nameToImage.size} total with images)`)

      if (products.length < perPage) break
      pageNum++
      await sleep(REQUEST_DELAY)
    }
  }

  return nameToImage
}

// ─── Strategy: Essie (Sitecore CMS) ──────────────────────────────────────────
//
// 1. Fetch Essie's public sitemap to build slug → full product URL map.
//    (Full URL includes the color-category segment we can't guess otherwise.)
// 2. For each polish, load the product page in a real browser and extract the
//    product image by matching alt text to the polish name.
//

// ─── Strategy: Zoya (Magento / artofbeauty.com) ──────────────────────────────
//
// Zoya's sitemap (zoya.com/sitemap_zoya.xml) indexes product pages on
// zoya.artofbeauty.com. Those pages return og:image in plain HTML — no browser
// needed. Build a name→URL map from the sitemap, then fetch og:image per polish.
//

async function fetchZoyaSitemapMap(sitemapUrl) {
  const res = await fetch(sitemapUrl, { headers: BROWSER_HEADERS })
  if (!res.ok) throw new Error(`Sitemap fetch failed: HTTP ${res.status}`)
  const text = await res.text()
  // URLs are percent-encoded in the sitemap; decode them first
  const nameToUrl = new Map()
  for (const [, raw] of text.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = decodeURIComponent(raw)
    if (!url.includes('artofbeauty.com/content/item/')) continue
    // Extract the name segment from the URL slug, e.g. "Zoya-Nail-Polish-Raven" → "raven"
    const slug = url.split('/').pop().replace(/\.html$/, '').toLowerCase()
    // Try to isolate the polish name: strip common prefixes
    const name = slug
      .replace(/^zoya-nail-polish-in-/, '')
      .replace(/^zoya-nail-polish-/, '')
      .replace(/^nail-polish-zoya-nail-polish-/, '')
      .replace(/-zp\d+$/, '')  // strip ZP code suffix
    nameToUrl.set(normalizeName(name), url)
  }
  return nameToUrl
}

async function fetchEssieSitemapMap(sitemapUrl) {
  const res = await fetch(sitemapUrl, { headers: BROWSER_HEADERS })
  if (!res.ok) throw new Error(`Sitemap fetch failed: HTTP ${res.status}`)
  const text = await res.text()
  const slugToUrl = {}
  // Include both nail-polish and nail-care pages (top coats, treatments live there)
  for (const [, url] of text.matchAll(/<loc>(https:\/\/www\.essie\.com\/(?:nail-polish|nail-care)\/[^<]+)<\/loc>/g)) {
    const slug = url.split('/').filter(Boolean).pop()
    // Don't overwrite nail-polish entries with nail-care ones if both exist
    if (!slugToUrl[slug]) slugToUrl[slug] = url
  }
  return slugToUrl
}

async function fetchEssieProductImage(page, url, polishName) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
  if (!response?.ok()) return null
  const nameLower = polishName.toLowerCase()
  return page.evaluate((nameLower) => {
    const imgs = [...document.querySelectorAll('img')]
    const match = imgs.find(i => i.alt?.toLowerCase().includes(nameLower) && i.src.includes('-/media'))
      ?? imgs.find(i => i.src.includes('new-pdp-image') || i.src.includes('products_nailpolish'))
    return match?.src ?? null
  }, nameLower)
}

// ─── Strategy: Shopify per-product JSON ───────────────────────────────────────

async function fetchShopifyJson(domain, handle) {
  const url = `https://${domain}/products/${handle}.json`
  const res = await fetch(url, { headers: BROWSER_HEADERS })
  if (!res.ok) return { url, image: null, error: `HTTP ${res.status}` }
  let data
  try { data = await res.json() } catch { return { url, image: null, error: 'JSON parse error' } }
  const image = data?.product?.images?.[0]?.src ?? null
  return { url, image, error: image ? null : 'no images in response' }
}

// ─── Strategy: HTML og:image ──────────────────────────────────────────────────

async function fetchOgImageFromPath(domain, path) {
  const url = `https://${domain}${path}`
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' })
  if (!res.ok) return { url, image: null, error: `HTTP ${res.status}` }
  const html = await res.text()
  const image = extractOgImage(html)
  return { url, image, error: image ? null : 'og:image not found in HTML' }
}

/**
 * Try each productPath template for a given slug.
 * Returns { url, image } for the first hit, or { image: null } if all fail.
 */
async function fetchOgImageWithFallbacks(domain, slug, productPaths) {
  // Default paths to try if none specified
  const paths = productPaths ?? ['/products/{slug}', '/product/{slug}']

  for (const template of paths) {
    const path = template.replace('{slug}', slug)
    await sleep(REQUEST_DELAY)
    const result = await fetchOgImageFromPath(domain, path)
    if (result.image) return result
    console.log(`      ✗ ${result.url} — ${result.error}`)
  }
  return { image: null, error: `all ${paths.length} path(s) failed` }
}

// ─── Strategy: Headless browser (Playwright) ─────────────────────────────────
//
// For sites behind Cloudflare JS challenges. Launches a real Chromium browser,
// navigates to the product page, and extracts og:image from the rendered DOM.
//

let _browser = null

async function getBrowser() {
  if (!_browser) {
    _browser = await chromium.launch({ headless: true })
  }
  return _browser
}

async function closeBrowser() {
  if (_browser) {
    await _browser.close()
    _browser = null
  }
}

// Default selectors for WooCommerce product listing pages.
const WOO_SELECTORS = {
  productContainer: 'li.product, ul.products li',
  productName: '.woocommerce-loop-product__title, h2, .product-title',
  productImage: 'img',
  nextPage: 'a.next, .woocommerce-pagination a.next, nav.woocommerce-pagination a[aria-label="Next"]',
}

/**
 * Fetch a store catalog page with a real browser and return a
 * Map of normalizedName → imageUrl built from product listing cards.
 *
 * Accepts configurable selectors so it works with non-WooCommerce stores.
 * Handles pagination by following a "next page" link.
 */
async function fetchWooBulk(domain, catalogPath = '/shop/', selectors = {}) {
  const sel = { ...WOO_SELECTORS, ...selectors }
  const nameToImage = new Map()
  const browser = await getBrowser()
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
  })
  const page = await context.newPage()

  let url = `https://${domain}${catalogPath}`

  try {
    while (url) {
      console.log(`    Browser catalog → ${url}`)
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      if (!response?.ok()) {
        console.log(`    ✗ HTTP ${response?.status()}`)
        break
      }

      // Playwright $$eval only allows one extra argument — wrap selectors in an object
      const products = await page.$$eval(
        sel.productContainer,
        (items, sel) =>
          items.map(el => {
            const title = el.querySelector(sel.productName)?.textContent?.trim() ?? null
            const img = el.querySelector(sel.productImage)
            const src = img?.getAttribute('src') || img?.getAttribute('data-src') || null
            return { title, src }
          }).filter(p => p.title && p.src),
        { productName: sel.productName, productImage: sel.productImage },
      )

      for (const { title, src } of products) {
        const image = src.startsWith('//') ? `https:${src}` : src
        nameToImage.set(normalizeName(title), image)
      }

      console.log(`    ${products.length} products on this page (${nameToImage.size} total)`)

      // Follow pagination — try the configured selector, fall back to generic patterns
      const nextHref = await page.$eval(
        sel.nextPage ?? 'a.next',
        el => el.href
      ).catch(() => null)

      url = nextHref ?? null
      if (url) await sleep(REQUEST_DELAY)
    }
  } finally {
    await context.close()
  }

  return nameToImage
}

/**
 * Fetch og:image from a single product page using a real headless browser.
 * Used as fallback when catalog-based matching fails.
 */
async function fetchOgImageWithBrowser(domain, slug, productPaths) {
  const paths = productPaths ?? ['/product/{slug}/', '/products/{slug}']
  const browser = await getBrowser()
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
  })
  const page = await context.newPage()

  try {
    for (const template of paths) {
      const url = `https://${domain}${template.replace('{slug}', slug)}`
      console.log(`      Browser → ${url}`)
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        if (!response?.ok()) {
          console.log(`      ✗ HTTP ${response?.status()}`)
          continue
        }
        const image = await page.$eval(
          'meta[property="og:image"], meta[name="twitter:image"]',
          el => el.getAttribute('content')
        ).catch(() => null)

        if (image) {
          const resolved = image.startsWith('//') ? `https:${image}` : image
          return { url, image: resolved }
        }
        console.log(`      ✗ og:image not found in rendered page`)
      } catch (err) {
        console.log(`      ✗ ${err.message}`)
      }
      await sleep(REQUEST_DELAY)
    }
    return { image: null }
  } finally {
    await context.close()
  }
}

// ─── Per-polish lookup (used for html strategy) ───────────────────────────────

/**
 * Try to find an image for one polish using HTML og:image scraping.
 * Tries the DB product_url first, then constructed paths, then alt slug variants.
 */
async function fetchImageForPolish(polish, config) {
  const { domain, productPaths } = config

  // 1. If the polish has a stored product_url, try it directly first
  if (polish.product_url) {
    console.log(`      Using stored product_url: ${polish.product_url}`)
    const res = await fetch(polish.product_url, { headers: BROWSER_HEADERS, redirect: 'follow' })
    if (res.ok) {
      const html = await res.text()
      const image = extractOgImage(html)
      if (image) return { image, url: polish.product_url }
    }
    console.log(`      product_url fetch failed — trying constructed paths`)
    await sleep(REQUEST_DELAY)
  }

  // 2. Try the DB slug (with handle override if applicable)
  const handle = HANDLE_OVERRIDES[polish.slug] ?? polish.slug
  if (handle !== polish.slug) {
    console.log(`      Using handle override: "${polish.slug}" → "${handle}"`)
  }

  const result = await fetchOgImageWithFallbacks(domain, handle, productPaths)
  if (result.image) return result

  // 3. Try a re-slugified version of the name (catches encoding differences)
  const altSlug = polish.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (altSlug !== handle) {
    await sleep(REQUEST_DELAY)
    const altResult = await fetchOgImageWithFallbacks(domain, altSlug, productPaths)
    if (altResult.image) {
      console.log(`      Found with alt slug "${altSlug}"`)
      return altResult
    }
  }

  return { image: null }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '🔍  Dry run — no writes\n' : '✏️   Writing to Supabase\n')

  const stats = { matched: 0, skipped: 0, alreadyHasImage: 0, errors: 0, offline: 0 }

  const brandsToProcess = BRAND_FILTER
    ? Object.entries(BRAND_CONFIG).filter(([slug]) => slug === BRAND_FILTER)
    : Object.entries(BRAND_CONFIG)

  for (const [brandSlug, config] of brandsToProcess) {
    console.log(`\n── ${brandSlug} (${config.domain}) [${config.strategy}] ──`)

    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', brandSlug)
      .single()

    if (!brand) {
      console.log('  ⚠  Brand not found in DB — skipping')
      continue
    }

    const { data: polishes, error: polishError } = await supabase
      .from('polishes')
      .select('id, name, slug, images, product_url')
      .eq('brand_id', brand.id)

    if (polishError || !polishes?.length) {
      console.log('  ⚠  No polishes found — skipping')
      continue
    }

    const needsImage = polishes.filter(p => !p.images?.length)
    console.log(`  ${polishes.length} polishes in DB, ${needsImage.length} need images`)
    stats.alreadyHasImage += polishes.length - needsImage.length

    if (needsImage.length === 0) continue

    // ── shopify-bulk: fetch entire catalog once, then match all polishes ───────
    if (config.strategy === 'shopify-bulk') {
      console.log(`  Fetching full catalog from ${config.domain}...`)
      const collection = config.collection ?? 'all'
      let nameToImage
      try {
        nameToImage = await fetchShopifyBulk(config.domain, collection)
      } catch (e) {
        console.log(`  ✗ Bulk fetch failed: ${e.message}`)
        stats.offline += needsImage.length
        continue
      }

      if (nameToImage.size === 0) {
        console.log(`  ✗ No products returned — API may be blocked`)
        stats.offline += needsImage.length
        continue
      }

      console.log(`  Catalog loaded: ${nameToImage.size} entries. Matching polishes...`)

      for (const polish of needsImage) {
        const normalizedName = normalizeName(polish.name)
        const handle = HANDLE_OVERRIDES[polish.slug] ?? polish.slug

        // Try name match first, then handle match
        const image = nameToImage.get(normalizedName) ?? nameToImage.get(`__handle__${handle}`) ?? null

        if (image) {
          console.log(`  ✓  ${polish.name}`)
          console.log(`       ${image}`)
          stats.matched++
          if (!DRY_RUN) {
            const { error: updateError } = await supabase
              .from('polishes')
              .update({ images: [image] })
              .eq('id', polish.id)
            if (updateError) {
              console.error(`       ⚠  Write failed: ${updateError.message}`)
              stats.errors++
            }
          }
        } else {
          console.log(`  ✗  ${polish.name} — no catalog match (normalized: "${normalizedName}")`)
          stats.skipped++
        }
      }
    }

    // ── woocommerce-api: WooCommerce Store API (public, browser UA only) ─────────
    else if (config.strategy === 'woocommerce-api') {
      console.log(`  Fetching WooCommerce catalog from ${config.domain}...`)
      let nameToImage
      try {
        nameToImage = await fetchWooCommerceApi(config.domain, config.categories ?? [])
      } catch (e) {
        console.log(`  ✗ API fetch failed: ${e.message}`)
        stats.offline += needsImage.length
        continue
      }

      if (nameToImage.size === 0) {
        console.log(`  ✗ No products returned`)
        stats.offline += needsImage.length
        continue
      }

      console.log(`  Catalog loaded: ${nameToImage.size} entries. Matching polishes...`)

      for (const polish of needsImage) {
        const normalizedName = normalizeName(polish.name)
        const image = nameToImage.get(normalizedName) ?? null

        if (image) {
          console.log(`  ✓  ${polish.name}`)
          console.log(`       ${image}`)
          stats.matched++
          if (!DRY_RUN) {
            const { error: updateError } = await supabase
              .from('polishes')
              .update({ images: [image] })
              .eq('id', polish.id)
            if (updateError) {
              console.error(`       ⚠  Write failed: ${updateError.message}`)
              stats.errors++
            }
          }
        } else {
          console.log(`  ✗  ${polish.name} — no catalog match (normalized: "${normalizedName}")`)
          stats.skipped++
        }
      }
    }

    // ── browser: Playwright headless Chromium (bypasses Cloudflare JS challenge)
    // Fetches the full WooCommerce catalog, builds a name→image map, then matches
    // polishes by name. Falls back to per-product og:image scraping on misses.
    else if (config.strategy === 'browser') {
      const catalogPath = config.catalogPath ?? '/shop/'
      console.log(`  Fetching catalog via browser (${config.domain}${catalogPath})...`)

      let nameToImage = new Map()
      try {
        nameToImage = await fetchWooBulk(config.domain, catalogPath, config.selectors ?? {})
      } catch (e) {
        console.log(`  ✗ Catalog fetch failed: ${e.message}`)
      }

      console.log(`  Catalog loaded: ${nameToImage.size} products. Matching polishes...`)

      for (const polish of needsImage) {
        const normalizedName = normalizeName(polish.name)
        let image = nameToImage.get(normalizedName) ?? null

        if (!image) {
          // Fallback: try fetching the individual product page
          console.log(`\n  • ${polish.name} — not in catalog, trying direct URL`)
          const handle = HANDLE_OVERRIDES[polish.slug] ?? polish.slug
          const result = await fetchOgImageWithBrowser(config.domain, handle, config.productPaths)
          image = result.image ?? null
        } else {
          console.log(`  ✓  ${polish.name}`)
          console.log(`       ${image}`)
        }

        if (image) {
          stats.matched++
          if (!DRY_RUN) {
            const { error: updateError } = await supabase
              .from('polishes')
              .update({ images: [image] })
              .eq('id', polish.id)
            if (updateError) {
              console.error(`    ⚠  Write failed: ${updateError.message}`)
              stats.errors++
            }
          }
        } else {
          console.log(`  ✗  ${polish.name} — no image found`)
          stats.skipped++
        }
      }
    }

    // ── zoya: sitemap name→URL lookup + plain og:image fetch ─────────────────────
    else if (config.strategy === 'zoya') {
      console.log(`  Building URL map from Zoya sitemap...`)
      let nameToUrl
      try {
        nameToUrl = await fetchZoyaSitemapMap(config.sitemapUrl)
      } catch (e) {
        console.log(`  ✗ Sitemap fetch failed: ${e.message}`)
        stats.offline += needsImage.length
        continue
      }
      console.log(`  Sitemap loaded: ${nameToUrl.size} product URLs`)

      for (const polish of needsImage) {
        const key = normalizeName(polish.name)
        const url = nameToUrl.get(key) ?? null

        if (!url) {
          console.log(`  ✗  ${polish.name} — not in sitemap (key: "${key}")`)
          stats.skipped++
          continue
        }

        await sleep(REQUEST_DELAY)
        const res = await fetch(url, { headers: BROWSER_HEADERS })
        if (!res.ok) {
          console.log(`  ✗  ${polish.name} — HTTP ${res.status}`)
          stats.skipped++
          continue
        }
        const html = await res.text()
        const image = extractOgImage(html)

        if (image) {
          console.log(`  ✓  ${polish.name}`)
          console.log(`       ${image}`)
          stats.matched++
          if (!DRY_RUN) {
            const { error: updateError } = await supabase
              .from('polishes')
              .update({ images: [image] })
              .eq('id', polish.id)
            if (updateError) {
              console.error(`       ⚠  Write failed: ${updateError.message}`)
              stats.errors++
            }
          }
        } else {
          console.log(`  ✗  ${polish.name} — og:image not found`)
          stats.skipped++
        }
      }
    }

    // ── essie: sitemap slug→URL lookup + browser product image extraction ────────
    else if (config.strategy === 'essie') {
      console.log(`  Building URL map from sitemap...`)
      let slugToUrl
      try {
        slugToUrl = await fetchEssieSitemapMap(config.sitemapUrl)
      } catch (e) {
        console.log(`  ✗ Sitemap fetch failed: ${e.message}`)
        stats.offline += needsImage.length
        continue
      }
      console.log(`  Sitemap loaded: ${Object.keys(slugToUrl).length} product URLs`)

      const browser = await getBrowser()
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        locale: 'en-US',
      })
      const page = await context.newPage()

      try {
        for (const polish of needsImage) {
          console.log(`\n  • ${polish.name}`)
          const url = slugToUrl[polish.slug] ?? null
          if (!url) {
            console.log(`    ✗ slug "${polish.slug}" not in sitemap`)
            stats.skipped++
            continue
          }

          console.log(`    → ${url}`)
          await sleep(REQUEST_DELAY)
          let image = null
          try {
            image = await fetchEssieProductImage(page, url, polish.name)
          } catch (e) {
            console.log(`    ✗ ${e.message}`)
          }

          if (image) {
            console.log(`    ✓ ${image}`)
            stats.matched++
            if (!DRY_RUN) {
              const { error: updateError } = await supabase
                .from('polishes')
                .update({ images: [image] })
                .eq('id', polish.id)
              if (updateError) {
                console.error(`    ⚠  Write failed: ${updateError.message}`)
                stats.errors++
              }
            }
          } else {
            console.log(`    ✗ No product image found on page`)
            stats.skipped++
          }
        }
      } finally {
        await context.close()
      }
    }

    // ── html: og:image scraping per polish ────────────────────────────────────
    else if (config.strategy === 'html' || config.strategy === 'shopify-json') {
      for (const polish of needsImage) {
        console.log(`\n  • ${polish.name}`)

        let result

        if (config.strategy === 'shopify-json') {
          const handle = HANDLE_OVERRIDES[polish.slug] ?? polish.slug
          await sleep(REQUEST_DELAY)
          result = await fetchShopifyJson(config.domain, handle)
          if (!result.image) {
            console.log(`    JSON failed (${result.error}), trying HTML og:image...`)
            result = await fetchImageForPolish(polish, config)
          }
        } else {
          result = await fetchImageForPolish(polish, config)
        }

        if (result.image) {
          console.log(`    ✓ ${result.image}`)
          stats.matched++
          if (!DRY_RUN) {
            const { error: updateError } = await supabase
              .from('polishes')
              .update({ images: [result.image] })
              .eq('id', polish.id)
            if (updateError) {
              console.error(`    ⚠  Write failed: ${updateError.message}`)
              stats.errors++
            }
          }
        } else {
          console.log(`    ✗ No image found`)
          stats.skipped++
        }
      }
    }
  }

  console.log('\n── Summary ──')
  console.log(`  ✓  Matched:           ${stats.matched}`)
  console.log(`  ⏭  Already had image: ${stats.alreadyHasImage}`)
  console.log(`  ✗  No match found:    ${stats.skipped}`)
  if (stats.offline) console.log(`  ⛔  Brand offline:     ${stats.offline}`)
  if (stats.errors)  console.log(`  ⚠  Write errors:      ${stats.errors}`)
  if (DRY_RUN) console.log('\n  Run without --dry-run to write changes.')

  await closeBrowser()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
