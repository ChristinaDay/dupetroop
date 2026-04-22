/**
 * Fetches all Mooncat products from their Shopify API and updates
 * msrp_usd in the DB for any polish whose slug matches.
 *
 * Usage:
 *   node --env-file=.env.local scripts/fix-mooncat-prices.js
 *   node --env-file=.env.local scripts/fix-mooncat-prices.js --dry-run
 */

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; DupeTroop/1.0)' }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fetchAllShopifyProducts(domain, collection = 'everything') {
  const results = []
  let page = 1
  while (true) {
    const url = `https://${domain}/collections/${collection}/products.json?limit=250&page=${page}`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
    const { products } = await res.json()
    if (!products?.length) break
    results.push(...products)
    page++
    await new Promise(r => setTimeout(r, 300))
  }
  return results
}

const { data: brand } = await supabase.from('brands').select('id').eq('slug', 'mooncat').single()
if (!brand) { console.error('Mooncat brand not found'); process.exit(1) }

console.log('Fetching Mooncat catalog from Shopify (everything + all)...')
const [everything, all] = await Promise.all([
  fetchAllShopifyProducts('mooncat.com', 'everything'),
  fetchAllShopifyProducts('mooncat.com', 'all'),
])
const products = [...everything, ...all]

// Build slug → price map (everything takes precedence)
const priceMap = new Map()
for (const p of [...all, ...everything]) {
  const price = parseFloat(p.variants?.[0]?.price)
  if (!isNaN(price) && price > 0) priceMap.set(p.handle, price)
}
console.log(`${priceMap.size} unique products with prices fetched`)

// Fetch all Mooncat polishes from DB
const { data: dbPolishes, error } = await supabase
  .from('polishes')
  .select('id, slug, name, msrp_usd')
  .eq('brand_id', brand.id)

if (error) { console.error('DB error:', error.message); process.exit(1) }
console.log(`${dbPolishes.length} Mooncat polishes in DB`)

let updated = 0, skipped = 0, unmatched = 0

for (const polish of dbPolishes) {
  const newPrice = priceMap.get(polish.slug)
  if (!newPrice) { unmatched++; continue }
  if (newPrice === polish.msrp_usd) { skipped++; continue }

  if (DRY_RUN) {
    console.log(`  ${polish.name}: $${polish.msrp_usd} → $${newPrice}`)
  } else {
    const { error } = await supabase
      .from('polishes')
      .update({ msrp_usd: newPrice })
      .eq('id', polish.id)
    if (error) console.error(`  Error updating ${polish.name}:`, error.message)
    else updated++
  }
}

if (DRY_RUN) {
  console.log(`\nDry run — ${dbPolishes.length - unmatched - skipped} would be updated, ${skipped} already correct, ${unmatched} not in Shopify catalog`)
} else {
  console.log(`\n✓ Updated: ${updated} | Already correct: ${skipped} | Not in catalog: ${unmatched}`)
}
