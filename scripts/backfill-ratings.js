#!/usr/bin/env node
/**
 * backfill-ratings.js
 *
 * Fetches aggregate ratings from brand product pages using JSON-LD structured
 * data (schema.org/Product → aggregateRating). Writes results to the
 * polish_external_ratings table.
 *
 * Usage:
 *   node scripts/backfill-ratings.js              # all polishes with product_url
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

// Maps brand slug → { sourceKey, sourceLabel } for labeling in the UI
const BRAND_SOURCE_MAP = {
  'holo-taco':       { key: 'holotaco',    label: 'Holo Taco' },
  'mooncat':         { key: 'mooncat',     label: 'Mooncat' },
  'cirque-colors':   { key: 'cirque',      label: 'Cirque Colors' },
  'rogue-lacquer':   { key: 'rogue',       label: 'Rogue Lacquer' },
  'opi':             { key: 'opi',         label: 'OPI' },
  'kbshimmer':       { key: 'kbshimmer',   label: 'KBShimmer' },
  'ilnp':            { key: 'ilnp',        label: 'ILNP' },
  'essie':           { key: 'essie',       label: 'Essie' },
  'zoya':            { key: 'zoya',        label: 'Zoya' },
  'glisten-glow':    { key: 'glistenglow', label: 'Glisten & Glow' },
}

async function fetchJsonLdRating(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DupeTroop/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null

    const html = await res.text()

    // Extract all JSON-LD blocks
    const jsonLdMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1])
        const items = Array.isArray(data) ? data : [data]
        for (const item of items) {
          const rating = item.aggregateRating ?? item['@graph']?.find?.(n => n.aggregateRating)?.aggregateRating
          if (rating?.ratingValue) {
            return {
              rating: parseFloat(rating.ratingValue),
              reviewCount: parseInt(rating.reviewCount ?? rating.ratingCount ?? 0) || null,
            }
          }
        }
      } catch { /* malformed JSON-LD, skip */ }
    }
    return null
  } catch {
    return null
  }
}

async function run() {
  // Fetch all polishes with a product_url
  let query = supabase
    .from('polishes')
    .select('id, name, product_url, brand:brands(slug, name)')
    .not('product_url', 'is', null)

  if (BRAND_FILTER) {
    query = query.eq('brands.slug', BRAND_FILTER)
  }

  const { data: polishes, error } = await query
  if (error) throw error

  const eligible = polishes.filter(p => p.product_url && p.brand)
  console.log(`Found ${eligible.length} polishes with product URLs`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const polish of eligible) {
    const brandSlug = polish.brand.slug
    const source = BRAND_SOURCE_MAP[brandSlug]
    if (!source) {
      skipped++
      continue
    }

    process.stdout.write(`  ${polish.brand.name} — ${polish.name}… `)

    const result = await fetchJsonLdRating(polish.product_url)
    if (!result) {
      console.log('no rating found')
      failed++
      continue
    }

    console.log(`${result.rating}/5 (${result.reviewCount ?? '?'} reviews)`)

    if (!DRY_RUN) {
      const { error: upsertError } = await supabase
        .from('polish_external_ratings')
        .upsert({
          polish_id: polish.id,
          source: source.key,
          source_label: source.label,
          rating: result.rating,
          review_count: result.reviewCount,
          source_url: polish.product_url,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'polish_id,source' })

      if (upsertError) {
        console.error(`    ✗ DB error: ${upsertError.message}`)
        failed++
        continue
      }
    }
    updated++

    // Polite delay between requests
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}${DRY_RUN ? ' (dry run)' : ''}`)
}

run().catch(err => { console.error(err); process.exit(1) })
