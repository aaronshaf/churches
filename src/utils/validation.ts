import { z } from 'zod';

// Church validation schema
export const churchSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  path: z.string().min(1, 'Path is required').regex(/^[a-z0-9-]+$/, 'Path must be lowercase with hyphens only'),
  status: z.enum(['Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed']).optional(),
  privateNotes: z.string().optional(),
  publicNotes: z.string().optional(),
  gatheringAddress: z.string().optional(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  countyId: z.coerce.number().optional().nullable(),
  serviceTimes: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  statementOfFaith: z.string().url('Invalid URL').optional().or(z.literal('')),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  facebook: z.string().url('Invalid URL').optional().or(z.literal('')),
  instagram: z.string().url('Invalid URL').optional().or(z.literal('')),
  youtube: z.string().url('Invalid URL').optional().or(z.literal('')),
  spotify: z.string().url('Invalid URL').optional().or(z.literal('')),
  language: z.string().min(1, 'Language is required').default('English'),
});

// Gathering validation schema
export const gatheringSchema = z.object({
  time: z.string().min(1, 'Time is required'),
  notes: z.string().optional(),
});

// Church with gatherings validation schema
export const churchWithGatheringsSchema = z.object({
  church: churchSchema,
  gatherings: z.array(gatheringSchema),
  affiliations: z.array(z.coerce.number()).optional(),
});

// Affiliation validation schema
export const affiliationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['Listed', 'Unlisted', 'Heretical']).default('Listed'),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  privateNotes: z.string().optional(),
  publicNotes: z.string().optional(),
});

// County validation schema
export const countySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  path: z.string().min(1, 'Path is required').regex(/^[a-z0-9-]+$/, 'Path must be lowercase with hyphens only'),
  description: z.string().optional(),
  population: z.coerce.number().optional().nullable(),
});

// User validation schema
export const userSchema = z.object({
  email: z.string().email('Invalid email').min(1, 'Email is required'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  userType: z.enum(['admin', 'contributor']).default('contributor'),
});