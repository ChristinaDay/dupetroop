#!/usr/bin/env node
/**
 * DupeTroop — Brand logo backfill script
 *
 * Fetches logo URLs from each brand's website and updates the `brands` table.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-brand-logos.js
 *   node --env-file=.env.local scripts/backfill-brand-logos.js --dry-run
 *   node --env-file=.env.local scripts/backfill-brand-logos.js --brand mooncat
 *   node --env-file=.env.local scripts/backfill-brand-logos.js --force  # re-process already-set logos
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Run with: node --env-file=.env.local scripts/backfill-brand-logos.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const BRAND_FILTER = process.argv.includes('--brand')
  ? process.argv[process.argv.indexOf('--brand') + 1]
  : null

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

// ─── URL cleanup ──────────────────────────────────────────────────────────────

function cleanUrl(url) {
  if (!url) return null
  // Decode HTML entities (e.g. &amp; → &)
  url = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  // Shopify responsive image placeholder — replace with fixed width
  url = url.replace(/\{width\}/g, '600')
  return url
}

function absoluteUrl(src, baseUrl) {
  if (!src) return null
  src = cleanUrl(src)
  if (src.startsWith('http')) return src
  if (src.startsWith('//')) return 'https:' + src
  try {
    return new URL(src, baseUrl).href
  } catch {
    return null
  }
}

// ─── Logo quality heuristics ──────────────────────────────────────────────────
//
// Returns true  → strong positive signal (use this image)
// Returns false → strong negative signal (skip this image)
// Returns null  → neutral (use as last resort)

function scoreLogo(src, altText = '') {
  const s = (src || '').toLowerCase()
  const a = (altText || '').toLowerCase()

  // Strong positive — "logo" in the URL filename or alt wins over everything else
  const logoTerms = ['logo', 'brand-logo', 'site-logo', 'store-logo', 'wordmark']
  if (logoTerms.some(t => s.includes(t) || a.includes(t))) return true

  // Hard skip — only applies when no positive logo signal is present
  const skipTerms = [
    'nav', 'banner', 'promo', 'sale', 'hero', 'slide', 'carousel',
    'collection', 'product', 'campaign', 'limited.edition', 'limited_edition',
    'background', 'bg_', '_bg', 'backdrop', 'mega.nav', 'mega_nav',
    'icon.cart', 'icon_cart', 'icon.search', 'icon_search', 'icon.account',
    '/icons/', 'earn.icon', 'earn_icon', 'badge', 'star', 'payment',
    'social', 'arrow', 'chevron', 'placeholder',
    // Shopify resized icon suffixes
    '_16x16', '_20x20', '_24x24', '_30x30', '_32x32', '_40x40',
  ]
  if (skipTerms.some(t => s.includes(t))) return false

  // Neutral — might be the logo, might not
  return null
}

// ─── Shopify CDN logo fallback ─────────────────────────────────────────────────
// Try common logo file paths on Shopify CDN for brands where HTML scraping fails.

async function tryShopifyCdnLogo(domain) {
  const paths = [
    '/cdn/shop/files/logo.png',
    '/cdn/shop/files/logo.svg',
    '/cdn/shop/files/logo.gif',
    '/cdn/shop/files/Logo.png',
    '/cdn/shop/files/Logo.svg',
  ]
  for (const path of paths) {
    const url = `https://${domain}${path}`
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) return url
    } catch { /* try next */ }
  }
  return null
}

// ─── HTML logo extraction ─────────────────────────────────────────────────────

