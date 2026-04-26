#!/usr/bin/env node
// DupeTroop seed script
// Run with: node scripts/seed.js

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://utuloyxlkqaigfgbkfye.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dWxveXhsa3FhaWdmZ2JrZnllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEyNTg4NSwiZXhwIjoyMDkxNzAxODg1fQ.XyJII1sMBXcQMqpCT_-ji2loEWjfEFivhsdK8CKnTyA'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ─── BRANDS ──────────────────────────────────────────────────────────────────

const brands = [
  { name: 'Holo Taco', slug: 'holo-taco', website_url: 'https://holotaco.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'KBShimmer', slug: 'kbshimmer', website_url: 'https://kbshimmer.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'Mooncat', slug: 'mooncat', website_url: 'https://mooncat.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'Cirque Colors', slug: 'cirque-colors', website_url: 'https://cirquecolors.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'ILNP', slug: 'ilnp', website_url: 'https://ilnp.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'Glisten & Glow', slug: 'glisten-and-glow', website_url: 'https://glistenandglow.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'Rogue Lacquer', slug: 'rogue-lacquer', website_url: 'https://roguelacquer.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'Supernatural', slug: 'supernatural', website_url: 'https://supernaturallacquer.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'Pahlish', slug: 'pahlish', website_url: 'https://pahlish.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'Girly Bits', slug: 'girly-bits', website_url: 'https://girlybitscosmetics.com', is_indie: true, price_tier: 3, country_of_origin: 'Canada' },
  { name: 'Wildflower Lacquer', slug: 'wildflower-lacquer', website_url: 'https://wildflowerlacquer.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'OPI', slug: 'opi', website_url: 'https://opi.com', is_indie: false, price_tier: 2, country_of_origin: 'United States' },
  { name: 'Essie', slug: 'essie', website_url: 'https://essie.com', is_indie: false, price_tier: 2, country_of_origin: 'United States' },
  { name: 'Sally Hansen', slug: 'sally-hansen', website_url: 'https://sallyhansen.com', is_indie: false, price_tier: 1, country_of_origin: 'United States' },
  { name: 'Zoya', slug: 'zoya', website_url: 'https://zoya.com', is_indie: false, price_tier: 2, country_of_origin: 'United States' },
  { name: 'Uno Mas Colors', slug: 'uno-mas-colors', website_url: 'https://unomascolors.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'Starrily', slug: 'starrily', website_url: 'https://starrily.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'Cracked', slug: 'cracked', website_url: 'https://crackedpolish.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: "Bee's Knees Lacquer", slug: 'bees-knees-lacquer', website_url: 'https://beeskneeslacquer.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'Death Valley Nails', slug: 'death-valley-nails', website_url: 'https://deathvalleynails.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
  { name: 'Fancy Gloss', slug: 'fancy-gloss', website_url: 'https://fancyglosspolish.com', is_indie: true, price_tier: 3, country_of_origin: 'United States' },
]

// ─── POLISHES ─────────────────────────────────────────────────────────────────
// Defined as functions so we can inject brand UUIDs after insert

function getPolishes(brandMap) {
  return [
    // Mooncat — Bloodbender is the canonical example; full catalog covered by seed-products.js
    { brand_id: brandMap['mooncat'], name: 'Bloodbender', slug: 'bloodbender', hex_color: '#8B1A2B', finish_category: 'magnetic', color_family: 'red', hex_secondary: '#4B0082', msrp_usd: 12, is_verified: true },

    // OPI
    { brand_id: brandMap['opi'], name: 'Lincoln Park After Dark', slug: 'lincoln-park-after-dark', hex_color: '#2D1A3A', finish_category: 'cream', color_family: 'purple', msrp_usd: 11, is_verified: true },
    { brand_id: brandMap['opi'], name: 'Malaga Wine', slug: 'malaga-wine', hex_color: '#6B1A2A', finish_category: 'cream', color_family: 'red', msrp_usd: 11, is_verified: true },
    { brand_id: brandMap['opi'], name: 'Icelanded a Bottle of OPI', slug: 'icelanded-a-bottle-of-opi', hex_color: '#A8C8D0', finish_category: 'cream', color_family: 'blue', msrp_usd: 11, is_verified: true },
    { brand_id: brandMap['opi'], name: 'OPI Red', slug: 'opi-red', hex_color: '#C01828', finish_category: 'cream', color_family: 'red', msrp_usd: 11, is_verified: true },

    // Essie
    { brand_id: brandMap['essie'], name: 'Bordeaux', slug: 'bordeaux', hex_color: '#5A1528', finish_category: 'cream', color_family: 'red', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['essie'], name: 'Midnight Cami', slug: 'midnight-cami', hex_color: '#1A1830', finish_category: 'shimmer', color_family: 'blue', msrp_usd: 10, is_verified: true, is_discontinued: true },
    { brand_id: brandMap['essie'], name: 'Wicked', slug: 'wicked', hex_color: '#3D1040', finish_category: 'cream', color_family: 'purple', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['essie'], name: 'Ballet Slippers', slug: 'ballet-slippers', hex_color: '#F2E0E4', finish_category: 'cream', color_family: 'pink', msrp_usd: 10, is_verified: true },

    // OPI — additional polishes for dupe coverage
    { brand_id: brandMap['opi'], name: 'Bubble Bath', slug: 'bubble-bath', hex_color: '#F0E0E4', finish_category: 'shimmer', color_family: 'pink', msrp_usd: 11, is_verified: true },
    { brand_id: brandMap['opi'], name: 'Funny Bunny', slug: 'funny-bunny', hex_color: '#F5F0F0', finish_category: 'cream', color_family: 'neutral', msrp_usd: 11, is_verified: true },
    { brand_id: brandMap['opi'], name: 'Black Onyx', slug: 'black-onyx', hex_color: '#0A0A0A', finish_category: 'cream', color_family: 'black', msrp_usd: 11, is_verified: true },

    // Essie — additional polishes for dupe coverage
    { brand_id: brandMap['essie'], name: 'Blanc', slug: 'blanc', hex_color: '#F0EEE8', finish_category: 'cream', color_family: 'neutral', msrp_usd: 10, is_verified: true },

    // Zoya
    { brand_id: brandMap['zoya'], name: 'Posh', slug: 'posh', hex_color: '#D4A8B8', finish_category: 'shimmer', color_family: 'pink', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['zoya'], name: 'Raven', slug: 'raven', hex_color: '#0A0A0A', finish_category: 'cream', color_family: 'black', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['zoya'], name: 'Seraphina', slug: 'seraphina', hex_color: '#8B4570', finish_category: 'shimmer', color_family: 'purple', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['zoya'], name: 'Storm', slug: 'storm', hex_color: '#6080A0', finish_category: 'cream', color_family: 'blue', msrp_usd: 10, is_verified: true },

    // Sally Hansen — additional polishes for dupe coverage
    { brand_id: brandMap['sally-hansen'], name: 'Celeb City', slug: 'celeb-city', hex_color: '#2B1040', finish_category: 'cream', color_family: 'purple', msrp_usd: 7, is_verified: true, is_discontinued: true },
  ]
}

// ─── DUPE PAIRS ───────────────────────────────────────────────────────────────
// Defined as slug pairs; resolved to IDs after polish insert

const dupePairs = [
  // Sheer pinks — the most-discussed drugstore dupe pair in nail polish
  { a: 'bubble-bath', b: 'ballet-slippers', notes: "The most-discussed drugstore dupe pair in nail polish. Both achieve the 'your nails but better' sheer pink effect — Bubble Bath in shimmer, Ballet Slippers in cream. Hex values are nearly identical; finish is the main difference." },

  // Deep purple/plum
  { a: 'lincoln-park-after-dark', b: 'midnight-cami', notes: 'Both deep vampy purple-blue shades, very close in the bottle and on the nail.' },
  { a: 'lincoln-park-after-dark', b: 'wicked', notes: 'Wicked skews warmer/redder, LPAD skews cooler, but both fill the vampy dark purple niche.' },
  { a: 'celeb-city', b: 'lincoln-park-after-dark', notes: 'Celeb City is one of the most-cited budget alternatives to LPAD — same vampy blackened purple at roughly half the price. Celeb City runs a touch warmer but achieves the same dramatic effect.' },

  // Red / burgundy
  { a: 'opi-red', b: 'bordeaux', notes: 'Bordeaux is slightly darker/deeper but both are classic reds that behave similarly.' },
  { a: 'malaga-wine', b: 'bordeaux', notes: 'Both are classic dark burgundy-red creams at nearly identical price points. Malaga Wine skews slightly more red; Bordeaux sits a touch deeper and cooler. Autumn staples that are virtually interchangeable on the nail.' },

  // Jet blacks
  { a: 'black-onyx', b: 'raven', notes: "Two classic jet-black creams — indistinguishable on the nail. The main difference is formula preference. Zoya Raven is free of the 'Big 3' toxins; OPI Black Onyx is the old-school standard." },

  // Sheer whites
  { a: 'blanc', b: 'funny-bunny', notes: "Both are the go-to sheer white 'clean nail' polishes. Funny Bunny is slightly sheerer and cooler-toned; Blanc has a faint warm cast. Recommended interchangeably across nail communities." },

]

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('Seeding brands...')
  const { data: insertedBrands, error: brandError } = await supabase
    .from('brands')
    .upsert(brands, { onConflict: 'slug', ignoreDuplicates: false })
    .select('id, slug')

  if (brandError) {
    console.error('Brand insert error:', brandError)
    process.exit(1)
  }

  const brandMap = Object.fromEntries(insertedBrands.map(b => [b.slug, b.id]))
  console.log(`  ${insertedBrands.length} brands seeded`)

  console.log('Seeding polishes...')
  const polishes = getPolishes(brandMap).map(p => ({ is_discontinued: false, ...p }))
  const { data: insertedPolishes, error: polishError } = await supabase
    .from('polishes')
    .upsert(polishes, { onConflict: 'brand_id,slug', ignoreDuplicates: false })
    .select('id, slug')

  if (polishError) {
    console.error('Polish insert error:', polishError)
    process.exit(1)
  }

  const polishMap = Object.fromEntries(insertedPolishes.map(p => [p.slug, p.id]))
  console.log(`  ${insertedPolishes.length} polishes seeded`)

  console.log('Seeding dupes...')
  const dupes = dupePairs
    .filter(({ a, b }) => {
      if (!polishMap[a]) { console.warn(`  SKIP: unknown slug "${a}"`) ; return false }
      if (!polishMap[b]) { console.warn(`  SKIP: unknown slug "${b}"`) ; return false }
      return true
    })
    .map(({ a, b, notes }) => ({
      polish_a_id: polishMap[a],
      polish_b_id: polishMap[b],
      status: 'approved',
      notes,
    }))

  // Expression index (LEAST/GREATEST) can't be used with upsert onConflict — insert individually
  let dupeCount = 0
  for (const dupe of dupes) {
    const { error } = await supabase.from('dupes').insert(dupe)
    if (error && error.code !== '23505') console.warn('  dupe insert warn:', error.message)
    else if (!error) dupeCount++
  }
  console.log(`  ${dupeCount} dupes seeded`)

  console.log('\nDone! 🎉')
}

seed()
