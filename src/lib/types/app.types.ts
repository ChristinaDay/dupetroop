import type { Database } from './database.types'

export type Tables = Database['public']['Tables']
export type Enums = Database['public']['Enums']

export type Brand = Tables['brands']['Row']
export type Collection = Tables['collections']['Row']
export type Polish = Tables['polishes']['Row']
export type Tag = Tables['tags']['Row']
export type Dupe = Tables['dupes']['Row']
export type DupeOpinion = Tables['dupe_opinions']['Row']
export type OpinionVote = Tables['opinion_votes']['Row']
export type Profile = Tables['profiles']['Row']

export type FinishCategory = Enums['finish_category']
export type ColorFamily = Enums['color_family']
export type DupeStatus = Enums['dupe_status']
export type UserRole = Enums['user_role']

// Joined types used by query functions

export type PolishWithBrand = Polish & {
  brand: Brand
  collection: Collection | null
}

export type FeaturedSourceType = 'reddit' | 'instagram' | 'tiktok' | 'admin'

export type FeaturedPolish = PolishWithBrand & {
  is_featured: boolean
  featured_rank: number | null
  featured_source_type: FeaturedSourceType | null
  featured_source_url: string | null
}

export type DupeWithPolishes = Dupe & {
  polish_a: PolishWithBrand
  polish_b: PolishWithBrand
  submitter: Pick<Profile, 'username' | 'display_name' | 'avatar_url'> | null
}

export type OpinionWithProfile = DupeOpinion & {
  profile: Pick<Profile, 'username' | 'display_name' | 'avatar_url'>
  user_vote: boolean | null  // current viewer's vote
}

export type DupeWithOpinions = DupeWithPolishes & {
  dupe_opinions: OpinionWithProfile[]
}

export type PolishWithDupes = PolishWithBrand & {
  dupes_as_a: DupeWithPolishes[]
  dupes_as_b: DupeWithPolishes[]
}

// Look (combination recipe) types
// Note: Look/LookComponent are not in database.types.ts yet (added via migration 002).
// These are manually typed until Supabase types are regenerated.

export type LookSourceType = 'reddit' | 'instagram' | 'tiktok' | 'admin'
export type LookStatus = 'pending' | 'approved' | 'rejected'
export type ComponentRole = 'base' | 'topper' | 'glitter_topper' | 'accent' | 'other'

export type Look = {
  id: string
  target_polish_id: string | null
  name: string
  description: string | null
  source_url: string | null
  source_type: LookSourceType
  is_featured: boolean
  featured_rank: number | null
  opinion_count: number
  created_by: string | null
  status: LookStatus
  created_at: string
  updated_at: string
}

export type LookComponent = {
  id: string
  look_id: string
  polish_id: string
  step_order: number
  role: ComponentRole
  notes: string | null
  // Joined fields (populated by query)
  polish: PolishWithBrand
  best_dupe: PolishWithBrand | null  // cheapest approved 1:1 dupe of this component
}

export type LookWithComponents = Look & {
  target_polish: PolishWithBrand | null
  components: LookComponent[]
}

// Stash types
// Note: stash_items is not in database.types.ts yet (added via migration 003).
// Manually typed until Supabase types are regenerated.

export type StashStatus = 'owned' | 'wishlist' | 'bookmarked' | 'destashed'

export type StashItem = {
  id: string
  user_id: string
  polish_id: string
  status: StashStatus
  color_rating: number | null
  finish_rating: number | null
  formula_rating: number | null
  review_notes: string | null
  notes: string | null
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export type ExternalRating = {
  id: string
  polish_id: string
  source: string
  source_label: string
  rating: number
  review_count: number | null
  source_url: string | null
  fetched_at: string
}

export type StashItemWithPolish = StashItem & {
  polish: PolishWithBrand
}

export type StashSummary = {
  owned: { items: StashItemWithPolish[]; value: number; unknownCount: number }
  wishlist: { items: StashItemWithPolish[]; value: number; unknownCount: number }
  bookmarked: { items: StashItemWithPolish[]; value: number; unknownCount: number }
  destashed: { items: StashItemWithPolish[]; value: number; unknownCount: number }
}

// Filter types for browse pages

export type PolishFilters = {
  brand?: string
  finish?: FinishCategory
  color?: ColorFamily
  q?: string
  sort?: 'newest' | 'most_dupes' | 'name_asc'
  page?: number
}

export type DupeFilters = {
  finish?: FinishCategory
  minScore?: number
  q?: string
  sort?: 'newest' | 'top_rated' | 'most_opinions'
  page?: number
}
