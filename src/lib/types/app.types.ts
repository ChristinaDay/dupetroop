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
