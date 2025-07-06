// Environment bindings
export interface Bindings {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  CLOUDFLARE_ACCOUNT_HASH: string;
  // Optional environment variables
  GOOGLE_MAPS_API_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_IMAGES_API_TOKEN?: string;
  OPENROUTER_API_KEY?: string;
}

// User role types (matches auth schema)
export type UserRole = 'admin' | 'contributor' | 'user';

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

// Context variables that get set by auth middleware
export interface AuthVariables {
  betterUser?: BetterAuthUser;
  betterSession?: BetterAuthSession;
  betterAuth?: any; // Better-auth instance - will be typed properly later
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
