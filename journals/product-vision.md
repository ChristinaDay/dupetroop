# DupeTroop — Product Vision & User Journey

---

## The Core Problem

This app is not primarily about saving money. It's about navigating the **matrix of options** around a look you want.

Nail polish — especially indie nail polish — is aspirational and often ephemeral. A polish sells out. A look goes viral on r/lacqueristas. You see something stunning and want it, but the path from "I want that" to "I have that on my nails" is full of friction: availability, formula complexity, what you already own, what you're willing to buy.

DupeTroop exists to collapse that friction.

---

## The Canonical Example: Bloodbender

**Mooncat Bloodbender** — a deep blue base with red magnetic flakes — is the working example that shaped this app's design. It costs ~$17–18 and sold out fast when it launched. The r/lacqueristas community reverse-engineered it.

What they discovered wasn't one answer. It was a matrix:

### Option A — Two Mooncat polishes
- **Mooncat House of Hades** (base) + **Cracked's Scorchy** (magnetic topper)

### Option B — A dupe base + same topper
- **Uno Mas Color Casa de Heaven** (dupe of House of Hades) + **Scorchy**
- Casa de Heaven is widely considered *better* than House of Hades — smoother formula, and only $12

### And it branches further
- House of Hades itself has multiple dupes, each with their own tradeoffs
- Scorchy may have dupes too
- Someone might already own a different magnetic topper that works

This is the matrix. **DupeTroop's job is to make it browsable.**

---

## Two Levels of Dupes

Dupes exist at two levels, and the app needs to handle both:

### 1. Polish-level dupes
A single polish that closely resembles another. Rated on color accuracy, finish accuracy, and formula accuracy. Example: Casa de Heaven ≈ House of Hades.

### 2. Look-level recipes (Looks)
A combination of polishes — applied in layers — that recreates a target look. Each component has a role (base, topper, accent) and an order. Example: [Casa de Heaven] + [Scorchy] = Bloodbender.

A single Look can have multiple valid recipe variations, and individual components within a recipe can have polish-level dupes of their own.

---

## The Stash — The Signed-In User Payoff

The killer feature for registered users is the **stash**: their personal nail polish collection.

Users can populate their stash two ways:
- **CSV import** — upload an export from a spreadsheet or another app
- **In-app collection builder** — browse and add polishes directly in DupeTroop
- **CSV export** — their stash is always exportable; they own their data

### What the stash unlocks

When a signed-in user browses a Look (e.g. Bloodbender), the app cross-references their stash and:

- **Flags polishes they already own** in each recipe component
- **Highlights complete recipes** — "You can make this right now"
- **Highlights one-purchase recipes** — "You're one topper away from this look"
- **Ranks recipe options** by how many components they already own

This transforms DupeTroop from a reference database into a **personal tool**. It answers: *"What can I make with what I have?"* and *"What's the smartest single purchase to unlock this look?"*

---

## The Browsing Loops

The app should support multiple entry points and rabbit-hole browsing paths:

1. **Look → Recipes → Components → Polish dupes** — Start with a look, explore how to recreate it, dive into the individual polish dupes within each recipe
2. **Polish → Dupes → Looks that use it** — Start with a polish you own or want, see what it's a dupe of, see what Looks it can be part of
3. **Stash → What can I make?** — Start from your collection, surface Looks you can fully or nearly recreate right now
4. **Browse → Trending / Featured** — Discover new looks the community is excited about

---

## What This Is Not

- Not a price comparison tool (though price is useful context)
- Not a shopping site (no affiliate links, no purchasing — just information)
- Not a replacement for r/lacqueristas — it's a structured layer on top of community knowledge that already exists there

---

## Key Design Implications

- **Looks are first-class citizens**, not an afterthought. The Look detail page — with recipe variations, component stash flags, and accuracy ratings — is arguably the most important page in the app.
- **Dupes need context.** A dupe rated 4.8 on color but 2.1 on formula is a different product decision than one rated 3.5 across the board.
- **The stash must be frictionless.** CSV import is critical. Many nail polish enthusiasts already track their collections in spreadsheets.
- **Browsing should reward curiosity.** Every dupe should link to Looks it appears in. Every Look should link to the polishes' own dupe pages.
