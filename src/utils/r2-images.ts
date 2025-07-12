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

  const domain = db ? await getDomain(db, env) : env.SITE_DOMAIN || 'utahchurches.org';

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
  return env.SITE_DOMAIN || 'utahchurches.org';
}

/**
 * Generate a Cloudflare Image Transformation URL
 * Falls back to direct R2 URL if transformations are not available
 */
export function getImageUrl(
  path: string | null | undefined,
  domain: string,
  transformations?: ImageTransformations
): string {
  if (!path) return '';

  // Use custom R2 domain for direct image access
  // TODO: Configure Cloudflare Image Transformations to work with R2 bucket
  const r2Domain = getR2Domain(domain);
  return `https://${r2Domain}/${path}`;

  // Original transformation code (commented out until configured):
  // const baseUrl = `https://${domain}/cdn-cgi/image`;
  //
  // if (!transformations || Object.keys(transformations).length === 0) {
  //   return `${baseUrl}/format=auto/${path}`;
  // }
  //
  // const params = formatTransformations(transformations);
  // return `${baseUrl}/${params}/${path}`;
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
 * Get R2 domain based on the site domain
 * Can be overridden by R2_IMAGE_DOMAIN environment variable
 */
function getR2Domain(siteDomain: string): string {
  // Check for environment variable override first
  // This allows different deployments to use different R2 domains
  const envR2Domain = typeof process !== 'undefined' ? process.env?.R2_IMAGE_DOMAIN : undefined;
  if (envR2Domain) {
    return envR2Domain;
  }

  // Map site domains to their corresponding R2 image domains
  const domainMap: Record<string, string> = {
    'utahchurches.com': 'images.utahchurches.com',
    'utahchurches.org': 'images.utahchurches.com', // Same R2 bucket
    'localhost:8787': 'images.utahchurches.com', // Use prod images in dev
  };

  return domainMap[siteDomain] || 'images.utahchurches.com'; // Default fallback
}

/**
 * Generate responsive image srcset
 */
export function generateSrcSet(
  path: string,
  domain: string,
  baseWidth: number,
  transformations?: Omit<ImageTransformations, 'width'>
): string {
  const widths = [Math.round(baseWidth * 0.5), baseWidth, Math.round(baseWidth * 1.5), Math.round(baseWidth * 2)];

  return widths
    .map((width) => {
      const url = getImageUrl(path, domain, { ...transformations, width });
      return `${url} ${width}w`;
    })
    .join(', ');
}
