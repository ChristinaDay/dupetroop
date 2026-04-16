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
  'quad', 'collection']

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

  // ── KBShimmer (manual) ──────────────────────────────────────────────────────
  console.log('Adding KBShimmer...')
  allPolishes.push(...manual(brandId['kbshimmer'], [
    { name: 'Clearly on Top',      slug: 'clearly-on-top',      hex_color: '#E8E8F0', finish_category: 'holo',     color_family: 'neutral', msrp_usd: 10 },
    { name: 'I Sea the Point',     slug: 'i-sea-the-point',     hex_color: '#4A9EC8', finish_category: 'holo',     color_family: 'blue',    msrp_usd: 10 },
    { name: 'Whiskey Business',    slug: 'whiskey-business',    hex_color: '#C87840', finish_category: 'shimmer',  color_family: 'orange',  msrp_usd: 10 },
    { name: 'Brace For Impact',    slug: 'brace-for-impact',    hex_color: '#7A5BB8', finish_category: 'holo',     color_family: 'purple',  msrp_usd: 10 },
    { name: 'Happiness is a Mood', slug: 'happiness-is-a-mood', hex_color: '#E8A8C8', finish_category: 'holo',     color_family: 'pink',    msrp_usd: 10 },
    { name: "Don't Kale My Vibe",  slug: 'dont-kale-my-vibe',  hex_color: '#3A8A4A', finish_category: 'cream',    color_family: 'green',   msrp_usd: 10 },
    { name: 'Sultans of Shimmer',  slug: 'sultans-of-shimmer',  hex_color: '#C8A040', finish_category: 'shimmer',  color_family: 'yellow',  msrp_usd: 10 },
  ]))

  // ── ILNP (manual) ───────────────────────────────────────────────────────────
  console.log('Adding ILNP...')
  allPolishes.push(...manual(brandId['ilnp'], [
    { name: 'Ultra Chrome Flakies', slug: 'ultra-chrome-flakies', hex_color: '#E0E0E8', finish_category: 'flakies',    color_family: 'neutral', msrp_usd: 10 },
    { name: 'Starstruck',           slug: 'starstruck',           hex_color: '#C0A8E0', finish_category: 'holo',        color_family: 'purple',  msrp_usd: 10 },
    { name: 'Ruby Ruby',            slug: 'ruby-ruby',            hex_color: '#C02030', finish_category: 'shimmer',     color_family: 'red',     msrp_usd: 10 },
    { name: 'Astronomer',           slug: 'astronomer',           hex_color: '#2A3A8A', finish_category: 'multichrome', color_family: 'blue',    msrp_usd: 10 },
    { name: 'Supercell',            slug: 'supercell',            hex_color: '#4A2A8A', finish_category: 'holo',        color_family: 'purple',  msrp_usd: 10 },
    { name: 'Reverie',              slug: 'reverie',              hex_color: '#C8A8B8', finish_category: 'shimmer',     color_family: 'pink',    msrp_usd: 10 },
  ]))

  // ── Cirque Colors (manual) ──────────────────────────────────────────────────
  console.log('Adding Cirque Colors...')
  allPolishes.push(...manual(brandId['cirque-colors'], [
    { name: 'Duchess',          slug: 'duchess',          hex_color: '#E8D5D0', finish_category: 'shimmer',     color_family: 'neutral', msrp_usd: 16 },
    { name: 'Retrograde',       slug: 'retrograde',       hex_color: '#3A2A7A', finish_category: 'multichrome', color_family: 'purple',  msrp_usd: 16 },
    { name: 'Crystallize',      slug: 'crystallize',      hex_color: '#E8E8F0', finish_category: 'holo',        color_family: 'neutral', msrp_usd: 16 },
    { name: 'Forest Bathing',   slug: 'forest-bathing',   hex_color: '#3A6A3A', finish_category: 'shimmer',     color_family: 'green',   msrp_usd: 16 },
    { name: 'Ultraviolet',      slug: 'ultraviolet',      hex_color: '#5B2D8E', finish_category: 'cream',       color_family: 'purple',  msrp_usd: 16 },
    { name: 'Verdant',          slug: 'verdant',          hex_color: '#3A7A4A', finish_category: 'cream',       color_family: 'green',   msrp_usd: 16 },
  ]))

  // ── Glisten & Glow (manual) ─────────────────────────────────────────────────
  console.log('Adding Glisten & Glow...')
  allPolishes.push(...manual(brandId['glisten-and-glow'], [
    { name: 'HK Girl',              slug: 'hk-girl',              hex_color: '#F0F0F0', finish_category: 'topper', color_family: 'neutral', msrp_usd: 11 },
    { name: 'Mermaid Wishes',       slug: 'mermaid-wishes',       hex_color: '#5DC8C8', finish_category: 'holo',   color_family: 'blue',    msrp_usd: 11 },
    { name: 'Kicking and Streaming',slug: 'kicking-and-streaming',hex_color: '#4A90A0', finish_category: 'shimmer',color_family: 'blue',    msrp_usd: 11 },
    { name: 'Lemon Drop',           slug: 'lemon-drop',           hex_color: '#E8D840', finish_category: 'holo',   color_family: 'yellow',  msrp_usd: 11 },
  ]))

  // ── Rogue Lacquer (manual) ──────────────────────────────────────────────────
  console.log('Adding Rogue Lacquer...')
  allPolishes.push(...manual(brandId['rogue-lacquer'], [
    { name: 'Galaxy Brain',  slug: 'galaxy-brain',  hex_color: '#2B1D5A', finish_category: 'multichrome', color_family: 'purple', msrp_usd: 13 },
    { name: 'Shift Happens', slug: 'shift-happens', hex_color: '#4A7090', finish_category: 'duochrome',   color_family: 'blue',   msrp_usd: 13 },
    { name: 'The Blues',     slug: 'the-blues',     hex_color: '#1A3A7A', finish_category: 'holo',        color_family: 'blue',   msrp_usd: 13 },
    { name: 'Burn It Down',  slug: 'burn-it-down',  hex_color: '#C04020', finish_category: 'shimmer',     color_family: 'red',    msrp_usd: 13 },
    { name: 'Night Howler',  slug: 'night-howler',  hex_color: '#1A1A3A', finish_category: 'multichrome', color_family: 'blue',   msrp_usd: 13 },
  ]))

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
