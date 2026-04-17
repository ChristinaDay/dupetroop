#!/usr/bin/env node
/**
 * DupeTroop — AI-Powered Dupe Suggester
 *
 * Uses Claude + web search to find community-sourced dupe suggestions for
 * polishes (Reddit, blogs, nail polish forums, etc.), then matches them
 * against the DupeTroop catalog and optionally inserts them as pending dupes.
 *
 * Usage:
 *   node --env-file=.env.local scripts/suggest-dupes-ai.js --polish="Bloodbender"
 *   node --env-file=.env.local scripts/suggest-dupes-ai.js --polish="House of Hades" --insert
 *   node --env-file=.env.local scripts/suggest-dupes-ai.js --brand=mooncat --top=5
 *   node --env-file=.env.local scripts/suggest-dupes-ai.js --polish="Ballet Slippers" --dry-run
 *
 * Flags:
 *   --polish="Name"   Search for dupes of a specific polish (by name, case-insensitive)
 *   --brand=slug      Process all polishes for a brand (up to --top each)
 *   --top=N           Max polishes to process when using --brand (default: 10)
 *   --insert          Insert matched candidates as pending dupes
 *   --dry-run         With --insert: show what would be inserted without writing
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import readline from 'readline'

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars. Run with: node --env-file=.env.local ...')
  process.exit(1)
}
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY. Add it to .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// ─── CLI flags ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const flagVal = (name, def = null) => {
  const f = argv.find(a => a.startsWith(`--${name}=`))
  return f ? f.split('=').slice(1).join('=') : def
}

const POLISH_NAME  = flagVal('polish')
const BRAND_FILTER = flagVal('brand')
const TOP_N        = parseInt(flagVal('top', '10'), 10)
const INSERT       = flag('insert')
const DRY_RUN      = flag('dry-run')

if (!POLISH_NAME && !BRAND_FILTER) {
  console.error('Provide --polish="Name" or --brand=slug')
  process.exit(1)
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function fetchPolish(name) {
  const { data, error } = await supabase
    .from('polishes')
    .select('id, name, slug, finish_category, hex_color, is_discontinued, brands:brand_id(id, name, slug)')
    .ilike('name', name)
    .eq('is_verified', true)
    .eq('is_discontinued', false)
    .limit(5)
  if (error) throw new Error(error.message)
  return data
}

async function fetchBrandPolishes(brandSlug) {
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('slug', brandSlug)
    .single()
  if (!brand) throw new Error(`Brand not found: ${brandSlug}`)

  const { data, error } = await supabase
    .from('polishes')
    .select('id, name, slug, finish_category, hex_color, is_discontinued, brands:brand_id(id, name, slug)')
    .eq('brand_id', brand.id)
    .eq('is_verified', true)
    .eq('is_discontinued', false)
    .limit(TOP_N)
  if (error) throw new Error(error.message)
  return data
}

async function fetchExistingPairs() {
  const { data, error } = await supabase.from('dupes').select('polish_a_id, polish_b_id')
  if (error) throw new Error(error.message)
  const pairs = new Set()
  for (const d of data) pairs.add([d.polish_a_id, d.polish_b_id].sort().join(':'))
  return pairs
}

// Load entire catalog for matching (paginated)
async function fetchCatalog() {
  let all = [], from = 0
  while (true) {
    const { data, error } = await supabase
      .from('polishes')
      .select('id, name, slug, is_discontinued, brands:brand_id(id, name, slug)')
      .eq('is_verified', true)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    all.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return all
}

// ─── Fuzzy catalog matching ────────────────────────────────────────────────────

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function findCatalogMatch(suggestion, catalog) {
  const normBrand = normalize(suggestion.brand)
  const normName  = normalize(suggestion.name)

  // Exact match first
  let match = catalog.find(p =>
    normalize(p.brands.name) === normBrand &&
    normalize(p.name) === normName
  )
  if (match) return { polish: match, confidence: 'exact' }

  // Brand exact + name contains
  match = catalog.find(p =>
    normalize(p.brands.name) === normBrand &&
    (normalize(p.name).includes(normName) || normName.includes(normalize(p.name)))
  )
  if (match) return { polish: match, confidence: 'fuzzy' }

  // Brand slug partial + name exact
  match = catalog.find(p =>
    (normalize(p.brands.name).includes(normBrand) || normBrand.includes(normalize(p.brands.name))) &&
    normalize(p.name) === normName
  )
  if (match) return { polish: match, confidence: 'fuzzy' }

  // Name-only exact (brand may be wrong/missing)
  match = catalog.find(p => normalize(p.name) === normName)
  if (match) return { polish: match, confidence: 'name-only' }

  return null
}

// ─── Claude web search ────────────────────────────────────────────────────────

async function searchDupesForPolish(polish) {
  const brandName  = polish.brands.name
  const polishName = polish.name
  const finish     = polish.finish_category ? ` (${polish.finish_category})` : ''

  console.log(`\n  Searching for dupes of: ${brandName} — ${polishName}${finish}`)

  const systemPrompt = `You are a nail polish dupe expert. Search the web for community-sourced dupe suggestions for a specific polish. Focus on Reddit (r/lacqueristas, r/nail_art, r/RedditLaqueristas), nail polish blogs, MakeupAlley, Temptalia, and similar community sources.

Return ONLY a JSON array of suggestions. Each item must have:
- "brand": the brand name (exact as commonly known)
- "name": the polish name (exact as commonly known)
- "reason": brief explanation of why it's considered a dupe (1-2 sentences)
- "confidence": "high" | "medium" | "low" based on how credible the source is

Exclude the original polish itself. Exclude suggestions where the brand or name is unclear. Return an empty array [] if no reliable dupes are found.`

  const userMessage = `Find nail polish dupes for: ${brandName} "${polishName}"${finish}

Search for community discussions, Reddit threads, blog posts, and reviews that mention dupes or alternatives. Return a JSON array of suggested dupes found in these community sources.`

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      tools: [{ type: 'web_search_20260209', name: 'web_search' }],
      messages: [{ role: 'user', content: userMessage }],
    })

    const response = await stream.finalMessage()

    // Extract text from the response
    let text = ''
    for (const block of response.content) {
      if (block.type === 'text') text += block.text
    }

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log('    No JSON found in response')
      return []
    }

    const suggestions = JSON.parse(jsonMatch[0])
    console.log(`    Found ${suggestions.length} suggestion(s) from web search`)
    return suggestions
  } catch (err) {
    console.error(`    Search error: ${err.message}`)
    return []
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Loading catalog...')
  const catalog = await fetchCatalog()
  console.log(`  ${catalog.length} polishes loaded`)

  console.log('Loading existing dupe pairs...')
  const existingPairs = await fetchExistingPairs()
  console.log(`  ${existingPairs.size} existing pairs (will be skipped)`)

  // Resolve which polishes to process
  let polishes = []
  if (POLISH_NAME) {
    const matches = await fetchPolish(POLISH_NAME)
    if (matches.length === 0) {
      console.error(`\nNo verified polish found matching "${POLISH_NAME}"`)
      console.error('Try a partial name, or check the spelling.')
      process.exit(1)
    }
    if (matches.length > 1) {
      console.log(`\nMultiple matches for "${POLISH_NAME}":`)
      matches.forEach((p, i) => console.log(`  ${i + 1}. ${p.brands.name} — ${p.name}`))
      const idx = await promptChoice('Which one? (number): ', matches.length)
      polishes = [matches[idx - 1]]
    } else {
      polishes = matches
    }
  } else {
    polishes = await fetchBrandPolishes(BRAND_FILTER)
    console.log(`\nProcessing ${polishes.length} polishes from ${BRAND_FILTER}`)
  }

  // Process each polish
  const allCandidates = []

  for (const polish of polishes) {
    const suggestions = await searchDupesForPolish(polish)

    for (const suggestion of suggestions) {
      const match = findCatalogMatch(suggestion, catalog)
      if (!match) {
        console.log(`    ⚠ Not in catalog: ${suggestion.brand} — ${suggestion.name}`)
        continue
      }

      const matchedPolish = match.polish

      // Skip same polish
      if (matchedPolish.id === polish.id) continue

      // Skip discontinued
      if (matchedPolish.is_discontinued) continue

      // Skip existing pairs
      const pairKey = [polish.id, matchedPolish.id].sort().join(':')
      if (existingPairs.has(pairKey)) {
        console.log(`    → Already exists: ${matchedPolish.brands.name} — ${matchedPolish.name}`)
        continue
      }

      allCandidates.push({
        source: polish,
        target: matchedPolish,
        suggestion,
        matchConfidence: match.confidence,
      })

      console.log(`    ✓ [${match.confidence}] ${matchedPolish.brands.name} — ${matchedPolish.name}`)
      console.log(`      "${suggestion.reason}"`)
    }

    // Polite delay between requests
    if (polishes.length > 1) {
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  // Summary
  console.log('\n' + '━'.repeat(70))
  console.log(` Results: ${allCandidates.length} candidate dupe pair(s) found`)
  console.log('━'.repeat(70))

  if (allCandidates.length === 0) {
    console.log('\nNo new dupe candidates found.')
    return
  }

  for (const { source, target, suggestion, matchConfidence } of allCandidates) {
    console.log(`\n  ${source.brands.name} — ${source.name}`)
    console.log(`  ↔ ${target.brands.name} — ${target.name}  [${matchConfidence} match, ${suggestion.confidence} confidence]`)
    console.log(`  "${suggestion.reason}"`)
  }

  if (!INSERT) {
    console.log('\nRun with --insert to add these as pending dupes for review at /admin/dupes')
    return
  }

  const rows = allCandidates.map(({ source, target, suggestion }) => ({
    polish_a_id: source.id,
    polish_b_id: target.id,
    submitted_by: null,
    status: 'pending',
    notes: `AI-suggested: ${suggestion.reason}`,
  }))

  if (DRY_RUN) {
    console.log(`\n[dry-run] Would insert ${rows.length} pending dupe(s).`)
    return
  }

  const confirmed = await confirm(`\nInsert ${rows.length} candidate(s) as pending dupes? [y/N] `)
  if (!confirmed) { console.log('Aborted.'); return }

  const { error } = await supabase.from('dupes').insert(rows)
  if (error) {
    console.error('Insert error:', error.message)
  } else {
    console.log(`✓ Inserted ${rows.length} pending dupe(s) — review at /admin/dupes`)
  }
}

function promptChoice(prompt, max) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, (answer) => {
      rl.close()
      const n = parseInt(answer.trim(), 10)
      if (n >= 1 && n <= max) resolve(n)
      else resolve(1)
    })
  })
}

function confirm(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, (answer) => { rl.close(); resolve(answer.trim().toLowerCase() === 'y') })
  })
}

main().catch(err => { console.error(err); process.exit(1) })
