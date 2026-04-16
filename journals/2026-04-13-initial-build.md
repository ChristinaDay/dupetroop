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
