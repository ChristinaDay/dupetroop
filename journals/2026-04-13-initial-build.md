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
1. ~~Polish submission form for community members (`/polishes/submit`)~~ ✓ done — see Session 6
2. ~~Fix `increment_dupe_count` RPC~~ ✓ done — see Session 6
3. ~~Profile edit page~~ ✓ done — see Session 6
4. ~~Supabase Storage setup (buckets + RLS + image upload UI)~~ ✓ done — see Session 6
5. ~~Vercel deployment~~ ✓ done — auto-deploys on push to main

---

## Session 6 — April 15, 2026

### What was completed

#### Lazy polish stub creation in dupe submission

When a user searches for a polish on `/dupes/submit` and gets no results, they can now create a stub inline without leaving the form. Clicking "Add '[query]' as a new polish" opens a mini form (name pre-filled, brand dropdown, finish select). On submit it calls the existing `submitPolish` action (`is_verified: false`) and auto-selects the new polish in the dupe form. Both the stub and the dupe land in the admin review queue together. A "pending review" label appears on the selected polish card so the user knows what to expect.

#### Polish submission form (`/polishes/submit`)

Full community submission form at `/polishes/submit`:
- Brand (select from DB), name, finish category, color family
- Hex color inputs (primary + secondary/duochrome) with live swatch preview
- Swatch image upload (drag-and-drop, see below)
- Price, product URL, description, limited edition flag
- "+ Submit polish" button added to the `/polishes` browse page header

#### Supabase Storage + ImageUpload component

`supabase/migrations/004_storage.sql` — creates two public buckets:
- `polish-images` — 5 MB limit, JPEG/PNG/WebP/GIF; authenticated users can upload, owners can delete their own files
- `avatars` — 2 MB limit, JPEG/PNG/WebP; users can only manage their own folder

`src/components/ui/ImageUpload.tsx` — reusable drag-and-drop upload component. Uploads immediately to Supabase Storage on file select, shows preview with remove button, validates file type and size client-side. Used by both the polish submission form and profile edit.

#### Fixed `increment_dupe_count` RPC

`supabase/migrations/005_increment_dupe_count.sql` — adds the missing Postgres function called by `approveDupe()`. Uses `SECURITY DEFINER` and an atomic `UPDATE` to avoid race conditions on `dupe_count`.

#### Profile edit page (`/profile/edit`)

- Display name, username, bio, avatar upload
- Username sanitized client-side (lowercase, alphanumeric + underscore), validated for uniqueness server-side
- Avatar upload reuses `ImageUpload` with the `avatars` bucket
- "Edit profile" button added to `/profile`

#### Vercel deployment

