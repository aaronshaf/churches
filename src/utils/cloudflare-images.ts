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
  apiToken: string
): Promise<CloudflareImageUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  // Optional: Add metadata
  formData.append('metadata', JSON.stringify({
    uploadedAt: new Date().toISOString(),
  }));

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
      body: formData,
    }
  );

  return response.json();
}

export async function deleteFromCloudflareImages(
  imageId: string,
  accountId: string,
  apiToken: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    }
  );

  return response.json();
}

export function getCloudflareImageUrl(imageId: string, accountHash: string, variant: string = 'public'): string {
  return `https://imagedelivery.net/${accountHash}/${imageId}/${variant}`;
}