function extractLogoFromHtml(html, baseUrl) {
  // Restrict to the header section to avoid product images in body/footer.
  // Take up to 30k chars from the start of the <header> tag.
  const headerStart = html.search(/<header[\s> ]/i)
  let searchArea
  if (headerStart >= 0) {
    searchArea = html.slice(headerStart, headerStart + 40000)
    // Try to stop at </header> if present
    const headerEnd = searchArea.search(/<\/header>/i)
    if (headerEnd > 0) searchArea = searchArea.slice(0, headerEnd)
  } else {
    // No <header> tag — use top 20k of document
    searchArea = html.slice(0, 20000)
  }

  // Collect all img tags with their src and alt
  const imgTags = [...searchArea.matchAll(/<img([^>]+)>/gi)].map(m => {
    const attrs = m[1]
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/) || attrs.match(/\bdata-src=["']([^"']+)["']/)
    const altMatch = attrs.match(/\balt=["']([^"']*)["']/)
    return {
      src: srcMatch?.[1] || '',
      alt: altMatch?.[1] || '',
      attrs,
    }
  })

  // Score each image and pick the best
  const candidates = imgTags
    .map(img => ({ ...img, score: scoreLogo(img.src, img.alt) }))
    .filter(img => img.score !== false && img.src && img.src !== '#' && !img.src.includes('data:'))

  // Prefer strong positives
  const positive = candidates.find(img => img.score === true)
  if (positive) return absoluteUrl(positive.src, baseUrl)

  // Fall back to first neutral (skip any that look like nav promo images by filename length)
  const neutral = candidates.find(img => {
    const filename = img.src.split('/').pop() || ''
    // Very long filenames (40+ chars before extension) are usually product/promo images
    const namePart = filename.split('?')[0].replace(/\.[^.]+$/, '')
    return namePart.length < 60
  })
  if (neutral) return absoluteUrl(neutral.src, baseUrl)

  return null
}

// ─── Fetch strategies ─────────────────────────────────────────────────────────

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function fetchLogoHtml(slug, config) {
  const baseUrl = `https://${config.domain}`
  try {
    const html = await fetchHtml(baseUrl)
    const logo = extractLogoFromHtml(html, baseUrl)
    if (logo) return cleanUrl(logo)
  } catch (err) {
    process.stdout.write(`\n    fetch failed: ${err.message} `)
  }
  // Shopify CDN fallback — try common logo paths directly
  const cdnLogo = await tryShopifyCdnLogo(config.domain)
  if (cdnLogo) return cdnLogo
  return null
}

async function fetchLogoBrowser(slug, config) {
  const baseUrl = `https://${config.domain}`
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({ 'User-Agent': BROWSER_UA })
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Try to find the logo img by evaluating logo heuristics in the browser
    const logoUrl = await page.evaluate((baseUrl) => {
      const header = document.querySelector('header') || document.body
      const imgs = [...header.querySelectorAll('img')]

      const skipTerms = ['nav', 'banner', 'promo', 'icon-cart', 'icon-search',
                         'icon-account', '/icons/', 'badge', '_20x20', '_16x16']
      const logoTerms = ['logo', 'brand', 'wordmark', 'site-logo']

      for (const img of imgs) {
        const src = img.src || img.getAttribute('data-src') || ''
        const alt = img.alt || ''
        const cls = img.className || ''
        const combined = (src + alt + cls).toLowerCase()

        if (skipTerms.some(t => combined.includes(t))) continue
        if (logoTerms.some(t => combined.includes(t))) {
          return src || null
        }
      }
      // Last resort: first img in header that isn't tiny
      for (const img of imgs) {
        const src = img.src || ''
        if (!src || src.includes('data:')) continue
        if (img.naturalWidth && img.naturalWidth < 50) continue
        const combined = (src + (img.className || '')).toLowerCase()
        if (skipTerms.some(t => combined.includes(t))) continue
        return src
      }
      return null
    }, baseUrl)

    if (logoUrl) return cleanUrl(logoUrl)
    return null
  } catch (err) {
    console.log(`\n    browser failed: ${err.message}`)
    return null
  } finally {
    if (browser) await browser.close()
  }
}

