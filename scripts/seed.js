#!/usr/bin/env node
// DupeTroop seed script
// Run with: node scripts/seed.js

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://utuloyxlkqaigfgbkfye.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dWxveXhsa3FhaWdmZ2JrZnllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEyNTg4NSwiZXhwIjoyMDkxNzAxODg1fQ.XyJII1sMBXcQMqpCT_-ji2loEWjfEFivhsdK8CKnTyA'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ─── BRANDS ──────────────────────────────────────────────────────────────────

const brands = [
  { name: 'Holo Taco', slug: 'holo-taco', website_url: 'https://holotaco.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
  { name: 'KBShimmer', slug: 'kbshimmer', website_url: 'https://kbshimmer.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
  { name: 'Mooncat', slug: 'mooncat', website_url: 'https://mooncat.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
  { name: 'Cirque Colors', slug: 'cirque-colors', website_url: 'https://cirquecolors.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
  { name: 'ILNP', slug: 'ilnp', website_url: 'https://ilnp.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
  { name: 'Different Dimension', slug: 'different-dimension', website_url: 'https://differentdimension.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
  { name: 'Glisten & Glow', slug: 'glisten-and-glow', website_url: 'https://glistenandglow.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
  { name: 'Rogue Lacquer', slug: 'rogue-lacquer', website_url: 'https://roguelacquer.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
  { name: 'Supernatural', slug: 'supernatural', website_url: 'https://supernaturallacquer.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
  { name: 'Pahlish', slug: 'pahlish', website_url: 'https://pahlish.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
  { name: 'Girly Bits', slug: 'girly-bits', website_url: 'https://girlybitscosmetics.com', is_indie: true, price_tier: 3, country_of_origin: 'CA' },
  { name: 'Wildflower Lacquer', slug: 'wildflower-lacquer', website_url: 'https://wildflowerlacquer.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
  { name: 'OPI', slug: 'opi', website_url: 'https://opi.com', is_indie: false, price_tier: 2, country_of_origin: 'US' },
  { name: 'Essie', slug: 'essie', website_url: 'https://essie.com', is_indie: false, price_tier: 2, country_of_origin: 'US' },
  { name: 'Sally Hansen', slug: 'sally-hansen', website_url: 'https://sallyhansen.com', is_indie: false, price_tier: 1, country_of_origin: 'US' },
  { name: 'Zoya', slug: 'zoya', website_url: 'https://zoya.com', is_indie: false, price_tier: 2, country_of_origin: 'US' },
  { name: 'Uno Mas Colors', slug: 'uno-mas-colors', website_url: 'https://unomascolors.com', is_indie: true, price_tier: 3, country_of_origin: 'US' },
]

// ─── POLISHES ─────────────────────────────────────────────────────────────────
// Defined as functions so we can inject brand UUIDs after insert

function getPolishes(brandMap) {
  return [
    // Holo Taco
    { brand_id: brandMap['holo-taco'], name: 'Flakie Holo Taco', slug: 'flakie-holo-taco', hex_color: '#C0C0C0', finish_category: 'flakies', color_family: 'neutral', msrp_usd: 13, is_verified: true },
    { brand_id: brandMap['holo-taco'], name: 'Linear Holo Taco', slug: 'linear-holo-taco', hex_color: '#C8D0E0', finish_category: 'holo', color_family: 'neutral', msrp_usd: 13, is_verified: true },
    { brand_id: brandMap['holo-taco'], name: 'Peacock', slug: 'peacock', hex_color: '#2E8B8B', finish_category: 'duochrome', color_family: 'green', hex_secondary: '#7B4FD4', msrp_usd: 13, is_verified: true },
    { brand_id: brandMap['holo-taco'], name: 'Blue Moon', slug: 'blue-moon', hex_color: '#3A6FD8', finish_category: 'holo', color_family: 'blue', msrp_usd: 13, is_verified: true },
    { brand_id: brandMap['holo-taco'], name: 'Candy Cane', slug: 'candy-cane', hex_color: '#E84B6A', finish_category: 'glitter', color_family: 'red', msrp_usd: 13, is_verified: true },
    { brand_id: brandMap['holo-taco'], name: 'Mermaid Toast', slug: 'mermaid-toast', hex_color: '#7BC8B8', finish_category: 'multichrome', color_family: 'blue', hex_secondary: '#B87BDE', msrp_usd: 13, is_verified: true },

    // KBShimmer
    { brand_id: brandMap['kbshimmer'], name: 'Clearly on Top', slug: 'clearly-on-top', hex_color: '#E8E8E8', finish_category: 'holo', color_family: 'neutral', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['kbshimmer'], name: 'I Sea the Point', slug: 'i-sea-the-point', hex_color: '#4A9EC8', finish_category: 'holo', color_family: 'blue', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['kbshimmer'], name: 'Whiskey Business', slug: 'whiskey-business', hex_color: '#C87840', finish_category: 'shimmer', color_family: 'orange', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['kbshimmer'], name: 'Brace For Impact', slug: 'brace-for-impact', hex_color: '#7A5BB8', finish_category: 'holo', color_family: 'purple', msrp_usd: 10, is_verified: true },

    // Mooncat
    { brand_id: brandMap['mooncat'], name: 'Bloodbender', slug: 'bloodbender', hex_color: '#8B1A2B', finish_category: 'multichrome', color_family: 'red', hex_secondary: '#4B0082', msrp_usd: 12, is_verified: true },
    { brand_id: brandMap['mooncat'], name: 'Selkie', slug: 'selkie', hex_color: '#6BAED6', finish_category: 'shimmer', color_family: 'blue', msrp_usd: 12, is_verified: true },
    { brand_id: brandMap['mooncat'], name: 'Supernova', slug: 'supernova', hex_color: '#9B4DCA', finish_category: 'multichrome', color_family: 'purple', hex_secondary: '#1A6FD8', msrp_usd: 12, is_verified: true },
    { brand_id: brandMap['mooncat'], name: 'Void', slug: 'void', hex_color: '#0A0A18', finish_category: 'holo', color_family: 'black', msrp_usd: 12, is_verified: true },

    // Cirque Colors
    { brand_id: brandMap['cirque-colors'], name: 'Duchess', slug: 'duchess', hex_color: '#E8D5D0', finish_category: 'shimmer', color_family: 'neutral', msrp_usd: 16, is_verified: true },
    { brand_id: brandMap['cirque-colors'], name: 'Ultraviolet', slug: 'ultraviolet', hex_color: '#5B2D8E', finish_category: 'cream', color_family: 'purple', msrp_usd: 16, is_verified: true },
    { brand_id: brandMap['cirque-colors'], name: 'Verdant', slug: 'verdant', hex_color: '#3A7A4A', finish_category: 'cream', color_family: 'green', msrp_usd: 16, is_verified: true },

    // ILNP
    { brand_id: brandMap['ilnp'], name: 'Ultra Holo', slug: 'ultra-holo', hex_color: '#D8D8E8', finish_category: 'holo', color_family: 'neutral', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['ilnp'], name: 'Starstruck', slug: 'starstruck', hex_color: '#C0A8E0', finish_category: 'holo', color_family: 'purple', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['ilnp'], name: 'Ruby Ruby', slug: 'ruby-ruby', hex_color: '#C02030', finish_category: 'shimmer', color_family: 'red', msrp_usd: 10, is_verified: true },

    // Different Dimension
    { brand_id: brandMap['different-dimension'], name: 'Outerspace', slug: 'outerspace', hex_color: '#1A1A3A', finish_category: 'multichrome', color_family: 'blue', hex_secondary: '#7B2FBE', msrp_usd: 13, is_verified: true },
    { brand_id: brandMap['different-dimension'], name: 'Magpie', slug: 'magpie', hex_color: '#3A3A5A', finish_category: 'duochrome', color_family: 'blue', hex_secondary: '#5A8A6A', msrp_usd: 13, is_verified: true },

    // Glisten & Glow
    { brand_id: brandMap['glisten-and-glow'], name: 'HK Girl', slug: 'hk-girl', hex_color: '#F5F5F5', finish_category: 'other', color_family: 'neutral', msrp_usd: 11, is_verified: true },
    { brand_id: brandMap['glisten-and-glow'], name: 'Mermaid Wishes', slug: 'mermaid-wishes', hex_color: '#5DC8C8', finish_category: 'holo', color_family: 'blue', msrp_usd: 11, is_verified: true },

    // Rogue Lacquer
    { brand_id: brandMap['rogue-lacquer'], name: 'Galaxy Brain', slug: 'galaxy-brain', hex_color: '#2B1D5A', finish_category: 'multichrome', color_family: 'purple', hex_secondary: '#4A9080', msrp_usd: 13, is_verified: true },
    { brand_id: brandMap['rogue-lacquer'], name: 'Shift Happens', slug: 'shift-happens', hex_color: '#4A7090', finish_category: 'duochrome', color_family: 'blue', hex_secondary: '#7A4A90', msrp_usd: 13, is_verified: true },

    // OPI
    { brand_id: brandMap['opi'], name: 'Lincoln Park After Dark', slug: 'lincoln-park-after-dark', hex_color: '#2D1A3A', finish_category: 'cream', color_family: 'purple', msrp_usd: 11, is_verified: true },
    { brand_id: brandMap['opi'], name: 'Malaga Wine', slug: 'malaga-wine', hex_color: '#6B1A2A', finish_category: 'cream', color_family: 'red', msrp_usd: 11, is_verified: true },
    { brand_id: brandMap['opi'], name: 'Icelanded a Bottle of OPI', slug: 'icelanded-a-bottle-of-opi', hex_color: '#A8C8D0', finish_category: 'cream', color_family: 'blue', msrp_usd: 11, is_verified: true },
    { brand_id: brandMap['opi'], name: 'OPI Red', slug: 'opi-red', hex_color: '#C01828', finish_category: 'cream', color_family: 'red', msrp_usd: 11, is_verified: true },

    // Essie
    { brand_id: brandMap['essie'], name: 'Bordeaux', slug: 'bordeaux', hex_color: '#5A1528', finish_category: 'cream', color_family: 'red', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['essie'], name: 'Midnight Cami', slug: 'midnight-cami', hex_color: '#1A1830', finish_category: 'shimmer', color_family: 'blue', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['essie'], name: 'Wicked', slug: 'wicked', hex_color: '#3D1040', finish_category: 'cream', color_family: 'purple', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['essie'], name: 'Ballet Slippers', slug: 'ballet-slippers', hex_color: '#F2E0E4', finish_category: 'cream', color_family: 'pink', msrp_usd: 10, is_verified: true },

    // Zoya
    { brand_id: brandMap['zoya'], name: 'Posh', slug: 'posh', hex_color: '#D4A8B8', finish_category: 'shimmer', color_family: 'pink', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['zoya'], name: 'Raven', slug: 'raven', hex_color: '#0A0A0A', finish_category: 'cream', color_family: 'black', msrp_usd: 10, is_verified: true },
    { brand_id: brandMap['zoya'], name: 'Seraphina', slug: 'seraphina', hex_color: '#8B4570', finish_category: 'shimmer', color_family: 'purple', msrp_usd: 10, is_verified: true },
  ]
}

// ─── DUPE PAIRS ───────────────────────────────────────────────────────────────
// Defined as slug pairs; resolved to IDs after polish insert

const dupePairs = [
  // Linear holo dupes
  { a: 'linear-holo-taco', b: 'clearly-on-top', notes: 'Both are strong linear holographic toppers. HK Girl is clearer but Clearly on Top has similar effect on top of color.' },
  { a: 'linear-holo-taco', b: 'ultra-holo', notes: 'Very similar linear holo density and rainbow spectrum.' },

  // Deep purple/plum
  { a: 'lincoln-park-after-dark', b: 'midnight-cami', notes: 'Both deep vampy purple-blue shades, very close in the bottle and on the nail.' },
  { a: 'lincoln-park-after-dark', b: 'wicked', notes: 'Wicked skews warmer/redder, LPAD skews cooler, but both fill the vampy dark purple niche.' },

  // Red dupes
  { a: 'opi-red', b: 'bordeaux', notes: 'Bordeaux is slightly darker/deeper but both are classic reds that behave similarly.' },

  // Duochrome/multichrome
  { a: 'peacock', b: 'magpie', notes: 'Both shift teal-to-purple. Peacock is brighter; Magpie is more muted and smoky.' },
  { a: 'bloodbender', b: 'outerspace', notes: 'Both are deep dark multichromes shifting red-to-purple and blue-to-purple respectively. Similar moody vibe.' },
  { a: 'galaxy-brain', b: 'supernova', notes: 'Deep purple multichromes with a blue-green shift. Very close in coverage and shift range.' },

  // Blue holo
  { a: 'blue-moon', b: 'i-sea-the-point', notes: 'Both mid-blue linear holos. Blue Moon is slightly more vibrant; I Sea the Point leans slightly teal.' },
  { a: 'blue-moon', b: 'starstruck', notes: 'Starstruck is more lavender but both read as purple-blue holo in certain lights.' },

  // Duochrome blue-purple
  { a: 'shift-happens', b: 'selkie', notes: 'Both soft blue with shimmer. Selkie is a true shimmer; Shift Happens has more of a duochrome flip.' },
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
  const polishes = getPolishes(brandMap)
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
