#!/usr/bin/env node
/**
 * backfill-ratings.js
 *
 * Fetches aggregate ratings from brand product pages using JSON-LD structured
 * data (schema.org/Product → aggregateRating). Writes results to the
 * polish_external_ratings table.
 *
 * Usage:
 *   node scripts/backfill-ratings.js              # all brands
 *   node scripts/backfill-ratings.js --brand mooncat
 *   node scripts/backfill-ratings.js --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const BRAND_FILTER = args.includes('--brand') ? args[args.indexOf('--brand') + 1] : null

// Brand config: how to build a product URL from a polish slug
const BRAND_CONFIG = {
  'holo-taco': {
    key: 'holotaco',
    label: 'Holo Taco',
    buildUrl: (slug) => `https://holotaco.com/products/${slug}`,
  },
  'mooncat': {
    key: 'mooncat',
    label: 'Mooncat',
    buildUrl: (slug) => `https://mooncat.com/products/${slug}`,
  },
  'cirque-colors': {
    key: 'cirque',
    label: 'Cirque Colors',
    buildUrl: (slug) => `https://cirquecolors.com/products/${slug}`,
  },
  'rogue-lacquer': {
    key: 'rogue',
    label: 'Rogue Lacquer',
    buildUrl: (slug) => `https://roguelacquer.com/products/${slug}`,
  },
  'opi': {
    key: 'opi',
    label: 'OPI',
    buildUrl: (slug) => `https://www.opi.com/products/nail-lacquer-${slug}`,
  },
  'ilnp': {
    key: 'ilnp',
    label: 'ILNP',
    buildUrl: (slug) => `https://ilnp.com/products/${slug}`,
  },
  'glisten-glow': {
    key: 'glistenglow',
    label: 'Glisten & Glow',
    buildUrl: (slug) => `https://www.glistenandglow.com/products/${slug}`,
  },
}

async function fetchJsonLdRating(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null

    const html = await res.text()

    // Try JSON-LD structured data first (most reliable)
    const jsonLdMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1])
        const items = Array.isArray(data) ? data : [data]
        for (const item of items) {
          // Direct aggregateRating
          if (item.aggregateRating?.ratingValue) {
            return {
              rating: parseFloat(item.aggregateRating.ratingValue),
              reviewCount: parseInt(item.aggregateRating.reviewCount ?? item.aggregateRating.ratingCount ?? 0) || null,
            }
          }
          // Nested in @graph
          const graph = item['@graph']
          if (Array.isArray(graph)) {
            const node = graph.find(n => n.aggregateRating?.ratingValue)
            if (node) {
              return {
                rating: parseFloat(node.aggregateRating.ratingValue),
                reviewCount: parseInt(node.aggregateRating.reviewCount ?? 0) || null,
              }
            }
          }
        }
      } catch { /* malformed JSON-LD, skip */ }
    }

    // Fallback: microdata itemprop (Stamped.io, native Shopify reviews, etc.)
    const ratingMeta = html.match(/itemprop=['"]ratingValue['"]\s+content=['"](\d[\d.]*)['"]/i)
      || html.match(/content=['"](\d[\d.]*)['"][^>]*itemprop=['"]ratingValue['"]/i)
    const countMeta = html.match(/itemprop=['"]reviewCount['"]\s+content=['"](\d+)['"]/i)
      || html.match(/content=['"](\d+)['"][^>]*itemprop=['"]reviewCount['"]/i)
    if (ratingMeta) {
      return {
        rating: parseFloat(ratingMeta[1]),
        reviewCount: countMeta ? parseInt(countMeta[1]) : null,
      }
    }

    // Fallback: Stamped badge data attribute
    const stampedMatch = html.match(/data-rating="([\d.]+)"[^>]*data-lang="en"/)
      || html.match(/class="stamped-main-badge"[^>]*data-rating="([\d.]+)"/)
    const stampedCount = html.match(/data-count="(\d+)".*?stamped-badge-caption/)
    if (stampedMatch) {
      return {
        rating: parseFloat(stampedMatch[1]),
        reviewCount: stampedCount ? parseInt(stampedCount[1]) : null,
      }
    }

    return null
  } catch {
    return null
  }
}

async function run() {
  const brandSlugs = BRAND_FILTER ? [BRAND_FILTER] : Object.keys(BRAND_CONFIG)

  // Fetch brands
  const { data: brands } = await supabase
    .from('brands')
    .select('id, slug')
    .in('slug', brandSlugs)

  if (!brands?.length) {
    console.log('No matching brands found.')
    return
  }

  const brandIds = brands.map(b => b.id)
  const brandMap = Object.fromEntries(brands.map(b => [b.id, b.slug]))

  // Fetch polishes for those brands
  const { data: polishes } = await supabase
    .from('polishes')
    .select('id, name, slug, brand_id')
    .in('brand_id', brandIds)
    .eq('is_verified', true)

  console.log(`Found ${polishes?.length ?? 0} polishes across ${brands.length} brands\n`)

  let updated = 0
  let failed = 0

  for (const polish of polishes ?? []) {
    const brandSlug = brandMap[polish.brand_id]
    const config = BRAND_CONFIG[brandSlug]
    if (!config) continue

    const url = config.buildUrl(polish.slug)
    process.stdout.write(`  [${brandSlug}] ${polish.name} (${polish.slug})… `)

    const result = await fetchJsonLdRating(url)
    if (!result) {
      console.log('no rating found')
      failed++
      continue
    }

    console.log(`${result.rating}/5 (${result.reviewCount ?? '?'} reviews)`)

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('polish_external_ratings')
        .upsert({
          polish_id: polish.id,
          source: config.key,
          source_label: config.label,
          rating: result.rating,
          review_count: result.reviewCount,
          source_url: url,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'polish_id,source' })

      if (error) {
        console.error(`    ✗ DB error: ${error.message}`)
        failed++
        continue
      }
    }
    updated++

    // Polite delay between requests
    await new Promise(r => setTimeout(r, 600))
  }

  console.log(`\nDone. Updated: ${updated}, Failed/not found: ${failed}${DRY_RUN ? ' (dry run — nothing written)' : ''}`)
}

run().catch(err => { console.error(err); process.exit(1) })
