# DupeTroop — Build Journal
**Date:** April 13, 2026

---

## What We Built

DupeTroop is a community-driven nail polish dupe tracker. Users can find, submit, and rate "dupes" — pairs of polishes that look similar — and rate how accurate those dupes actually are across three dimensions: color, finish, and formula.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14+ (App Router, TypeScript) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| File storage | Supabase Storage (for swatch images) |
| Hosting | Vercel |

**Design aesthetic:** Bold & editorial — vivid fuchsia/magenta primary accent, high contrast, strong typography.

---

## Database Schema

Located at `supabase/migrations/001_initial_schema.sql`. Run the full contents of this file in the Supabase SQL Editor to set up the database.

### Tables
- **brands** — Indie nail polish brands (name, slug, website, price tier 1–5, indie flag)
- **collections** — Brand product lines / limited edition collections
- **polishes** — Individual polishes (hex color, finish category, images array, msrp, discontinued flag, etc.)
- **tags** + **polish_tags** — Flexible tagging: vegan, cruelty-free, limited edition, etc.
- **dupes** — A pair of polishes (polish_a = original, polish_b = dupe). A unique index on `LEAST/GREATEST` of the two IDs prevents duplicate pairs from being submitted.
- **dupe_opinions** — One opinion per user per dupe. Rates color accuracy, finish accuracy, and formula accuracy on a 1–5 scale, with freeform notes per dimension and an "I own both" credibility flag.
- **opinion_votes** — Helpful/not helpful votes on individual opinions.
- **profiles** — Extends Supabase `auth.users`. Includes username, display name, role (user / moderator / admin).

### Key design decisions
- Aggregate scores (`avg_color_accuracy`, `avg_finish_accuracy`, `avg_formula_accuracy`, `avg_overall`) are stored directly on the `dupes` table and kept in sync by a Postgres trigger that fires whenever `dupe_opinions` is inserted, updated, or deleted — so score reads are fast and don't require a JOIN + AVG at query time.
- A second trigger keeps `helpful_votes` counts on `dupe_opinions` denormalized for the same reason.
- A trigger on `auth.users` auto-creates a `profiles` row when a new user signs up.
- Full RLS (Row Level Security) is enabled on every table. Public content is readable by anyone; submissions require auth; admin actions require the `admin` or `moderator` role.

### Finish categories (enum)
cream, shimmer, glitter, flakies, duochrome, multichrome, holo, magnetic, jelly, tinted, matte, satin, topper, other

---

## Pages & Routes Built

| Route | Description |
|---|---|
| `/` | Home — hero, browse-by-finish tiles, top-rated dupes, recently added dupes, new polishes, CTA |
| `/polishes` | Browse all polishes — filterable by brand, finish, color family, search query, sort |
| `/polishes/[brandSlug]/[polishSlug]` | Polish detail — swatch, info, image gallery, list of all its dupes |
| `/dupes` | Browse all approved dupes — sort by newest / top-rated / most opinions |
| `/dupes/[dupeId]` | **Dupe comparison page** — side-by-side swatches, accuracy scorebars, opinion form, community opinions list with helpful voting |
| `/dupes/submit` | 3-step dupe submission — autocomplete search for each polish, duplicate pair detection, notes |
| `/brands` | All brands directory |
| `/brands/[brandSlug]` | Brand detail — logo, description, full polish grid |
| `/login` | Email/password login |
| `/signup` | Account creation (sends confirmation email) |
| `/profile` | Own profile — stats, sign out |
| `/admin` | Dashboard — pending counts |
| `/admin/dupes` | Review queue — approve or reject pending dupe submissions |
| `/admin/polishes` | Review queue — approve or delete pending polish submissions |
| `/admin/brands` | Brand list (full CRUD via Supabase dashboard for now) |
| `/api/auth/callback` | Supabase auth redirect handler |

---

## Key Components

