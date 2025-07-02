// Environment bindings
export interface Bindings {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  GOOGLE_MAPS_API_KEY: string;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  ENABLE_CLERK?: string;
}

// User role types
export type UserRole = 'admin' | 'contributor';

// User type for context
export interface User {
  id: string;
  email?: string;
  username?: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
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