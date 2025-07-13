import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { settings } from '../db/schema';
import type { Bindings } from '../types';

export interface ImageTransformations {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
}

export interface UploadResult {
  path: string;
  url: string;
}

/**
 * Upload an image to R2 bucket
 */
export async function uploadImage(
  file: File,
  folder: 'churches' | 'counties' | 'pages' | 'site',
  env: Pick<Bindings, 'IMAGES_BUCKET' | 'SITE_DOMAIN'>,
  db?: DrizzleD1Database<any>
): Promise<UploadResult> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File size must be less than 10MB');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const sanitizedName = file.name
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .toLowerCase()
    .replace(/_{2,}/g, '_');
  const path = `${folder}/${timestamp}_${sanitizedName}`;

  // Upload to R2
  const arrayBuffer = await file.arrayBuffer();
  await env.IMAGES_BUCKET.put(path, arrayBuffer, {
    httpMetadata: {
      contentType: file.type,
    },
  });

  const domain = db ? await getDomain(db, env) : env.SITE_DOMAIN || 'localhost';

  return {
    path,
    url: getImageUrl(path, domain),
  };
}

/**
 * Get domain from settings table or fallback to environment/default
 */
export async function getDomain(db: DrizzleD1Database<any>, env: Pick<Bindings, 'SITE_DOMAIN'>): Promise<string> {
  try {
    const siteDomainSetting = await db.select().from(settings).where(eq(settings.key, 'site_domain')).limit(1);

    if (siteDomainSetting.length > 0 && siteDomainSetting[0].value) {
      return siteDomainSetting[0].value;
    }
  } catch (error) {
    console.error('Failed to fetch site_domain from settings:', error);
  }

  // Fallback to environment variable or default
  return env.SITE_DOMAIN || 'localhost';
}

/**
 * Generate a Cloudflare Image Transformation URL
 * Falls back to direct R2 URL if transformations are not available
 */
export function getImageUrl(
  path: string | null | undefined,
  domain: string,
  transformations?: ImageTransformations,
  r2Domain?: string
): string {
  if (!path) return '';

  // If r2Domain is provided, use it as the source for Cloudflare Image Transformations
  if (r2Domain) {
    const sourceUrl = `https://${r2Domain}/${path}`;
    const baseUrl = `https://${domain}/cdn-cgi/image`;

    if (!transformations || Object.keys(transformations).length === 0) {
      return `${baseUrl}/format=auto/${sourceUrl}`;
    }

    const params = formatTransformations(transformations);
    return `${baseUrl}/${params}/${sourceUrl}`;
  }

  // Fallback to direct domain path (original behavior)
  const baseUrl = `https://${domain}/cdn-cgi/image`;

  if (!transformations || Object.keys(transformations).length === 0) {
    return `${baseUrl}/format=auto/${path}`;
  }

  const params = formatTransformations(transformations);
  return `${baseUrl}/${params}/${path}`;
}

/**
 * Format transformation parameters for URL
 */
function formatTransformations(transformations: ImageTransformations): string {
  const params: string[] = [];

  if (transformations.width) params.push(`width=${transformations.width}`);
  if (transformations.height) params.push(`height=${transformations.height}`);
  if (transformations.quality) params.push(`quality=${transformations.quality}`);
  if (transformations.format) params.push(`format=${transformations.format}`);
  if (transformations.fit) params.push(`fit=${transformations.fit}`);

  // Default to auto format if no format specified
  if (!transformations.format) {
    params.push('format=auto');
  }

  return params.join(',');
}

/**
 * Delete an image from R2 bucket
 */
export async function deleteImage(
  path: string | null | undefined,
  env: Pick<Bindings, 'IMAGES_BUCKET'>
): Promise<void> {
  if (!path) return;

  try {
    await env.IMAGES_BUCKET.delete(path);
  } catch (error) {
    console.error('Failed to delete image:', error);
    // Don't throw - allow operation to continue
  }
}

/**
 * Get R2 domain from environment variable only (no hardcoded fallbacks)
 * Hierarchy: Environment variable R2_IMAGE_DOMAIN
 */
function getR2DomainFromEnv(): string | undefined {
  // Check for environment variable (Workers environment or Node.js process)
  return typeof process !== 'undefined' ? process.env?.R2_IMAGE_DOMAIN : undefined;
}

/**
 * Get R2 domain with database lookup
 * Hierarchy: Database settings → Environment variable → Error
 */
export async function getR2DomainWithDb(db: DrizzleD1Database<any>): Promise<string> {
  // 1. Try database settings first
  try {
    const r2DomainSetting = await db.select().from(settings).where(eq(settings.key, 'r2_image_domain')).limit(1);
    if (r2DomainSetting.length > 0 && r2DomainSetting[0].value) {
      return r2DomainSetting[0].value;
    }
  } catch (error) {
    console.error('Failed to fetch r2_image_domain from settings:', error);
  }

  // 2. Fallback to environment variable
  const envDomain = getR2DomainFromEnv();
  if (envDomain) {
    return envDomain;
  }

  // 3. No fallback - configuration required
  throw new Error(
    'R2 image domain not configured. Set r2_image_domain in settings table or R2_IMAGE_DOMAIN environment variable.'
  );
}

/**
 * Get image URL with database lookup for R2 domain setting
 * Hierarchy: Database settings → Environment variable → Error
 */
export async function getImageUrlWithDb(
  path: string | null | undefined,
  db: DrizzleD1Database<any>,
  transformations?: ImageTransformations
): Promise<string> {
  if (!path) return '';

  const r2Domain = await getR2DomainWithDb(db);
  return `https://${r2Domain}/${path}`;
}

/**
 * Generate responsive image srcset
 */
export function generateSrcSet(
  path: string,
  domain: string,
  baseWidth: number,
  transformations?: Omit<ImageTransformations, 'width'>,
  r2Domain?: string
): string {
  const widths = [Math.round(baseWidth * 0.5), baseWidth, Math.round(baseWidth * 1.5), Math.round(baseWidth * 2)];

  return widths
    .map((width) => {
      const url = getImageUrl(path, domain, { ...transformations, width }, r2Domain);
      return `${url} ${width}w`;
    })
    .join(', ');
}
