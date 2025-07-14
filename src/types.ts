// Environment bindings
export interface Bindings {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  CLOUDFLARE_ACCOUNT_HASH: string;
  IMAGES_BUCKET: R2Bucket; // R2 bucket for image storage
  SETTINGS_CACHE: KVNamespace; // KV namespace for caching settings
  // Optional environment variables
  GOOGLE_MAPS_API_KEY?: string;
  GOOGLE_SSR_KEY?: string;
  OPENROUTER_API_KEY?: string;
  ENVIRONMENT?: string;
  SITE_DOMAIN?: string; // For image transformation URLs
}

// User role types (matches auth schema)
export type UserRole = 'admin' | 'contributor' | 'user';

// Church status types (matches database schema)
export type ChurchStatus = 'Listed' | 'Ready to list' | 'Assess' | 'Needs data' | 'Unlisted' | 'Heretical' | 'Closed';

// Affiliation status types (matches database schema)
export type AffiliationStatus = 'Listed' | 'Unlisted' | 'Heretical';

// Better Auth user interface (from our database schema)
export interface BetterAuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  emailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Legacy user interface (deprecated - use BetterAuthUser instead)
export interface User {
  id: string;
  email?: string;
  username?: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
}

// Auth session interface
export interface BetterAuthSession {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// Context variables that get set by auth middleware and i18n middleware
export interface AuthVariables {
  betterUser?: BetterAuthUser;
  betterSession?: BetterAuthSession;
  betterAuth?: any; // Better-auth instance - will be typed properly later
  language?: string;
  t?: (key: string, options?: object) => string;
}

// Context variables for authenticated routes (where user is guaranteed to exist)
export interface AuthenticatedVariables {
  betterUser: BetterAuthUser;
  betterSession?: BetterAuthSession;
  betterAuth?: any; // Better-auth instance - will be typed properly later
}

// Church suggestion type
export interface ChurchSuggestion {
  id: number;
  userId: string;
  churchName: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  website?: string;
  phone?: string;
  email?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Comment type
export interface Comment {
  id: number;
  userId: string;
  churchId?: number;
  content: string;
  isPublic: boolean;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Database entity types based on Drizzle schema
export interface Church {
  id: number;
  name: string;
  path: string | null;
  status: ChurchStatus | null;
  privateNotes: string | null;
  publicNotes: string | null;
  lastUpdated: Date | null;
  gatheringAddress: string | null;
  mailingAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  countyId: number | null;
  website: string | null;
  statementOfFaith: string | null;
  phone: string | null;
  email: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  spotify: string | null;
  language: string;
  imagePath: string | null; // R2 field
  imageAlt: string | null; // R2 field
  createdAt: Date;
  updatedAt: Date;
  // Optional joined fields
  countyName?: string | null;
}

export interface County {
  id: number;
  name: string;
  path: string | null;
  description: string | null;
  population: number | null;
  imagePath: string | null; // New R2 field
  imageAlt: string | null; // New R2 field
  createdAt: Date;
  updatedAt: Date;
}

export interface Affiliation {
  id: number;
  name: string;
  path: string | null;
  status: AffiliationStatus | null;
  website: string | null;
  privateNotes: string | null;
  publicNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChurchGathering {
  id: number;
  churchId: number;
  time: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChurchAffiliation {
  churchId: number;
  affiliationId: number;
}

export interface ChurchImage {
  id: number;
  churchId: number;
  imagePath: string;
  imageAlt: string | null;
  caption: string | null;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
