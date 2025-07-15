/**
 * Client-side blurhash decoding utility
 * Generates a data URL from a blurhash for use as a placeholder
 */

import { decode } from 'blurhash';

/**
 * Decode a blurhash to a data URL
 * @param blurhash The blurhash string
 * @param width Target width (keep small for performance, e.g. 32)
 * @param height Target height (keep small for performance, e.g. 32)
 * @returns Data URL of the decoded image
 */
export function blurhashToDataURL(blurhash: string, width: number, height: number): string {
  try {
    // Keep dimensions small for performance
    const targetWidth = Math.min(width, 32);
    const targetHeight = Math.min(height, 32);

    // Decode blurhash to pixel array
    const pixels = decode(blurhash, targetWidth, targetHeight);

    // Create canvas and draw pixels
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return '';
    }

    // Create ImageData and put pixels
    const imageData = ctx.createImageData(targetWidth, targetHeight);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);

    // Convert to data URL
    return canvas.toDataURL();
  } catch (error) {
    console.error('Failed to decode blurhash:', error);
    // Return a gray placeholder on error
    return (
      'data:image/svg+xml;base64,' +
      btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="#e5e7eb"/>
      </svg>
    `)
    );
  }
}

/**
 * Generate CSS for a blurhash background
 * This can be used inline or in a style tag
 */
export function blurhashToCSS(blurhash: string, width: number, height: number): string {
  const dataURL = blurhashToDataURL(blurhash, width, height);
  return `
    background-image: url(${dataURL});
    background-size: cover;
    background-position: center;
    filter: blur(40px);
    transform: scale(1.2);
  `;
}