App auto-deploys to production on every push to `main`. Required one-time setup:
- Env vars in Vercel project settings (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`)
- Supabase Auth → URL Configuration updated with production domain and `/api/auth/callback` redirect URL

### Still to do (nice-to-haves)
- [ ] Profile page for other users (`/profile/[username]`)
- [ ] "Report" button on opinions for moderation
- [ ] Search page (polishes + dupes combined results)
- [ ] Brand management UI in admin
- [ ] Email notifications when a submitted dupe is approved/rejected
- [ ] Open Graph images for dupe comparison pages
- [ ] Admin brand sync tool (trigger full catalog import per brand)
- [ ] Girly Bits + Wildflower Lacquer brands + polishes (missing from seed entirely)
- [ ] Supernatural + Pahlish + Sally Hansen polishes (brands seeded, no polishes)

---

## Session 7 — April 16, 2026

### What was completed

#### Stash: individual polish search

Added `src/components/stash/AddPolishModal.tsx` — a search-and-add modal on `/stash` that lets users find polishes by name and add them directly to their stash without leaving the page. Complements the existing CSV import.

- Search input queries verified polishes by name (≥2 chars), shows swatch + brand + finish badge per result
- Selecting a polish calls `addToStash` immediately
- Already-added items in the session show "Added" label and disable to prevent double-taps
- If no results: links to `/polishes/submit` to submit a new polish first
- "Added this session" list at the bottom tracks what was added before closing
- Button order on stash page: **+ Add polish** | Import CSV | Export CSV

#### Product vision rethink: Polish detail page as the dupe hub

Held a design session to rethink the community contribution model. Key decisions:

**The canonical user journey that shaped this decision:**
A user wants to know all their options for getting the Bloodbender look. They search "Bloodbender" in the search bar, select it from the results, and land on its Polish detail page. Below the product info they see everything the community knows about duping it: single-bottle alternatives with accuracy ratings, and multi-polish combination recipes (e.g. House of Hades + Scorchy, or the cheaper Casa de Heaven + Scorchy) — each with ratings and notes. One page, all options, ranked by community signal.

**The core insight:** The Polish detail page is the right organizing unit for all dupe-related content — not a standalone `/dupes/submit` page. A polish like Bloodbender has two kinds of community knowledge attached to it:
1. **Polish swaps** — single-bottle alternatives rated on color/finish/formula accuracy
2. **Combination recipes** — multi-polish layering techniques that recreate the effect (e.g. House of Hades + Scorchy = Bloodbender)

Both are answers to the same question: *"how do I get this look?"* They should live together on the polish page, not split across separate flows.

**What was ruled out:**
- Inline stub creation during dupe submission (was a workaround for a sparse DB; now that the catalog is populated it creates noise)
- External links / YouTube tutorials (deferred — keep scope focused)
- A standalone "submit a dupe" page divorced from context (loses its reason to exist once submissions live on the polish page)

**What was confirmed about the schema:** The `looks` table already has `target_polish_id` — a Look can point at a specific polish as its target. The data model was already right; only the UI needed updating.

#### Polish detail page: unified "Ways to get this look" section

Replaced the two disconnected sections ("Dupes" and "Combination Recipes") with a single unified section.

- Parent heading: **"Ways to get this look"**
- **Polish swaps** subsection — same DupeCards, CTA renamed "Submit a swap", links to `/dupes/submit?a={polishId}`
- **Combination recipes** subsection — LookCards for Looks where `target_polish_id` matches; **now always visible** (previously hidden when empty), with its own empty state
- Both subsections have a short descriptor line clarifying the distinction

### Still to do (next priorities)

- [ ] Unified "suggest a combination" submission flow initiated from the polish page (currently empty state has no CTA)
- [ ] Retire `/dupes/submit` standalone page once the new contextual flow exists
- [ ] Search should return Looks in addition to polishes and brands
- [ ] Profile page for other users (`/profile/[username]`)
- [ ] "Report" button on opinions for moderation
- [ ] Brand management UI in admin
- [ ] Email notifications when a submitted dupe is approved/rejected
- [ ] Open Graph images for dupe comparison pages
- [ ] Admin brand sync tool (trigger full catalog import per brand)
- [ ] Girly Bits + Wildflower Lacquer brands + polishes (missing from seed entirely)
- [ ] Supernatural + Pahlish + Sally Hansen polishes (brands seeded, no polishes)

---

## Session 8 — April 16, 2026

### Product vision rethink: Stash as personal dashboard + Looks removal

A deep design session that reoriented several core concepts.

#### The entry point is search, not browsing

The canonical user journey starts with a specific polish in mind — the user saw something on Reddit, saved it, and comes to DupeTroop to understand their options. They search for the polish by name, land on its detail page, and the page does the work of showing them the full option space: single-bottle swaps rated by the community, and combination recipes with all component alternatives surfaced inline.

This means the `/looks` browse grid doesn't serve a real use case. A recipe only makes sense in the context of the specific polish it targets — browsing a decontextualised list of named looks is not how anyone actually uses this information.

#### Looks removed as a standalone content type

- Removed `/looks` browse page (`src/app/looks/page.tsx`)
- Removed "Looks" from nav (desktop + mobile)
- Removed "Trending Now" section from homepage
- Removed "Browse all" link from polish detail page
- `/looks/[lookId]` detail page kept temporarily — the polish detail page still links to it. Will be folded into the polish page when the recipe section is redesigned to show the full component alternatives matrix.

#### Site framing realigned around discovery

- Announcement bar, homepage hero CTAs, and bottom CTA section updated to lead with discovery and the stash feature rather than dupe submission
- "Submit a Dupe" removed from nav, dropdown, mobile menu, and footer
- Inline stub creation removed from `/dupes/submit` (was a sparse-DB workaround, no longer needed)
- Footer nav updated: Looks → Polishes → Dupes → Brands → My Stash

#### Stash becomes the personal dashboard

The stash concept was expanded significantly. Key decisions:

**"My Stash" is the personality-forward name for the user's personal dashboard.** It manages their entire relationship with polishes, not just what they own.

**Three fixed top-level states:**
- **Owned** — polishes in their collection; powers the "you can make this today" recipe cross-referencing
- **Wishlist** — purchase intent; polishes they're planning to buy
- **Bookmarked** — neutral reference; polishes they're tracking, researching, or comparing

**User-defined nested groups within each state** — fully customizable, like a digital Helmer drawer. Users organize their collection the way they would physically: by brand, finish, occasion, or any grouping that makes sense to them.

**Any polish can be added to the stash from any card**, with a state picker (Owned / Wishlist / Bookmarked) on interaction.

**The "you can make this today" logic only fires against Owned items.** Wishlisted and bookmarked polishes are reference-only.

#### What this means for the recipe/component model

The next major feature work on the polish detail page is to replace the current single-`best_dupe`-per-component display with the full alternatives matrix — so a recipe step shows all known swaps for that component, not just the cheapest one. This is the "matrix" from the original Bloodbender example: not just "House of Hades + Scorchy" but "[House of Hades / Casa de Heaven / ...] + Scorchy."

### Still to do (next priorities)

- [ ] Stash overhaul — add `status` field (owned/wishlist/bookmarked) + user-defined nested groups to `stash_items`; redesign stash page as a tabbed personal dashboard
- [ ] Bookmark/add-to-stash interaction on all cards — state picker (Owned / Wishlist / Bookmarked)
- [ ] Polish detail page: recipe section redesign — surface full component alternatives matrix, fold `/looks/[lookId]` into the page
- [ ] Profile page for other users (`/profile/[username]`)
- [ ] "Report" button on opinions for moderation
- [ ] Brand management UI in admin
- [ ] Open Graph images for polish/dupe pages

---

## Session 9 — April 16, 2026

### What was completed

#### DupeCard redesign

Replaced the floating score pill with a split swatch layout that puts both polishes side by side. Score and opinions now live in a clean text row below the images — no overlay, no clinical box.

- `aspect-2/1` split image area: Polish A left, Polish B right, both `object-cover object-top`
- Bottom row: color-coded score + "Dupe Rating" label on the left, opinion count on the right
- "No ratings yet" when `avg_overall` is null
- Score colors: emerald ≥4, amber ≥3, rose <3

#### Opinion sort: owns_both first

Community opinions on the dupe detail page now sort with `owns_both = true` opinions at the top, `helpful_votes` as tiebreaker. Reviewers who've held both bottles surface first — no mathematical weighting, just display priority.

#### Dupe detail page redesign

Complete visual overhaul. The page was ratings-centric; it's now image-centric and discovery-forward.

**New layout:**
- **Split gallery hero** (`DupePolishColumn`) — two tall portrait columns, one per polish. Product image first, community stash swatches will slot in below at equal visual hierarchy. A dashed "Share your swatch" CTA (links to `/stash`) sits under each column's images.
- **Lightweight score strip** — replaces the big bordered scorecard. Color / Finish / Formula / Overall as four centered numbers with small labels, separated by hairlines. "Based on N opinions" count below when ratings exist.
- **Opinion form** reframed as "Have you tried both?" with a casual subtitle instead of a clinical header.
- **"More dupes to explore"** grid at the bottom — related dupes that share either polish, for eternal browsing.

**New files:**
- `src/components/dupe/DupePolishColumn.tsx` — renders one side of the hero: role label, image stack, "Share your swatch" CTA, polish name/brand/badge/price below

**New query:**
- `getRelatedDupes(dupeId, polishAId, polishBId, limit)` — fetches approved dupes sharing either polish, excluding the current one, ordered by avg_overall

#### Community swatch images — design decision

Discussed pulling in product reviews from brand sites to populate ratings. Ruled out auto-importing because external reviews are about a single polish, not a dupe pair — they can't map to our three-dimensional color/finish/formula accuracy system. Decided to defer linking out to brand review pages; not worth the scraping maintenance cost.

Community swatch images will come from the stash: when a user photographs a polish in their stash, that image surfaces on dupe pages in the polish's column at the same visual hierarchy as the official product image. No separate "submit a swatch" flow on the dupe page itself.

### Still to do (next priorities)

- [ ] Polish detail page: inline rating for stash owners
- [ ] Polish detail page: recipe section redesign — surface full component alternatives matrix, fold `/looks/[lookId]` into the page
- [ ] Profile page for other users (`/profile/[username]`)
- [ ] "Report" button on opinions for moderation
- [ ] Brand management UI in admin
- [ ] Open Graph images for polish/dupe pages

---

## Session 10 — April 16, 2026

### What was completed

#### Opinion sort: owns_both first
Community opinions on the dupe detail page now sort with `owns_both = true` opinions at the top, `helpful_votes` as tiebreaker within each group.

#### Dupe detail page redesign
Complete visual overhaul — image-first, Pinterest-style split gallery.

- **`DupePolishColumn`** — each polish gets its own tall portrait column. Product image first, then a dashed "Share your swatch" CTA (links to `/stash`). Community stash photos will slot into the column at equal visual hierarchy when that feature is built.
- **Lightweight score strip** — Color / Finish / Formula / Overall as four numbers in a row, separated by hairlines. Replaces the big bordered scorecard box.
- **"Have you tried both?" → "Rate this dupe"** — collapsible opinion form (`CollapsibleOpinionForm`). Closed state shows "Rate this dupe" with empty stars; once rated shows "Your rating of this dupe" with filled stars reflecting the user's avg score. Auto-closes on submit.
- **"More dupes to explore"** — related dupe grid at the bottom for eternal browsing. Powered by new `getRelatedDupes()` query.

#### Stash overhaul — status tabs + spending stats

**Migration 007** — added `status` column to `stash_items` (`owned` / `wishlist` / `bookmarked`, default `owned`).

- Stash page redesigned as a tabbed dashboard via URL params (`?tab=owned|wishlist|bookmarked`)
- **Owned tab** — "Collection value: $X" stat (sum of `msrp_usd`; "At least $X" when some prices unknown)
- **Wishlist tab** — "To complete your wishlist: $X" savings goal in primary color
- Destashed items intentionally excluded from value calculation

**AddPolishModal** — status picker (Owned / Wishlist / Bookmarked) before searching, so items land in the right bucket immediately.

**AddToStashButton** — full status picker UX:
- Not in stash: "+ Add to stash" → expands to inline `[Owned][Destashed][Wishlist][Bookmarked]` picker
- In stash: segmented control shows current status, tap to switch; "Remove from stash" below

#### Destashed status

**Migration 009** — extended status check constraint to include `'destashed'`.

- Fourth tab on stash page with muted cards and a "Find a dupe →" CTA under each, pointing to the polish's dupe section
- Destashed items fully excluded from collection value
- Ratings from destashed polishes still contribute to community scores (you used them)
- Destashed option added to both status pickers

#### Polish ratings — stash owner ratings + external brand site ratings

**Migration 008** — two changes:
- `stash_items`: added `rating` (INTEGER 1–5) and `review_notes` (TEXT)
- New `polish_external_ratings` table: polish_id, source, source_label, rating, review_count, source_url, fetched_at

**StashPolishCard** — wraps PolishCard on the owned tab with a 5-star rating row below. Click to rate, click same star to clear, optimistic update.

**Polish detail page ratings strip** — between polish info and image gallery:
- DupeTroop owner avg (primary stars) + review count
- External brand site ratings (amber stars) with source label + review count, linking to source URL
- Strip hidden when no ratings exist

**`scripts/backfill-ratings.js`** — fetches aggregate ratings from brand product pages:
- JSON-LD structured data (`schema.org aggregateRating`) — primary strategy
- Microdata itemprop fallback (Stamped.io, native Shopify reviews)
- Stamped badge data-attribute fallback
- Supports `--dry-run` and `--brand` flags, 600ms polite delay
- **43/106 polishes populated** — Holo Taco (22/22) and Mooncat (23/24) fully covered
- Cirque Colors, Rogue Lacquer — no reviews on their sites
- OPI, ILNP — URL slug patterns don't match our DB slugs; deferred
- External review aggregation (SerpAPI etc.) ruled out — not worth the cost at this stage

### Still to do (next priorities)

- [ ] Polish detail page: inline rating for stash owners
- [ ] Polish detail page: recipe section redesign — surface full component alternatives matrix, fold `/looks/[lookId]` into the page
- [ ] Profile page for other users (`/profile/[username]`)
- [ ] "Report" button on opinions for moderation
- [ ] Brand management UI in admin
- [ ] Open Graph images for polish/dupe pages

---

## Session 11 — April 16, 2026

### What was completed

#### Three-dimension polish ratings (color / finish / formula)

Replaced the single `rating` field on stash items with three independent dimensions matching the dupe rating system.

**Migration 010** — schema changes:
- `stash_items`: dropped `rating`, added `color_rating`, `finish_rating`, `formula_rating` (INTEGER 1–5)
- `polishes`: added `avg_rating`, `avg_color_rating`, `avg_finish_rating`, `avg_formula_rating` (NUMERIC 3,2), `rating_count` (INTEGER)
- Postgres trigger `trg_update_polish_avg_rating` — fires on stash_items INSERT/UPDATE/DELETE; only counts `owned` + `destashed` items with all three dimensions filled; same denormalization pattern as `dupes.avg_overall`

**StashPolishCard** — single star row on the stash grid. Clicking a star quick-sets all three dimensions to the same value (fast overall rating). Shows decimal avg (e.g. 4.3).

**InlinePolishRating** — collapsible panel on the polish detail page for stash owners:
- Collapsed: "Rate this polish" or "Your rating" + avg stars + score
- Expanded: three independent Color / Finish / Formula rows, each saves immediately on click; click same star to clear
- Panel is `inline-block` — only as wide as its content

**Ratings strip on polish detail page** — updated to show per-dimension breakdown:
- Community overall avg + star display
- Color / Finish / Formula chips below (e.g. **4.2** Color · **3.8** Finish · **4.5** Formula)
- `getPolishRatings()` now reads from denormalized columns on `polishes` instead of aggregating stash_items at query time

#### Polish rating dropdown — content-width only

The `InlinePolishRating` collapsible was previously `w-full`, stretching edge-to-edge across the polish detail header. Changed to `inline-block` so it only takes up as much width as its content. The panel is a secondary affordance for stash owners — it shouldn't dominate the layout or feel like a form that demands attention.

#### Product page link improvements

**The problem:** External rating links in the ratings strip previously showed the bare brand name (e.g. "Holo Taco") as link text with no visual cue that it led to the product page. For brands like Cirque Colors and Rogue Lacquer that have no review data, the entire ratings strip was hidden — meaning those polishes had no discoverable path to the original product page in that area of the page (the "Shop" button at the top was the only option, and easy to miss).

**What was ruled out:** Renaming "Shop" to "Original product page" — too verbose for a button, and "Shop" is perfectly clear in context. Kept as-is.

**What was built:**
- External rating source links now read "on [Brand] ↗" consistently — the "on" prefix clarifies it's a contextual link, not just a label; the ExternalLink icon confirms it opens a new tab
- Ratings strip condition expanded: renders whenever a polish has `product_url`, even with zero ratings. Polishes without any external ratings show a standalone "on [Brand] ↗" link — no score, just the link. This ensures every polish with a known product URL has a discoverable path to the brand's page regardless of review coverage.

### Still to do (next priorities)

- [ ] Polish detail page: recipe section redesign — surface full component alternatives matrix, fold `/looks/[lookId]` into the page
- [ ] Profile page for other users (`/profile/[username]`)
- [ ] "Report" button on opinions for moderation
- [ ] Brand management UI in admin
- [ ] Open Graph images for polish/dupe pages

---

## Session 12 — April 16, 2026

### What was completed

#### Full catalog expansion (173 → 2,180 polishes)

The original seed only pulled best-sellers (20–30 per brand). Rewrote `scripts/seed-products.js` to fetch complete catalogs.

**Strategy per brand:**
- **Holo Taco, Mooncat, Cirque Colors, Rogue Lacquer** — Shopify `/collections/all/products.json` paginated with `limit=250`. Simple and complete.
- **ILNP** — WooCommerce Store API, removed the `limitPerCategory=15` cap, now fetches all pages across both categories (629 polishes).
- **Glisten & Glow** — Switched from scraping individual product HTML pages to the BigCartel `/products.json` API, which returns all 248 products in one call with images included.
- **KBShimmer** — Cloudflare-protected custom catalog. Discovered the main `/nail-polish/` page only shows a sample; the actual catalog is paginated at `/nail-polish/?p=catalog&parent=1041&pg=N&pagesize=144`. Scrapes pages sequentially with a 45s timeout per page, stops on timeout or empty page. Currently gets ~136 polishes (pages 4+ intermittently time out — Cloudflare rate limiting suspected).
- **OPI, Essie, Zoya** — Remain manually curated; their sites aren't programmatically scrapeable.

**Other changes:**
- Added `finishFromName()` helper — infers finish category from product title keywords (used for KBShimmer which doesn't expose tags in catalog view)
- Non-polish filter tightened: top coats and base coats are now **kept** (people own and dupe these); only true accessories filtered (brushes, files, refills, nail glue, etc.)
- Upsert batched in chunks of 200 to handle large catalog sizes safely
- Images: only included in upsert payload when non-null — preserves any previously backfilled images on re-seed
- Added `--brand` flag for per-brand runs

**Final catalog:**

| Brand | Before | After |
|---|---|---|
| Holo Taco | 20 | 347 |
| Mooncat | 24 | 252 |
| Cirque Colors | 15 | 366 |
| Rogue Lacquer | 8 | 176 |
| ILNP | 30 | 629 |
| Glisten & Glow | 20 | 248 |
| KBShimmer | 30 | 136 |
| Essie | 8 | 8 (manual) |
| OPI | 9 | 9 (manual) |
| Zoya | 7 | 7 (manual) |
| Different Dimension | 2 | 2 (site offline) |
| **Total** | **173** | **2,180** |

#### Image coverage

Ran `backfill-images.js` after seeding — 2,176/2,180 polishes have images (99.8%). The 4 missing are all discontinued polishes no longer listed on their brand sites (Zoya Posh, Essie Midnight Cami, Different Dimension Outerspace + Magpie). Since the seed script pulls images directly from each brand's API during upsert, the backfill script had almost nothing to do.

### Still to do (next priorities)

- [x] Polish detail page: recipe section redesign — surface full component alternatives matrix ✓ done — see Session 13
- [x] Profile page for other users (`/profile/[username]`) ✓ done — see Session 13
- [ ] "Report" button on opinions for moderation
- [ ] Brand management UI in admin
- [ ] Open Graph images for polish/dupe pages

---

## Session 13 — April 16, 2026

### What was completed

#### Combination recipes section redesign — full alternatives matrix

Replaced the previous `LookCard` grid (which only showed the recipe header and target polish) with a full `RecipeCard` component that exposes the entire ingredient matrix inline on the polish detail page.

**`src/components/look/RecipeCard.tsx`** — new component:
- `PolishRow` — a polish entry: swatch circle, brand, name, finish badge, price; links to the polish detail page
- `RecipeStep` — one step in the recipe. Shows role label (Base / Topper / Glitter Topper / Accent / Step) + optional notes, canonical polish, then all known swap alternatives indented under it with an `or` label and a left border connector
- `RecipeCard` — the full recipe card. Header: source badge + recipe name + external link icon. Body: ordered steps. Footer: description text if present.

**`src/lib/queries/looks.ts`** — new `getLooksWithComponentsForPolish()`:
- Fetches all approved looks where `target_polish_id` matches OR this polish appears as a `look_component`
- Collects all unique component polish IDs across all looks
- Single batch query for all approved dupes touching those polish IDs (avoids N+1)
- Builds `altMap: Map<string, PolishWithBrand[]>` — every polish → its known swap alternatives
- Assembles `LookWithFullComponents[]` with alternatives injected per component

**Why this approach:** The original `LookCard` showed a recipe as a black-box card — users could see "this look exists" but had to navigate to a separate page to see the ingredients. The redesign makes the matrix visible directly on the polish detail page, which is the right organizing unit. A user on the Mooncat Bloodbender page can now see "House of Hades + Scorchy, or Casa de Heaven + Scorchy" without any extra navigation.

**Polish detail page** — replaced `getLooksForPolish` + `LookCard` with `getLooksWithComponentsForPolish` + `RecipeCard` throughout. The combination recipes section is now always visible (with an appropriate empty state) regardless of whether any recipes exist.

#### Bloodbender example swap

Created the real-world swap from the product vision: **Casa de Heaven ↔ House of Hades**. This is the canonical example the entire dupe system was designed around — an indie brand dupe that the r/lacqueristas community considers *better* than the original (smoother formula, lower price). Both polishes are Mooncat; the swap demonstrates that dupes don't always mean cheaper/worse.

#### Public profile page (`/profile/[username]`)

New page at `src/app/profile/[username]/page.tsx`:
- 404 if username not found in profiles table
- **Header** — avatar (AvatarImage + AvatarFallback with initials), display name, `@username`, bio
- **Stats grid** (4 cells) — Swaps submitted / Polishes submitted / Polishes owned / Collection value. Polishes owned and collection value are computed from `stash_items` at render time (owned-status items only; value sums `msrp_usd`).
- **Wishlist teaser** — shown below stats when user has wishlist items: "* Some prices unknown · N on wishlist"
- **Submitted swaps** — up to 6 recent approved dupes rendered as `DupeCard` in a 2-column grid. "Showing 6 of N" note when there are more than 6.
- **Empty state** — shown when the user has no approved swaps; includes a link to submit one.

### Still to do (next priorities)

- [ ] "Report" button on opinions for moderation
- [ ] Brand management UI in admin
- [ ] Open Graph images for polish/dupe pages

---

## Session 14 — April 16, 2026

### What was completed

#### Homepage redesign wrap-up

Fixed a dead link in the hero: the "Browse Looks" CTA pointed to `/looks` which has no index page (only `/looks/[lookId]` detail pages exist, consistent with the Session 8 decision to remove Looks as a standalone browse surface). Changed to "Browse Dupes" → `/dupes`.

#### Stash icon button on browse cards

Added a bookmark icon overlay to PolishCard grids throughout the app so logged-in users can stash any polish without navigating to its detail page.

**New query: `getUserStashMap(userId)`** — returns `Record<polish_id, { id, status }>`, fetching only id/polish_id/status from stash_items. Lightweight enough to run on every browse page.

**New component: `src/components/stash/StashIconButton.tsx`** — a `h-7 w-7` circular button using shadcn Popover:
- Gray outline + opacity-0 when not stashed; fills primary + always visible when already stashed
- Click opens popover: "Add as…" with Owned / Wishlist / Bookmarked options
- If already stashed: "Move to…" with current status highlighted + Remove option
- `e.stopPropagation()` / `e.preventDefault()` on click so it doesn't trigger the card's Link navigation

Wired into:
- `/polishes` browse grid
- Homepage "New polishes" section
- `/brands/[brandSlug]` polish grid

All three pages now fetch the stash map server-side if a user is logged in and pass the data down, rendering the button as a wrapper div over each PolishCard (outside the Link's `overflow-hidden` context).

#### Admin brand management UI

Replaced the "manage via Supabase dashboard" placeholder at `/admin/brands` with a full CRUD flow.

**`src/lib/actions/brand.actions.ts`** — `createBrand` and `updateBrand` server actions. Both verify the caller is admin/moderator, auto-generate a slug from the name if left blank, and return a friendly error message on unique constraint violations.

**`src/components/admin/BrandForm.tsx`** — shared create/edit form: name, slug (editable, auto-generated if blank), description, website URL, logo URL with live preview, country of origin, price tier dropdown (1–5 with labels), indie + active checkboxes. Client component using `useTransition`.

**`/admin/brands`** — lists all brands including inactive (dimmed), with logo thumbnail, slug/country/price tier inline, Edit and View buttons, and a "+ Add brand" header button.

**`/admin/brands/new`** — create form page.

**`/admin/brands/[brandId]/edit`** — edit form page, pre-populated from DB.

#### Open Graph images

Added `opengraph-image.tsx` files for the two highest-value pages. Both use `next/og`'s `ImageResponse` API and load Inter 900 from Google Fonts; font fetch failure degrades gracefully to system sans-serif.

**Polish detail OG (1200×630):**
- Left panel (380px): product image over hex swatch fallback (gradient for duochrome)
- Right panel: brand name (small caps), polish name (large, font-size adaptive for long names), finish badge pill, dupe count, DupeTroop wordmark

**Dupe comparison OG (1200×630):**
- Full-bleed split screen: each polish fills one half (product image over swatch, dark gradient overlay for text legibility)
- Brand + polish name at the bottom of each half
- Floating "VS" pill at center with community score (emerald ≥4, amber ≥3, rose <3)
- DupeTroop wordmark in top-right corner

#### Data gaps — 5 brands added

**Girly Bits** (Canadian indie) and **Wildflower Lacquer** (Oklahoma indie) added to `scripts/seed.js` brands array. Supernatural's website URL corrected to `supernaturallacquer.com`.

**`scripts/seed-products.js`** updated with five new brand blocks:

| Brand | Strategy | Polishes |
|---|---|---|
| Pahlish | Shopify `/collections/all/products.json` | Full catalog |
| Supernatural | Manual curation (site blocked) | 10 |
| Girly Bits | Manual curation (site 503) | 11 |
| Wildflower Lacquer | Manual curation (API blocked) | 10 |
| Sally Hansen | Manual curation (corporate CMS) | 11 |

**Migrations 010 and 011** were run in Supabase — three-dimension polish ratings and opinion reports tables are now live.

### Still to do (nice-to-haves)

- [ ] Email notifications when a submitted dupe/polish is approved or rejected
- [ ] Admin brand sync tool — trigger per-brand catalog re-import from admin UI
- [ ] Nested stash groups (user-defined subgroups within Owned/Wishlist/Bookmarked)

---

## Session 15 — April 16, 2026

### What was completed

#### Admin dupe queue cleanup

The `suggest-dupes.js` script had been run with `--insert` previously, flooding the admin review queue at `/admin/dupes` with 60 algorithmically-generated pending dupes. All 60 were auto-suggested by the profile-mode matcher (finish category + color family grouping) and were low quality — most were broad cross-brand pairings with no real community signal.

**What was deleted:** All 60 pending dupes with `notes ILIKE '%Auto-suggested%'` were removed from the database. This included 10 pairings between Essie Midnight Cami and various Mooncat polishes (shimmer + blue grouping) which were particularly noisy.

**Root cause fix — `suggest-dupes.js`:** Added `.eq('is_discontinued', false)` to `fetchAllPolishes()` so discontinued polishes (like Midnight Cami) are excluded from future algorithmic suggestions.

**Midnight Cami marked discontinued:** Essie Midnight Cami (`slug: midnight-cami`) was also marked `is_discontinued: true` in the database. It's been off the market for years and has no product page — it shouldn't participate in dupe suggestions going forward. The one approved dupe pairing (Lincoln Park After Dark ↔ Midnight Cami) remains intact; only pending suggestions were removed.

#### AI-powered dupe suggester — `scripts/suggest-dupes-ai.js`

Built a new script that replaces algorithmic guessing with real community knowledge. Instead of grouping by finish/color profile, it uses Claude + web search to find what people are actually saying about a polish on Reddit (r/lacqueristas, r/nail_art), Temptalia, MakeupAlley, and nail polish blogs.

**How it works:**
1. Takes a polish by name (`--polish="Bloodbender"`) or sweeps a brand (`--brand=mooncat --top=10`)
2. Calls Claude Opus 4.6 with the `web_search_20260209` tool — Claude searches the web and synthesizes community discussions into structured dupe suggestions
3. Each suggestion comes back with brand, polish name, reason, and confidence level
4. Suggestions are fuzzy-matched against the DupeTroop catalog (exact → brand+name contains → name-only fallback)
5. Already-existing pairs, discontinued polishes, and unmatched suggestions are filtered out
6. Results are displayed in the terminal with match confidence and the community rationale
7. `--insert` prompts for confirmation then adds matches as pending dupes at `/admin/dupes`

**Quality difference vs algorithmic:** The algorithmic suggester pairs everything within a finish+color bucket — it can pair 50 shimmer-blue polishes with each other regardless of whether anyone has ever called them dupes. The AI suggester only surfaces pairs that the community has actually discussed, with a stated reason.

**Cost:** ~$0.01–0.05 per polish searched (Claude API usage). Run locally on demand — no automated trigger.

**Usage:**
```bash
# Search for one polish
node --env-file=.env.local scripts/suggest-dupes-ai.js --polish="Bloodbender"

# Preview without inserting
node --env-file=.env.local scripts/suggest-dupes-ai.js --polish="House of Hades" --dry-run --insert

# Insert for admin review
node --env-file=.env.local scripts/suggest-dupes-ai.js --polish="Ballet Slippers" --insert

# Sweep a brand (top 5 polishes)
node --env-file=.env.local scripts/suggest-dupes-ai.js --brand=mooncat --top=5 --insert
```

**Requires:** `ANTHROPIC_API_KEY` in `.env.local`. Install once with `npm install` (adds `@anthropic-ai/sdk` as a dev dependency).

**What was ruled out:** Adding this as a button in the admin UI (e.g. "Suggest dupes" on the polish detail page). Technically straightforward — would be a server action calling the Claude API — but deferred since the terminal script is sufficient for now and keeps the API key out of the server action path.

### Still to do (nice-to-haves)

- [ ] Email notifications when a submitted dupe/polish is approved or rejected
- [ ] Admin brand sync tool — trigger per-brand catalog re-import from admin UI
- [ ] Nested stash groups (user-defined subgroups within Owned/Wishlist/Bookmarked)
- [ ] Admin dupe creation flow (currently must use `/dupes/submit` + approve; a direct admin create would skip the queue)

---

## Session 16 — April 17, 2026

### What was completed

#### Electric yellow accent color

Added `--electric` (`oklch(0.92 0.28 100)`) and `--electric-foreground` (`oklch(0.2 0.08 100)`) as CSS custom properties in both `:root` and `.dark`, registered as `--color-electric` / `--color-electric-foreground` in `@theme inline` so they're available as Tailwind utilities (`text-electric`, `bg-electric`, etc.).

**Where it's used:**
- `Flame` icon in the "Trending Now" section header → `text-electric` (fire reads as yellow, not magenta)
- "Limited Edition" label on `TrendingPolishCard` → `text-electric` (electric/rare, replaces amber)
- Vivid finish badges — holo, multichrome, duochrome, glitter, flakies — get a yellow-tinted pill (`bg-electric/15 text-electric-foreground border-electric/30`) instead of the magenta `default` badge variant; cream/shimmer/matte/etc. stay as neutral secondary
- New `electric` Button variant: `bg-electric text-electric-foreground hover:bg-electric/85`
- Bottom homepage CTA "Create a free account" button switched from manual `bg-primary` to `variant="electric"` — pops much harder against the dark `bg-foreground` section

#### Hero gradient background

Replaced flat `bg-background` on the hero section with a `.hero-bg` CSS class defined in `@layer base`. Three-point radial gradient:
- **Top-left**: magenta/primary glow (matches brand primary)
- **Top-right**: neon yellow glow (electric accent)
- **Bottom-right**: teal/cyan counter-accent

Dark mode values are more vivid (28% / 22% / 32% opacity vs 12% / 14% / 18% in light). Uses raw `oklch()` values in the gradient rather than CSS variables since CSS variables don't interpolate inside gradient functions.

**Why `@layer base` instead of `@utility`:** Attempted `@utility hero-bg { &:is(.dark *) { ... } }` first — Tailwind v4 doesn't reliably process nested dark-mode selectors inside `@utility` blocks. Plain `.hero-bg` / `.dark .hero-bg` in `@layer base` works correctly.

#### PolishBadge — hide 'other' finish

`PolishBadge` returns `null` when `finish === 'other'`. Previously showed an uninformative "Other" pill. Added `ml-auto` to the price span in `PolishCard` so the price stays right-aligned when the badge is absent.

#### Price reframed as reference info

New `src/components/polish/PolishPrice.tsx` renders prices as `$X.XX retail` — the word "retail" in faded smaller text signals this is a reference price, not a purchase price (DupeTroop is not a shop). Replaces all direct `formatPrice()` display calls:
- `PolishCard`, `TrendingPolishCard` (card grids)
- `DupePolishColumn` (dupe detail hero)
- `RecipeCard` (recipe ingredient rows)
- Polish detail page header

`formatPrice()` itself is unchanged — still used for collection value math in stash/profile.

#### Hide empty rating info

Dupe cards and the dupe detail page score strip are now fully hidden when `avg_overall` is null (no opinions yet). Previously showed "No ratings yet" and a row of `—` dashes. The page reads cleaner with just the photos and polish info until the community weighs in.

#### Discontinued polishes filtered from homepage

Added `discontinued?: boolean` to `PolishFilters` type and a corresponding `.eq('is_discontinued', false)` filter in `getPolishes()`. The homepage "New polishes" section passes `discontinued: false` — prevents discontinued polishes (e.g. Essie Celeb City) from floating to the top of the newest sort after a re-seed.

#### Admin delete button on dupe detail page

Added an admin-only "Delete dupe" button in the breadcrumb row of every dupe detail page (`/dupes/[dupeId]`).

**`deleteDupe` server action** (`src/lib/actions/dupe.actions.ts`):
- Verifies caller is admin/moderator via regular Supabase client
- Uses `createAdminClient()` (service role key) for the actual DELETE to bypass RLS — the anon client was silently deleting 0 rows due to RLS policies
- Decrements `dupe_count` on both polishes via `decrement_dupe_count` RPC if the pair was approved
- Revalidates `/dupes` and `/admin/dupes`

**`createAdminClient()`** added to `src/lib/supabase/server.ts` — creates a Supabase client with `SUPABASE_SERVICE_ROLE_KEY`, bypassing all RLS. Pattern: always verify auth/role first with the regular client, then use the admin client only for the privileged operation.

**Migration 012** (`supabase/migrations/012_decrement_dupe_count.sql`) — atomic `GREATEST(dupe_count - 1, 0)` UPDATE, mirrors the existing `increment_dupe_count` function.

**`AdminDeleteDupeButton`** (`src/components/admin/AdminDeleteDupeButton.tsx`) — client component with a two-step confirmation (shows "Are you sure?" inline before firing). Redirects to `/dupes` on success.

#### Homepage browse sections removed

Removed the "Browse by finish" tile row and "Browse by color" dot row from the homepage. Both were shortcuts to `/polishes?finish=X` and `/polishes?color=X` — filters that already live on the `/polishes` page. Given that search is the primary entry point and the hero already has a search bar + browse buttons, these sections added noise without community signal. Also cleaned up the now-unused `FINISH_TILES`, `COLOR_FAMILIES` constants and `finishLabel` import from `page.tsx`.

#### Submit a swap — navigation and homepage

Added "Submit a swap →" in two new places:
- **Dupes dropdown** (desktop and mobile) — at the bottom of the dropdown, separated by a divider, styled in `text-primary` to distinguish it from the browse links
- **Homepage "Top-rated dupes" section header** — quiet `text-muted-foreground` text link ("Know a dupe? Submit one →") next to the "See all" button, visible to engaged scrollers without dominating the section

### Still to do (nice-to-haves)

- [ ] Email notifications when a submitted dupe/polish is approved or rejected
- [ ] Admin brand sync tool — trigger per-brand catalog re-import from admin UI
- [ ] Nested stash groups (user-defined subgroups within Owned/Wishlist/Bookmarked)

---

## Session 17 — April 17, 2026

### What was completed

#### Terminology clarification: dupe vs. swap

Resolved a naming ambiguity that had accumulated over previous sessions. The word "swap" had been used as a softer synonym for "dupe" (e.g. "Submit a swap") while the multi-polish combination concept was called "look", "recipe", or "combination recipe" inconsistently. This created confusion because the two concepts are genuinely distinct and deserve distinct names.

**The two concepts, now clearly named:**

| Term | Meaning | Example |
|---|---|---|
| **Dupe** | A single polish that closely resembles another — a one-for-one substitution, rated by the community on color, finish, and formula accuracy | Casa de Heaven ≈ House of Hades |
| **Swap** | A multi-polish combination that recreates a target look — two or more polishes layered together | House of Hades + Scorchy = Bloodbender |

**Why "dupe" for the single-polish case:** The word "dupe" is established vocabulary in the nail polish community (r/lacqueristas, Temptalia, etc.) — it always means a single-bottle alternative. Fighting that would confuse new users arriving from search.

**Why "swap" for the multi-polish case:** "Swap" implies substitution — you're swapping out the original look for a combination you can build yourself. It also avoids the confusion that "swap" previously caused in the nav ("Submit a swap" meant submitting a single-polish pair, which contradicted its new definition). Now "swap" has a clear, distinct meaning.

**What was ruled out:** Calling multi-polish combinations "looks" or "recipes". "Looks" was removed as a standalone browse surface in Session 8 and doesn't carry its weight as a noun. "Recipe" is accurate but clinical — "swap" is more aligned with how the community talks.

**Note on "swap" in nail polish communities:** In some communities "swap" refers to physically trading polishes with other people (destash swaps). This is a known tension but considered acceptable — DupeTroop's context makes the meaning clear, and it's less confusing than the previous inconsistency.

**Files updated (UI labels only — database tables and URL routes unchanged):**

- `src/app/page.tsx` — hero copy: "single-bottle swaps, layering recipes" → "single-bottle dupes, multi-polish swaps"
- `src/app/polishes/[brandSlug]/[polishSlug]/page.tsx` — "Polish swaps" section → "Dupes"; "Combination recipes" section → "Swaps"; all CTAs updated
- `src/app/dupes/submit/page.tsx` — helper text: "submit the swap" → "submit the dupe"
- `src/app/profile/[username]/page.tsx` — "Swaps submitted" stat + section → "Dupes submitted"
- `src/components/layout/Header.tsx` — nav CTA: "Submit a swap →" → "Submit a dupe →" (desktop + mobile)
- `src/app/admin/page.tsx` — dashboard card: "Pending recipes" → "Pending swaps"
- `src/app/admin/looks/page.tsx` — page header, button, empty state: "recipes" → "swaps"
- `src/app/admin/looks/new/page.tsx` — form heading: "New Combination Recipe" → "New Swap"; field label: "Recipe name" → "Swap name"
- `src/app/looks/[lookId]/page.tsx` — removed dead "Browse all recipes" → `/looks` button (the `/looks` index page was removed in Session 8 and was 404ing)

**Not changed:** Database table names (`dupes`, `looks`), URL routes (`/dupes`, `/looks/[lookId]`), internal query/action function names. These can be addressed in a future cleanup if desired.

### Still to do (nice-to-haves)

- [ ] Email notifications when a submitted dupe/polish is approved or rejected
- [ ] Admin brand sync tool — trigger per-brand catalog re-import from admin UI
- [ ] Nested stash groups (user-defined subgroups within Owned/Wishlist/Bookmarked)

---

## Session 18 — April 20, 2026

### What was completed

#### Interactive magnetic glitter hero background

Built a fully custom Canvas 2D particle system for the hero section on branch `feat/magnetic-hero-bg`. No animation libraries — pure `requestAnimationFrame` with physics, rendering, and post-processing all in TypeScript.

**New file: `src/components/hero/MagneticGlitter.tsx`**

Wired into `src/app/page.tsx`: hero section gets `relative`, `<MagneticGlitter />` is the first child (behind content), and the content container gets `relative z-10` to ensure it sits above the canvas.

##### Particle system

- **2,500 particles** scattered uniformly at init, pre-sorted by color for render locality
- Each particle: position, velocity, base radius (1–2.5px), base alpha (0.55–0.95), color from brand palette, independent shimmer phase + speed
- **Color palette** weighted toward brand hues: fuchsia/magenta (~35%), cyan/teal (~30%), white/silver (~20%), electric yellow (~15%)
- **dt-normalized physics** (`dtFactor = dt / 16.67`) — same perceived speed at 30fps and 120fps; dt capped at 50ms to suppress bursts after tab switch
- **Edge wrapping** — particles that leave canvas bounds reappear from the opposite edge

##### Physics: two-octave flow field

Particles drift via a two-octave sine-wave superposition that approximates a 2D flow field without a noise library:

```
angleRaw = FF_A * sin(x*FF_F1 + t*FF_S1) * cos(y*FF_F2 + t*FF_S2)
         + FF_B * sin(x*FF_F3 + t*FF_S3) * cos(y*FF_F4 + t*FF_S4)
angle = angleRaw * π / (FF_A + FF_B)
```

Gives organic, non-repeating curved drift. Velocity damped at 0.92/frame and capped at 3.5px/frame.

##### Physics: magnetic cursor attraction

Mouse position tracked via `window.addEventListener('mousemove', ..., { passive: true })`, mapped to canvas space via `getBoundingClientRect`. Magnetic force uses `(1 - dist/180)^1.5` falloff — gentle at the boundary, strong up close:

```
force = (1 - dist / 180)^1.5 * 0.18 * dtFactor
vx += (dx / dist) * force
```

Default mouse position `(-9999, -9999)` means force never fires on mobile — organic drift only, no special case needed.

##### Rendering: three-layer visual system

Each frame renders in two passes via an offscreen canvas:

**Pass 1 — particles to offscreen canvas:**

1. **Caustic ripple modulation** — three overlapping sine waves at different spatial frequencies and speeds create moving pools of brightness across the field, like light refracting through a shifting fluid surface. Modulates both base particle alpha and specular intensity.
   ```
   causticRaw = sin(x*0.018 + t*0.0009) * cos(y*0.016 + t*0.00075) * 0.55
              + sin((x*0.7 + y*0.9)*0.024 + t*0.0012) * 0.30
              + cos((x*0.5 - y*0.8)*0.030 + t*0.00088) * 0.15
   caustic = max(0, 0.5 + causticRaw * 0.5)
   ```

2. **Base particle** — filled circle, alpha = `baseAlpha * (0.25 + 0.75 * caustic)`. Dims in caustic shadow zones, brightens in lit zones.

3. **Directional specular highlight** — small white dot offset toward a slowly orbiting parallel light source (one rotation ~35s). Blooms hard in bright caustic zones: `alpha * specShimmer * caustic * 1.3`. All highlights point the same direction — the key visual cue for a unified reflective surface.

4. **Per-particle shimmer** — `shimmer = 0.5 + 0.5 * sin(t * 0.001 * shimmerSpeed + shimmerPhase)`. Modulates both radius and alpha independently per particle, simulating glitter catching light at different angles.

**Pass 2 — 2D lens displacement to main canvas:**

Copies offscreen → main canvas in 12×12px tiles, each tile displaced by `(dx, dy)` derived from the gradient of a height field. Gradient-of-height-field displacement naturally creates convergent and divergent zones — the physics of how a curved refractive surface bends light. Low spatial frequencies (0.010–0.014 cycles/px) keep adjacent tile displacements within ~1px of each other, eliminating visible seaming. Slow time coefficients (0.00028–0.00038) give unhurried, viscous motion.

```
dx = SCALE * (cos(tx*0.014 + ty*0.011 + t*0.00032) * cos(ty*0.013 + t*0.00028) * 0.65
            + cos((tx*0.6 + ty*0.8)*0.010 + t*0.00038) * 0.35)
dy = SCALE * (sin(...same...) * 0.65 + sin(...) * 0.35)
```

SCALE = 9px max displacement. At a ~1400×500 hero, this is ~4,900 `drawImage` calls per frame — fast enough to stay well within 60fps budget.

##### Infrastructure

- `ResizeObserver` on the hero section resizes both canvases and re-initializes particles when dimensions change
- Canvas: `pointer-events-none absolute inset-0 w-full h-full` — fully click-through
- `aria-hidden="true"` — decorative, not in accessibility tree
- Zero React state — entire animation loop runs in refs, no re-renders after mount

##### What was tried and reverted

- **Trail fade + glow halos** (`destination-out` + double-circle render): created a viscous trail effect but the glow halos looked like uniformly glowing orbs with no sense of light directionality — reverted in favor of the specular dot approach.
- **Horizontal scanline displacement only**: produced a wavy appearance but no convergence/divergence (no actual lensing) — replaced with the 2D tile grid approach.

### Still to do (nice-to-haves)

- [ ] Email notifications when a submitted dupe/polish is approved or rejected
- [ ] Admin brand sync tool — trigger per-brand catalog re-import from admin UI
- [ ] Nested stash groups (user-defined subgroups within Owned/Wishlist/Bookmarked)
- [ ] Commit + merge `feat/magnetic-hero-bg` once visual polish is complete

---

## Session 19 — April 20, 2026

### What was completed

#### Magnetic flake orientation — cursor as wand

Rewrote the particle rendering and physics in `MagneticGlitter.tsx` so the cursor behaves like a magnetic wand held over wet polish.

**The core insight:** Real magnetic polish particles are metallic platelets that *rotate* to align with the field — they don't just drift toward the magnet. That orientation change is the visual signature of the effect. The previous implementation only moved particles; this one also orients them.

**Particle rendering: circles → oriented strokes**

Each particle is now drawn as a short line segment at its `angle` rather than a filled circle. This simulates the elongated flake shape of magnetic polish particles. Stroke length grows in the cat-eye band (`catEye * 3.5` multiplier), mimicking flakes "standing up" taller when the magnet is directly overhead. A shorter white specular stroke overlays each flake, offset toward the light source.

**`angle` property + `lineAngleDiff()` helper**

Each particle carries an `angle` that updates independently from its position. The `lineAngleDiff` helper handles the π-symmetry of lines correctly — a line at 0° and 180° are identical, so rotation always takes the shortest path:

```
da = da - π * round(da / π)    // maps to [-π/2, π/2]
```

**Two-radius system**

`ALIGN_RADIUS = 280px` controls orientation; `MAGNETIC_RADIUS = 130px` controls position force. Particles visibly rotate into arching field lines *before* they start moving toward the wand tip — the pattern forms as the cursor approaches, not only when it's directly overhead. This mirrors the real experience of watching cat-eye polish respond as you bring a magnet close.

**Resting-state relaxation**

When the cursor leaves, each particle's angle slowly drifts back toward the local flow field direction rather than freezing in place. Gives the surface a "settling" quality after the wand passes.

**Constants tuned:**
- `MAGNETIC_STRENGTH`: 0.08 → 0.10
- `MAX_SPEED`: 0.7 → 1.2 (allows faster gliding along field lines)
- Removed unused constants (`MAGNETIC_POWER`, `DRAG_RADIUS`, `DRAG_STRENGTH`, `VORTEX_AMP`) — defined in previous sessions but never applied

### Still to do (nice-to-haves)

- [ ] Email notifications when a submitted dupe/polish is approved or rejected
- [ ] Admin brand sync tool — trigger per-brand catalog re-import from admin UI
- [ ] Nested stash groups (user-defined subgroups within Owned/Wishlist/Bookmarked)
- [ ] Merge `feat/magnetic-hero-bg` into main

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
│   │   ├── hero/                    ← MagneticGlitter canvas particle system
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