- **PolishCard** — Grid card with swatch circle, brand, name, finish badge, dupe count
- **PolishSwatch** — Color circle rendered from hex (supports duochrome gradient), falls back to swatch image
- **DupeCard** — Both polishes side-by-side at small scale, overall accuracy score pill, three scorebars
- **AccuracyScorebar** — Labeled horizontal bar (red → amber → green) showing a 1–5 score as a percentage fill
- **StarRating** — Interactive 1–5 star input with hover state
- **OpinionForm** — Three `StarRating` + `Textarea` pairs (color / finish / formula), "I own both" checkbox, upsert on submit
- **OpinionCard** — Community opinion with per-dimension scores, notes, and helpful vote buttons
- **AdminDupeActions** / **AdminPolishActions** — Approve/reject controls with confirmation flow

---

## What Still Needs To Be Done

### 1. Connect to Supabase (blocker — do this first)
- [x] Create a project at [supabase.com](https://supabase.com)
- [ ] Run `supabase/migrations/001_initial_schema.sql` in the SQL Editor (copy the file contents, paste, run)
- [x] Copy `.env.example` → `.env.local` and fill in:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- [ ] Regenerate TypeScript types: `npx supabase gen types typescript --project-id YOUR_ID > src/lib/types/database.types.ts`

### 2. Supabase Storage
- [ ] Create a `polish-images` bucket (public)
- [ ] Create an `avatars` bucket (public)
- [ ] Add storage RLS policies (authenticated users can upload to `polish-images`, users can only manage their own `avatars`)
- [ ] Build the image upload flow in the polish submission form (upload to Storage, save path to `polishes.images[]`)

### 3. Auth configuration
- [x] Auth callback URL corrected (`/api/auth/callback`)
- [x] User creation trigger hardened
- [x] RLS policy fixed to prevent self-role-elevation
- [ ] In Supabase dashboard → Authentication → URL Configuration:
  - Set Site URL to `http://localhost:3000` (dev) or your Vercel URL (prod)
  - Add redirect URLs: `http://localhost:3000/api/auth/callback` and `https://your-domain.vercel.app/api/auth/callback`
- [ ] Optionally enable Google OAuth under Authentication → Providers

### 4. Polish submission form (community)
- The admin can approve/reject polishes but there's no UI yet for community members to submit a new polish. Need to build:
  - A `/polishes/submit` page with a form (brand selector, name, finish, hex color picker, price, etc.)
  - Hook it into the existing `submitPolish` server action

### 5. Profile edit page
- [ ] Allow users to update display name, username, bio, avatar

### 6. `increment_dupe_count` database function
- The `approveDupe` action calls `supabase.rpc('increment_dupe_count', ...)` which doesn't exist yet in the schema. Either:
  - Add a SQL function to Supabase: `CREATE FUNCTION increment_dupe_count(polish_id uuid) ...`
  - Or replace the RPC call with a direct UPDATE in the action

### 7. Vercel deployment
- [ ] Push repo to GitHub (done — `https://github.com/ChristinaDay/dupetroop`)
- [ ] Import project in Vercel
- [ ] Add all env vars in Vercel project settings
- [ ] Update Supabase Auth redirect URLs to include the Vercel production domain
- [ ] Deploy

### 8. Seed data — popular indie brands
Add the brands you want to track from day one. Some popular ones to consider seeding:
- Holo Taco
- KBShimmer
- Mooncat
- Cirque Colors
- Different Dimension
- ILNP
- Glisten & Glow
- Rogue Lacquer
- Supernatural
- Pahlish
- Girly Bits
- Wildflower Lacquer

### 9. Nice-to-haves (later)
- [ ] Profile page for other users (`/profile/[username]`)
- [ ] Polish detail image upload (drag-and-drop to Supabase Storage)
- [ ] "Report" button on opinions for moderation
- [ ] Search page (polishes + dupes combined results)
- [ ] Brand management UI in admin (instead of directing to Supabase dashboard)
- [ ] Email notifications when a submitted dupe is approved/rejected
- [ ] Open Graph images for dupe comparison pages (shareable cards)

---

---

## Session 2 — April 14, 2026

### What was completed since Session 1
- [x] **Looks** — combination recipe feature built (`002_looks_and_trending.sql`, `/looks/[lookId]` route, look.actions with shared slugify utility)
- [x] **Trending Now** section on homepage
- [x] **Announcement bar** + dropdown navigation
- [x] **Light/dark mode toggle** (FOUC-safe)
- [x] **Search modal** with polish and brand results
- [x] **Next.js 16 compatibility** — middleware renamed to proxy
- [x] **Journal wired into CLAUDE.md** so it loads automatically every session

### Still to do (updated priority order)
1. ~~Run migrations in Supabase SQL Editor (001 + 002)~~ ✓ done
2. ~~Seed data~~ ✓ done (scripts/seed.js — 14 brands, 37 polishes, 11 dupes)
3. ~~Stash feature~~ ✓ done (migration 003, /stash page, AddToStashButton, CSV import/export, Look stash awareness)
4. ~~Nav redesign~~ ✓ done — see Session 3
5. ~~Image backfill~~ ✓ done — see Session 3
6. Polish submission form for community members (`/polishes/submit`)
7. Fix `increment_dupe_count` RPC (see item 6 below)
8. Profile edit page
9. Supabase Storage setup (buckets + RLS + image upload UI)
10. Vercel deployment

---

## Session 3 — April 15, 2026

### What was completed

#### Nav redesign
Restructured `Header.tsx` around the Looks-first user journey:
- **Looks** promoted to first nav item with a book icon
- **Brands** folded into the Polishes dropdown footer row ("Browse brands →")
- **Dupes dropdown** simplified — "Combination Recipes" removed since Looks is now top-level
- **My Stash** surfaces inline in the nav bar for logged-in users; removed from the user dropdown
- Polishes active state now also triggers on `/brands/*` routes
- Mobile menu updated to match: Looks first, Brands under Polishes, My Stash styled in primary color

#### Image backfill
Investigated and built a two-stage solution:

**Why the original plan didn't work:**
- The Makeup API only returns product collections, not individual shades — useless for matching "Bordeaux" or "Lincoln Park After Dark"
- Many indie brand Shopify stores block the public `.json` API (Cloudflare 403), have taken their sites offline (Different Dimension, Glisten & Glow), or lock the Shopify API (ILNP)
- The original seed polishes were mostly placeholder names and don't exist in any real store catalog

**What was built — `scripts/backfill-images.js`:**
- Uses Shopify `/products/{handle}.json` for brands with open APIs
- Falls back to HTML `og:image` scraping for all others
- `--dry-run` and `--brand` flags for safe testing
- `HANDLE_OVERRIDES` map for slug mismatches (e.g. our `supernova` → Mooncat's `im-a-mf-supernova`)
- Currently writes images for 4 confirmed polishes; picks up more automatically as real slugs are added

**What was built — `scripts/seed-products.js`:**
- Fetches Holo Taco and Mooncat best-sellers live from their Shopify APIs (images included)
- Manually curates well-known polishes for KBShimmer, ILNP, Cirque Colors, Glisten & Glow, Rogue Lacquer, OPI, Essie, Zoya
- Parses Shopify `finish:*` and `color:*` tags to auto-populate `finish_category`, `color_family`, `hex_color`
- **95 real polishes** upserted; **43 with real product images** (all Holo Taco + Mooncat)
- Replaces the placeholder seed data with real brand catalog entries

### Still to do (updated priority order)
1. Polish submission form for community members (`/polishes/submit`)
2. Fix `increment_dupe_count` RPC
3. Profile edit page
4. Supabase Storage setup (buckets + RLS + image upload UI) — needed for community-uploaded swatches
5. Vercel deployment
6. Open PR for `feat/image-backfill` branch and merge

---

## Session 4 — April 15, 2026

### What was completed

#### Image backfill — major expansion

Pushed further on images after Session 3 left ~43 polishes with images. Fully investigated each brand's URL structure and rewrote `scripts/backfill-images.js` and `scripts/seed-products.js`.

**Findings per brand:**
- **OPI** — confirmed Shopify store; product pages live at `/products/nail-lacquer-{slug}` and return `og:image`. Collections API blocked but individual HTML works fine.
- **Cirque Colors** — Shopify API wide open via `/collections/all/products.json`. Placeholder polish names ("Duchess", "Retrograde", etc.) simply didn't exist in their catalog — old seed data was invented. Fixed by live-fetching.
- **Rogue Lacquer** — same situation, same fix. Best-sellers collection is open.
- **KBShimmer** — Cloudflare 403 on all requests, including homepage. Completely blocked.
- **ILNP** — custom SPA (Vue/Inertia.js + WooCommerce). Product URLs are long descriptive slugs (e.g. `/eclipse-black-to-red-ultra-chrome-nail-polish/`) — not guessable from short names. REST API returns 401. Blocked.
- **Glisten & Glow** — domain returns 404, site appears taken down.
- **Different Dimension** — returns a holding page with no `og:image`.
- **Zoya** — Magento platform, no collections API, all paths 404.
- **Essie** — product URLs follow `/nail-polish/{color-category}/{slug}` (e.g. `/nail-polish/pinks/ballet-slippers`). Category segment varies per shade and isn't derivable from our data without a lookup table.

**Changes made:**

`scripts/backfill-images.js` rewritten with three strategies:
- `shopify-bulk` — fetches entire catalog via `/collections/{collection}/products.json` (paginated), builds normalized name→image map, matches DB polishes by name. Sidesteps slug-guessing entirely. Used for Holo Taco, Mooncat, Cirque, Rogue.
- `shopify-json` — per-product `/products/{handle}.json` fallback.
- `html` — og:image scraping from product page HTML. Now also checks `twitter:image`. Supports `productPaths[]` array tried in order, plus `handlePrefix` for brands like OPI that prepend a type to the slug.
- `product_url` field in DB is tried first for any polish that has one stored.

`scripts/seed-products.js` updated:
- Cirque Colors and Rogue Lacquer moved from manual entries to live Shopify fetches.
- Cirque uses `/collections/all` (their `nail-polish` collection is empty).
- Rogue uses `/collections/best-sellers`.

**DB cleanup:**
- Deleted 17 placeholder polishes with no real-world counterpart (Peacock, Blue Moon, Candy Cane, Mermaid Toast, Selkie, Void, Duchess, Retrograde, Crystallize, Forest Bathing, Ultraviolet, Verdant, Galaxy Brain, Shift Happens, The Blues, Burn It Down, Night Howler).
- Deleted 5 seed dupes that referenced those placeholders.

**Final image coverage: 76/111 polishes (68%)**

| Brand | Coverage |
|---|---|
| Holo Taco | 20/20 ✓ |
| Mooncat | 24/24 ✓ |
| Cirque Colors | 15/15 ✓ |
| Rogue Lacquer | 8/8 ✓ |
| OPI | 9/9 ✓ |
| KBShimmer | 0/7 (Cloudflare blocked) |
| ILNP | 0/7 (SPA, locked API) |
| Essie | 0/8 (category-keyed URLs) |
| Zoya | 0/7 (Magento, no API) |
| Glisten & Glow | 0/4 (site down) |
| Different Dimension | 0/2 (holding page) |

### Still to do (updated priority order)
1. Polish submission form for community members (`/polishes/submit`)
2. Fix `increment_dupe_count` RPC
3. Profile edit page
4. Supabase Storage setup (buckets + RLS + image upload UI)
5. Vercel deployment
6. ~~Open PR for `feat/image-backfill` branch and merge~~ ✓ done — see Session 5

---

## Session 5 — April 15, 2026

### What was completed

#### Image backfill — full coverage push (98%)

Solved the remaining 5 blocked brands by investigating each platform's actual data access patterns:

**KBShimmer** — Playwright headless Chromium bypasses Cloudflare's JS challenge. Scraped `/nail-polish/` catalog page using `.catalog-product` selectors. Key fix: product image `src` attributes are relative paths — absolutized to `https://www.kbshimmer.com/{src}`. Old DB slugs were discontinued products; replaced with live catalog fetch in `seed-products.js`.

**ILNP** — WooCommerce Store API (`/wp-json/wc/store/v1/products`) is public when called with a browser User-Agent. Fetched across two product categories (`boutique-effect-nail-polish`, `studio-color-nail-polish`) with pagination. No Playwright needed.

**Essie** — Sitecore CMS renders pages client-side (JS-required). Solution: parsed their public sitemap (`a82962.sitemaphosting.com/3956201/sitemap.xml`) to build a slug→URL map (covering both `/nail-polish` and `/nail-care` sections), then used Playwright to render each product page and extract the product image by alt-text match.

**Zoya** — Products live on `artofbeauty.com` (Magento). Parsed `zoya.com/sitemap_zoya.xml` (percent-encoded URLs, ZP code prefix stripped), then plain-fetched `og:image` from each artofbeauty product page — no JS rendering needed.

**Glisten & Glow** — Site came back up on `www.glistenandglow.com` (BigCartel platform). Homepage lists all products; `og:image` accessible in raw HTML. Fixed domain in config from bare `glistenandglow.com` (which 404s) to `www.glistenandglow.com`.

**Different Dimension** — Confirmed dead end. Site is a holding page; only `/lander` in their sitemap. No product pages exist.

**Bug fix — `manual()` image overwrite:** The `manual()` helper in `seed-products.js` included `images: []` in its defaults, which caused Supabase upsert to overwrite backfilled image arrays with empty arrays on re-seed. Fixed by removing `images` from the default payload entirely — omitting a field on upsert conflict preserves the existing DB value.

**New strategies added to `backfill-images.js`:**
- `woocommerce-api` — paginated WooCommerce Store API with browser UA
- `browser` — Playwright catalog scrape with configurable CSS selectors
- `essie` — sitemap parse + browser product page image extraction
- `zoya` — sitemap parse + plain og:image fetch from artofbeauty.com

**New fetchers added to `seed-products.js`:**
- `fetchKBShimmerCatalog()` — Playwright browser scrape
- `fetchILNPProducts()` — WooCommerce Store API
- `fetchGlistenAndGlow()` — BigCartel homepage scrape

**Final image coverage: 169/173 polishes (98%)**

| Brand | Coverage |
|---|---|
| Holo Taco | 20/20 ✓ |
| Mooncat | 24/24 ✓ |
| Cirque Colors | 15/15 ✓ |
| Rogue Lacquer | 8/8 ✓ |
| OPI | 9/9 ✓ |
| KBShimmer | 7/7 ✓ |
| ILNP | 7/7 ✓ |
| Essie | 8/8 ✓ |
| Zoya | 7/7 ✓ |
| Glisten & Glow | 4/4 ✓ |
| Different Dimension | 0/2 (holding page — no products online) |

### Still to do (updated priority order)
1. Polish submission form for community members (`/polishes/submit`)
2. Fix `increment_dupe_count` RPC
3. Profile edit page
4. Supabase Storage setup (buckets + RLS + image upload UI)
5. Vercel deployment

---

## How to Run Locally

```bash
# 1. Install deps (already done)
npm install

# 2. Set up env vars
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Start dev server
npm run dev
# → http://localhost:3000
```

---

## File Structure Reference

```
DupeTroop/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   ← run this in Supabase SQL Editor
├── src/
│   ├── app/                         ← Next.js App Router pages
│   ├── components/
│   │   ├── admin/
│   │   ├── dupe/
│   │   ├── layout/
│   │   ├── opinion/
│   │   ├── polish/
│   │   └── ui/                      ← shadcn/ui components
│   ├── lib/
│   │   ├── actions/                 ← server actions (mutations)
│   │   ├── queries/                 ← data fetching functions
│   │   ├── supabase/                ← client/server Supabase instances
│   │   ├── types/                   ← database.types.ts + app.types.ts
│   │   └── utils/                   ← color, slugify, format helpers
│   └── middleware.ts                ← session refresh + route protection
├── .env.example                     ← copy to .env.local and fill in
└── journals/
    └── 2026-04-13-initial-build.md  ← this file
```
