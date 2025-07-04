import { validateCloudflareImageEnvVars } from './env-validation';

export interface CloudflareImageUploadResponse {
  success: boolean;
  result?: {
    id: string;
    filename: string;
    uploaded: string;
    requireSignedURLs: boolean;
    variants: string[];
  };
  errors?: Array<{
    code: number;
    message: string;
  }>;
}

export async function uploadToCloudflareImages(
  file: File,
  accountId: string,
  apiToken: string,
  appPrefix: string
): Promise<CloudflareImageUploadResponse> {
  // Validate that we have the required environment variables
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Images configuration is missing. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_IMAGES_API_TOKEN environment variables.');
  }
  
  // Generate a prefixed image ID
  const timestamp = Date.now();
  const randomId = crypto.randomUUID().split('-')[0]; // Use first part of UUID for brevity
  const imageId = `${appPrefix}-${timestamp}-${randomId}`;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('id', imageId);

  // Add metadata including app name
  formData.append(
    'metadata',
    JSON.stringify({
      app: appPrefix,
      uploadedAt: new Date().toISOString(),
      originalFilename: file.name,
    })
  );

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
    body: formData,
  });

  return response.json();
}

export async function deleteFromCloudflareImages(
  imageId: string,
  accountId: string,
  apiToken: string
): Promise<{ success: boolean }> {
  // Validate that we have the required environment variables
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Images configuration is missing. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_IMAGES_API_TOKEN environment variables.');
  }
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });

  return response.json();
}

// Common image variants - you can configure these in Cloudflare dashboard
export const IMAGE_VARIANTS = {
  FAVICON: 'favicon', // e.g., 32x32 or 64x64 for favicon use
  THUMBNAIL: 'thumbnail', // e.g., 150x150
  SMALL: 'small', // e.g., 300x300
  MEDIUM: 'medium', // e.g., 600x600
  LARGE: 'large', // e.g., 1200x1200
} as const;

export type ImageVariant = (typeof IMAGE_VARIANTS)[keyof typeof IMAGE_VARIANTS];

export function getCloudflareImageUrl(
  imageId: string,
  accountHash: string,
  variant: ImageVariant = IMAGE_VARIANTS.LARGE
): string {
  return `https://imagedelivery.net/${accountHash}/${imageId}/${variant}`;
}
