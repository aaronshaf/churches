import { z } from 'zod';

// Helper schemas for common validations
const optionalUrl = z.string().url('Invalid URL').optional().or(z.literal(''));
const optionalEmail = z.string().email('Invalid email').optional().or(z.literal(''));
const _optionalString = z.string().optional().or(z.literal(''));
const phoneRegex = /^(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

// Church validation schema
export const churchSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(255, 'Name too long'),
    path: z
      .string()
      .trim()
      .min(1, 'Path is required')
      .max(100, 'Path too long')
      .regex(/^[a-z0-9-]+$/, 'Path must be lowercase with hyphens only')
      .refine((val) => !val.startsWith('-') && !val.endsWith('-'), 'Path cannot start or end with hyphen'),
    status: z.enum(['Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed']).optional(),
    privateNotes: z.string().max(2000, 'Private notes too long').optional(),
    publicNotes: z.string().max(1000, 'Public notes too long').optional(),
    gatheringAddress: z.string().trim().max(500, 'Address too long').optional(),
    latitude: z.coerce.number().min(-90).max(90, 'Invalid latitude').optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180, 'Invalid longitude').optional().nullable(),
    countyId: z.coerce.number().positive('Invalid county').optional().nullable(),
    serviceTimes: z.string().max(500, 'Service times too long').optional(),
    website: optionalUrl,
    statementOfFaith: optionalUrl,
    phone: z.string().regex(phoneRegex, 'Invalid phone number format').optional().or(z.literal('')),
    email: optionalEmail,
    facebook: optionalUrl,
    instagram: optionalUrl,
    youtube: optionalUrl,
    spotify: optionalUrl,
    language: z.string().trim().min(1, 'Language is required').max(50, 'Language too long').default('English'),
  })
  .refine(
    (data) => {
      // If coordinates are provided, both must be present
      if ((data.latitude && !data.longitude) || (!data.latitude && data.longitude)) {
        return false;
      }
      return true;
    },
    {
      message: 'Both latitude and longitude must be provided together',
      path: ['coordinates'],
    }
  );

// Gathering validation schema
export const gatheringSchema = z.object({
  time: z.string().trim().min(1, 'Time is required').max(100, 'Time description too long'),
  notes: z.string().max(500, 'Notes too long').optional(),
});

// Church with gatherings validation schema
export const churchWithGatheringsSchema = z.object({
  church: churchSchema,
  gatherings: z.array(gatheringSchema).max(20, 'Too many gatherings'),
  affiliations: z
    .array(z.coerce.number().positive('Invalid affiliation ID'))
    .max(10, 'Too many affiliations')
    .optional(),
});

// Affiliation validation schema
export const affiliationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name too long'),
  path: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/, 'Path can only contain lowercase letters, numbers, and hyphens')
    .max(255, 'Path too long')
    .optional(),
  status: z.enum(['Listed', 'Unlisted', 'Heretical']).default('Listed'),
  website: optionalUrl,
  privateNotes: z.string().max(2000, 'Private notes too long').optional(),
  publicNotes: z.string().max(1000, 'Public notes too long').optional(),
});

// County validation schema
export const countySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  path: z
    .string()
    .trim()
    .min(1, 'Path is required')
    .max(50, 'Path too long')
    .regex(/^[a-z0-9-]+$/, 'Path must be lowercase with hyphens only')
    .refine((val) => !val.startsWith('-') && !val.endsWith('-'), 'Path cannot start or end with hyphen'),
  description: z.string().max(1000, 'Description too long').optional(),
  population: z.coerce.number().positive('Population must be positive').optional().nullable(),
});

// User validation schema
export const userSchema = z.object({
  email: z.string().trim().email('Invalid email').min(1, 'Email is required').max(255, 'Email too long'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long').optional(),
  userType: z.enum(['admin', 'contributor']).default('contributor'),
});

// Login validation schema
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(50, 'Username too long'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
});

