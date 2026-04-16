#!/usr/bin/env node
/**
 * DupeTroop — Image backfill script
 *
 * Strategy:
 *   1. Shopify brands with a working JSON API → /products/{slug}.json
 *   2. Everything else → fetch the product page HTML, extract og:image
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-images.js
 *   node --env-file=.env.local scripts/backfill-images.js --dry-run
 *   node --env-file=.env.local scripts/backfill-images.js --brand mooncat
 */

import { createClient } from '@supabase/supabase-js'

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
const REQUEST_DELAY = 800

// ─── Handle overrides ─────────────────────────────────────────────────────────
//
// When a polish's slug in our DB doesn't match the store's product handle,
// add an override here: { 'our-slug': 'store-handle' }
//
const HANDLE_OVERRIDES = {
  'supernova': 'im-a-mf-supernova',
}

// ─── Brand config ─────────────────────────────────────────────────────────────
//
// shopifyJson: true  → use /products/{handle}.json (fast, clean)
// shopifyJson: false → scrape HTML og:image from /products/{handle}
// productPath        → override if not Shopify-style /products/{handle}
//
const BRAND_CONFIG = {
  'holo-taco':          { domain: 'holotaco.com',           shopifyJson: true },
  'mooncat':            { domain: 'mooncat.com',            shopifyJson: true },
  'kbshimmer':          { domain: 'kbshimmer.com',          shopifyJson: false },
  'ilnp':               { domain: 'www.ilnp.com',           shopifyJson: false },
  'different-dimension':{ domain: 'differentdimension.com', shopifyJson: false },
  'cirque-colors':      { domain: 'cirquecolors.com',       shopifyJson: false },
  'glisten-and-glow':   { domain: 'glistenandglow.com',     shopifyJson: false },
  'rogue-lacquer':      { domain: 'roguelacquer.com',       shopifyJson: false },
  // Mainstream brands — HTML scrape using their product search pages
  'opi':   { domain: 'www.opi.com',   shopifyJson: false, productPath: '/en-us/nail-polish/{slug}' },
  'essie': { domain: 'www.essie.com', shopifyJson: false, productPath: '/en-us/nail-polish/{slug}' },
  'zoya':  { domain: 'www.zoya.com',  shopifyJson: false, productPath: '/products/{slug}' },
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Extract og:image from an HTML string. Handles both attribute orderings. */
function extractOgImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return m[1].startsWith('//') ? `https:${m[1]}` : m[1]
  }
  return null
}

/** Fetch via Shopify product JSON API. */
async function fetchShopifyJson(domain, handle) {
  const url = `https://${domain}/products/${handle}.json`
  const res = await fetch(url, { headers: BROWSER_HEADERS })
  if (!res.ok) return { url, image: null, error: `HTTP ${res.status}` }
  const data = await res.json()
  const image = data?.product?.images?.[0]?.src ?? null
  return { url, image, error: image ? null : 'no images in response' }
}

/** Fetch product HTML page and extract og:image. */
async function fetchPageOgImage(domain, handle, productPath) {
  const path = (productPath ?? '/products/{slug}').replace('{slug}', handle)
  const url = `https://${domain}${path}`
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' })
  if (!res.ok) return { url, image: null, error: `HTTP ${res.status}` }
  const html = await res.text()
  const image = extractOgImage(html)
  return { url, image, error: image ? null : 'og:image not found in HTML' }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '🔍  Dry run — no writes\n' : '✏️   Writing to Supabase\n')

  const stats = { matched: 0, skipped: 0, alreadyHasImage: 0, errors: 0 }

  const brandsToProcess = BRAND_FILTER
    ? Object.entries(BRAND_CONFIG).filter(([slug]) => slug === BRAND_FILTER)
    : Object.entries(BRAND_CONFIG)

  for (const [brandSlug, config] of brandsToProcess) {
    console.log(`\n── ${brandSlug} (${config.domain}) ──`)

    // Load this brand's ID
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', brandSlug)
      .single()

    if (!brand) {
      console.log('  ⚠  Brand not found in DB — skipping')
      continue
    }

    // Load polishes for this brand
    const { data: polishes, error } = await supabase
      .from('polishes')
      .select('id, name, slug, images')
      .eq('brand_id', brand.id)

    if (error || !polishes?.length) {
      console.log('  ⚠  No polishes found — skipping')
      continue
    }

    console.log(`  ${polishes.length} polishes in DB`)

    for (const polish of polishes) {
      // Skip if already has image
      if (polish.images?.length) {
        console.log(`  ⏭  ${polish.name} — already has image`)
        stats.alreadyHasImage++
        continue
      }

      await sleep(REQUEST_DELAY)

      // Use handle override if one exists for this slug
      const handle = HANDLE_OVERRIDES[polish.slug] ?? polish.slug
      if (handle !== polish.slug) {
        console.log(`  ↳  Using handle override: "${polish.slug}" → "${handle}"`)
      }

      const result = config.shopifyJson
        ? await fetchShopifyJson(config.domain, handle)
        : await fetchPageOgImage(config.domain, handle, config.productPath)

      if (!result.image) {
        console.log(`  ✗  ${polish.name}`)
        console.log(`       URL: ${result.url}`)
        console.log(`       ${result.error}`)
        stats.skipped++

        // Try with the polish name slugified differently if it differs from our slug
        const altSlug = polish.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        if (altSlug !== handle) {
          await sleep(REQUEST_DELAY)
          const altResult = config.shopifyJson
            ? await fetchShopifyJson(config.domain, altSlug)
            : await fetchPageOgImage(config.domain, altSlug, config.productPath)

          if (altResult.image) {
            console.log(`       ↳ Found with alt slug "${altSlug}": ${altResult.image}`)
            result.image = altResult.image
            stats.skipped--
          }
        }
      }

      if (result.image) {
        console.log(`  ✓  ${polish.name}`)
        console.log(`       ${result.image}`)
        stats.matched++

        if (!DRY_RUN) {
          const { error: updateError } = await supabase
            .from('polishes')
            .update({ images: [result.image] })
            .eq('id', polish.id)
          if (updateError) {
            console.error(`       ⚠  Write failed: ${updateError.message}`)
            stats.errors++
          }
        }
      }
    }
  }

  console.log('\n── Summary ──')
  console.log(`  ✓  Matched:           ${stats.matched}`)
  console.log(`  ⏭  Already had image: ${stats.alreadyHasImage}`)
  console.log(`  ✗  No match found:    ${stats.skipped}`)
  if (stats.errors) console.log(`  ⚠  Write errors:      ${stats.errors}`)
  if (DRY_RUN) console.log('\n  Run without --dry-run to write changes.')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
