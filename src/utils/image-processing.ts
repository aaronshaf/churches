/**
 * Client-side image processing utilities
 * Extracts dimensions and generates blurhash before upload
 */

import { encode } from 'blurhash';

export interface ImageMetadata {
  width: number;
  height: number;
  blurhash: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Extract image dimensions and generate blurhash
 * @param file The image file to process
 * @returns Promise with image metadata
 */
export async function processImage(file: File): Promise<ImageMetadata> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        // Get original dimensions
        const width = img.width;
        const height = img.height;

        // Calculate scaled dimensions for blurhash (max 32x32 for performance)
        const maxDim = 32;
        let scaledWidth = width;
        let scaledHeight = height;

        if (width > height) {
          if (width > maxDim) {
            scaledWidth = maxDim;
            scaledHeight = Math.round((height * maxDim) / width);
          }
        } else {
          if (height > maxDim) {
            scaledHeight = maxDim;
            scaledWidth = Math.round((width * maxDim) / height);
          }
        }

        // Set canvas size and draw scaled image
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

        // Get image data for blurhash
        const imageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);

        // Generate blurhash (4-4 components for good quality/size balance)
        const blurhash = encode(imageData.data, scaledWidth, scaledHeight, 4, 4);

        // Clean up
        URL.revokeObjectURL(img.src);

        resolve({
          width,
          height,
          blurhash,
          fileSize: file.size,
          mimeType: file.type,
        });
      } catch (error) {
        URL.revokeObjectURL(img.src);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    // Load the image
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Validate image file
 * @param file The file to validate
 * @returns true if valid, throws error if not
 */
export function validateImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
  }

  if (file.size > maxSize) {
    throw new Error('File size must be less than 10MB.');
  }

  return true;
}

/**
 * Generate a preview URL for an image file
 * @param file The image file
 * @returns Object URL for preview
 */
export function generatePreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Clean up a preview URL
 * @param url The object URL to revoke
 */
export function cleanupPreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Format file size for display
 * @param bytes File size in bytes
 * @returns Formatted string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