// Page validation schema
// Reserved paths that pages cannot use
const RESERVED_PATHS = [
  'admin',
  'api',
  'churches',
  'counties',
  'networks',
  'map',
  'data',
  'login',
  'logout',
  'churches.json',
  'churches.yaml',
  'churches.csv',
];

export const pageSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255, 'Title too long'),
  path: z
    .string()
    .trim()
    .min(1, 'Path is required')
    .max(100, 'Path too long')
    .regex(/^[a-z0-9-]+$/, 'Path must be lowercase with hyphens only')
    .refine((val) => !val.startsWith('-') && !val.endsWith('-'), 'Path cannot start or end with hyphen')
    .refine((val) => !RESERVED_PATHS.includes(val), 'This path is reserved and cannot be used'),
  content: z.string().max(50000, 'Content too long').optional().nullable(),
});

// Password update schema
export const passwordUpdateSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128, 'Password too long'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Validation utilities
export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      errors: Record<string, string[]>;
      message: string;
    };

export function validateFormData<T>(schema: z.ZodSchema<T>, formData: Record<string, any>): ValidationResult<T> {
  const result = schema.safeParse(formData);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  const errors = result.error.flatten().fieldErrors;
  const firstError = Object.values(errors)[0]?.[0] || 'Validation failed';

  return {
    success: false,
    errors,
    message: firstError,
  };
}

// Helper to parse form body with proper type conversion
export function parseFormBody(body: Record<string, FormDataEntryValue | FormDataEntryValue[]>) {
  const parsed: Record<string, any> = {};

  for (const [key, value] of Object.entries(body)) {
    if (Array.isArray(value)) {
      parsed[key] = value.map((v) => v.toString());
    } else if (value === '') {
      parsed[key] = undefined;
    } else {
      parsed[key] = value.toString();
    }
  }

  return parsed;
}

// Helper to parse gatherings from form data
export function parseGatheringsFromForm(body: Record<string, any>) {
  const gatherings = [];
  let index = 0;

  while (body[`gatherings[${index}][time]`]) {
    const time = body[`gatherings[${index}][time]`];
    const notes = body[`gatherings[${index}][notes]`] || undefined;

    if (time) {
      gatherings.push({ time, notes });
    }
    index++;
  }

  return gatherings;
}

// Helper to parse affiliations from form data
export function parseAffiliationsFromForm(body: Record<string, any>) {
  if (!body.affiliations) return [];

  if (Array.isArray(body.affiliations)) {
    return body.affiliations.map(Number).filter((id) => !Number.isNaN(id));
  }

  const id = Number(body.affiliations);
  return Number.isNaN(id) ? [] : [id];
}

// Helper to create validation error response
export function createValidationErrorResponse(errors: Record<string, string[]>, message: string) {
  return {
    success: false,
    errors,
    message,
  };
}

// Helper to sanitize and prepare church data from form
export function prepareChurchDataFromForm(body: Record<string, any>) {
  return {
    name: body.name,
    path: body.path || undefined,
    status: body.status || undefined,
    gatheringAddress: body.gatheringAddress || undefined,
    latitude: body.latitude ? parseFloat(body.latitude) : undefined,
    longitude: body.longitude ? parseFloat(body.longitude) : undefined,
    countyId: body.countyId ? Number(body.countyId) : undefined,
    website: body.website || undefined,
    statementOfFaith: body.statementOfFaith || undefined,
    phone: body.phone || undefined,
    email: body.email || undefined,
    facebook: body.facebook || undefined,
    instagram: body.instagram || undefined,
    youtube: body.youtube || undefined,
    spotify: body.spotify || undefined,
    language: body.language || 'English',
    privateNotes: body.privateNotes || undefined,
    publicNotes: body.publicNotes || undefined,
  };
}

// Helper function to generate URL-friendly path from name
export function generateUrlPath(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}