// ─── Brand config ──────────────────────────────────────────────────────────────
const BRAND_CONFIG = {
  'holo-taco':      { domain: 'holotaco.com',                strategy: 'html' },
  'mooncat':        { domain: 'mooncat.com',                 strategy: 'html' },
  'cirque-colors':  { domain: 'cirquecolors.com',            strategy: 'html' },
  'rogue-lacquer':  { domain: 'roguelacquer.com',            strategy: 'html' },
  'pahlish':        { domain: 'pahlish.com',                 strategy: 'html' },
  'glisten-and-glow': { domain: 'www.glistenandglow.com',   strategy: 'html' },
  'ilnp':           { domain: 'www.ilnp.com',               strategy: 'html' },
  'supernatural':   { domain: 'supernaturallacquer.com',     strategy: 'html' },
  'girly-bits': { strategy: 'manual', logoUrl: 'https://cdn2.bigcommerce.com/server2900/qlqdgd7/product_images/uploaded_images/200x200.jpg' },
  'wildflower-lacquer': { domain: 'www.wildflowerlacquer.com', strategy: 'html' },
  'uno-mas-colors': { domain: 'unomascolors.com',           strategy: 'html' },
  // Logo is white PNG — site sometimes doesn't return header HTML; hardcode known URL
  'starrily': { strategy: 'manual', logoUrl: 'https://www.starrily.com/cdn/shop/files/Starrily_Logo_2023_white.png?v=1684637964' },
  'cracked': { strategy: 'manual', logoUrl: 'https://crackedpolish.com/cdn/shop/files/cracked_logo.svg?v=1722576470' },
  'bees-knees-lacquer': { domain: 'www.beeskneeslacquer.com', strategy: 'html' },
  'death-valley-nails': { domain: 'deathvalleynails.com',   strategy: 'html' },
  'fancy-gloss': { strategy: 'manual', logoUrl: 'https://fancyglosspolish.com/cdn/shop/files/fglogo_e98d5631-27ac-43e7-a1d5-6e086b4e99fa.png?v=1752514299&width=600' },
  'zoya':           { domain: 'www.zoya.com',               strategy: 'html' },

  // Cloudflare-protected
  'kbshimmer': { domain: 'www.kbshimmer.com', strategy: 'browser' },

  // Corporate — manual URLs
  'opi':         { strategy: 'manual', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/OPI_Products_logo.svg/320px-OPI_Products_logo.svg.png' },
  'essie':       { strategy: 'manual', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Essie_logo.svg/320px-Essie_logo.svg.png' },
  'sally-hansen':{ strategy: 'manual', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Sally_Hansen_logo.svg/320px-Sally_Hansen_logo.svg.png' },

  // Australia
  'emily-de-molly': { domain: 'www.emilydemolly.com', strategy: 'html' },
  'kitti-nails':    { strategy: 'manual', logoUrl: 'https://www.kittinails.com/cdn/shop/files/Transfer_sticker_3_x_3_cm_3_d9c98a83-866b-4beb-9787-20d14bdf2599.png?v=1750732079&width=600' },

  // UK
  'barry-m': { strategy: 'manual', logoUrl: 'https://cdn.shopify.com/s/files/1/1031/8757/9144/files/Barry_M_Logo_Magenta_RGB.jpg?v=1774011219' },

  // Site offline
  'different-dimension': { strategy: 'skip' },
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const { data: brands, error } = await supabase
    .from('brands')
    .select('id, slug, name, logo_url')
    .order('name')
  if (error) { console.error('DB error:', error); process.exit(1) }

  const targets = BRAND_FILTER
    ? brands.filter(b => b.slug === BRAND_FILTER)
    : brands

  if (targets.length === 0) {
    console.log('No brands matched filter.')
    return
  }

  console.log(`Processing ${targets.length} brand(s)${DRY_RUN ? ' [DRY RUN]' : ''}...\n`)

  let updated = 0, skipped = 0, failed = 0

  for (const brand of targets) {
    const config = BRAND_CONFIG[brand.slug]

    if (!config) {
      console.log(`⚪ ${brand.name} — no config, skipping`)
      skipped++
      continue
    }

    if (config.strategy === 'skip') {
      console.log(`⚫ ${brand.name} — site offline, skipping`)
      skipped++
      continue
    }

    if (brand.logo_url && !FORCE && !BRAND_FILTER) {
      console.log(`✓  ${brand.name} — already has logo`)
      skipped++
      continue
    }

    process.stdout.write(`   ${brand.name} (${config.strategy})... `)

    let logoUrl = null

    if (config.strategy === 'manual') {
      logoUrl = config.logoUrl
    } else if (config.strategy === 'html') {
      logoUrl = await fetchLogoHtml(brand.slug, config)
      await new Promise(r => setTimeout(r, 600))
    } else if (config.strategy === 'browser') {
      logoUrl = await fetchLogoBrowser(brand.slug, config)
    }

    if (!logoUrl) {
      console.log('✗ not found')
      failed++
      continue
    }

    console.log(`✓ ${logoUrl}`)

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('brands')
        .update({ logo_url: logoUrl })
        .eq('id', brand.id)

      if (updateError) {
        console.log(`  DB update error: ${updateError.message}`)
        failed++
        continue
      }
    }

    updated++
  }

  console.log(`\nDone. ${updated} updated, ${skipped} skipped, ${failed} failed.`)
  if (DRY_RUN) console.log('(dry run — no DB writes)')
}

run().catch(err => { console.error(err); process.exit(1) })
