import type { ZodEffects, ZodObject, ZodType } from 'zod';
import { z } from 'zod';
import type { ChurchStatus } from '../types';

// Helper schemas for common validations
const websiteBuilderPatterns = [
  /godaddy\.com\/websites\/website-builder/i,
  /wix\.com\/website\/template/i,
  /squarespace\.com\/templates/i,
  /weebly\.com\/themes/i,
  /wordpress\.com\/themes/i,
  /site123\.com/i,
  /websitebuilder\.com/i,
];

const optionalUrl: ZodType<string | undefined> = z
  .string()
  .trim()
  .url('Invalid URL')
  .refine((url) => {
    // Check if it's a website builder URL
    return !websiteBuilderPatterns.some((pattern) => pattern.test(url));
  }, 'Website builder URLs are not valid church websites')
  .optional()
  .or(z.literal(''));
const optionalEmail: ZodType<string | undefined> = z.string().email('Invalid email').optional().or(z.literal(''));
const _optionalString: ZodType<string | undefined> = z.string().optional().or(z.literal(''));
const phoneRegex = /^(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

// Church validation schema
export const churchSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(255, 'Name too long'),
    path: z
      .string()
      .trim()
      .max(100, 'Path too long')
      .regex(/^[a-z0-9-]+$/, 'Path must be lowercase with hyphens only')
      .refine((val) => !val || (!val.startsWith('-') && !val.endsWith('-')), 'Path cannot start or end with hyphen')
      .optional()
      .or(z.literal('')),
    status: z.enum(['Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed']).optional(),
    privateNotes: z.string().max(2000, 'Private notes too long').optional(),
    publicNotes: z.string().max(1000, 'Public notes too long').optional(),
    gatheringAddress: z.string().trim().max(500, 'Address too long').optional(),
    latitude: z.preprocess((val) => {
      if (val === undefined || val === '' || val === null) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    }, z.number().min(-90).max(90, 'Invalid latitude').nullable().optional()),
    longitude: z.preprocess((val) => {
      if (val === undefined || val === '' || val === null) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    }, z.number().min(-180).max(180, 'Invalid longitude').nullable().optional()),
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
      const hasLat = data.latitude !== null && data.latitude !== undefined;
      const hasLng = data.longitude !== null && data.longitude !== undefined;

      if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
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
    .max(100, 'Path too long')
    .regex(/^[a-z0-9-]*$/, 'Path must be lowercase with hyphens only')
    .refine((val) => !val || (!val.startsWith('-') && !val.endsWith('-')), 'Path cannot start or end with hyphen')
    .optional()
    .or(z.literal('')),
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

export function validateFormData<T>(schema: z.ZodSchema<T>, formData: Record<string, unknown>): ValidationResult<T> {
  const result = schema.safeParse(formData);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  const errors = result.error.flatten().fieldErrors;
  const firstErrorArray = Object.values(errors)[0] as string[] | undefined;
  const firstError = firstErrorArray?.[0] || 'Validation failed';

  return {
    success: false,
    errors: errors as Record<string, string[]>,
    message: firstError,
  };
}

// Type for form data entry values
type FormDataEntryValue = string | File;

// Helper to parse form body with proper type conversion
export function parseFormBody(
  body: Record<string, FormDataEntryValue | FormDataEntryValue[]>
): Record<string, string | string[] | undefined> {
  const parsed: Record<string, string | string[] | undefined> = {};

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
export function parseGatheringsFromForm(body: Record<string, unknown>) {
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
export function parseAffiliationsFromForm(body: Record<string, unknown>) {
  if (!body.affiliations) return [];

  // When using parseBody({ all: true }), multiple values come as an array
  if (Array.isArray(body.affiliations)) {
    return body.affiliations.map((v) => Number(v)).filter((id) => !Number.isNaN(id) && id > 0);
  }

  // Single value case
  const id = Number(body.affiliations);
  return Number.isNaN(id) || id <= 0 ? [] : [id];
}

// Helper to create validation error response
export function createValidationErrorResponse(errors: Record<string, string[]>, message: string) {
  return {
    success: false,
    errors,
    message,
  };
}

// Helper to format phone numbers from XXX-XXX-XXXX to (XXX) XXX-XXXX
export function formatPhoneNumber(phone: string | undefined): string | undefined {
  if (!phone) return undefined;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Check if it's a 10-digit phone number
  if (digits.length === 10) {
    // Format as (XXX) XXX-XXXX
    return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
  }

  // Return original if not a 10-digit number
  return phone;
}

// Helper to generate URL path from church name
export function generateUrlPath(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      // Replace spaces, underscores, and multiple hyphens with single hyphen
      .replace(/[\s_]+/g, '-')
      // Remove special characters except hyphens
      .replace(/[^a-z0-9-]/g, '')
      // Replace multiple consecutive hyphens with single hyphen
      .replace(/-+/g, '-')
      // Remove leading and trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Limit length
      .substring(0, 100)
  );
}

// Helper to sanitize and prepare church data from form
export function prepareChurchDataFromForm(body: Record<string, unknown>) {
  const name = body.name as string;
  const providedPath = body.path as string;

  // Generate path if not provided
  const path = providedPath?.trim() || generateUrlPath(name);

  return {
    name,
    path: path || undefined,
    status: (body.status as ChurchStatus) || undefined,
    gatheringAddress: (body.gatheringAddress as string) || undefined,
    latitude: body.latitude !== null && body.latitude !== undefined ? parseFloat(body.latitude as string) : null,
    longitude: body.longitude !== null && body.longitude !== undefined ? parseFloat(body.longitude as string) : null,
    countyId: body.countyId ? Number(body.countyId) : undefined,
    website: (body.website as string) || undefined,
    statementOfFaith: (body.statementOfFaith as string) || undefined,
    phone: formatPhoneNumber(body.phone as string) || undefined,
    email: (body.email as string) || undefined,
    facebook: (body.facebook as string) || undefined,
    instagram: (body.instagram as string) || undefined,
    youtube: (body.youtube as string) || undefined,
    spotify: (body.spotify as string) || undefined,
    language: (body.language as string) || 'English',
    privateNotes: (body.privateNotes as string) || undefined,
    publicNotes: (body.publicNotes as string) || undefined,
    lastUpdated: new Date(),
  };
}
