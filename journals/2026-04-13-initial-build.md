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
1. Run migrations in Supabase SQL Editor (001 + 002)
2. Seed data — brands + polishes to make the app browsable
3. Polish submission form for community members (`/polishes/submit`)
4. Fix `increment_dupe_count` RPC (see item 6 below)
5. Profile edit page
6. Supabase Storage setup (buckets + RLS + image upload UI)
7. Vercel deployment

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
