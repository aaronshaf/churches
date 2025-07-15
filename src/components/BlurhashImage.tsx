import { blurhashToDataURL } from '../utils/blurhash-client';
import type { ImageTransformations } from '../utils/r2-images';
import { generateSrcSet, getImageUrl } from '../utils/r2-images';

interface BlurhashImageProps {
  imageId: number;
  path: string;
  alt: string;
  width: number;
  height: number;
  blurhash: string;
  className?: string;
  domain?: string;
  r2Domain?: string;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  transformations?: Omit<ImageTransformations, 'width' | 'height'>;
  sizes?: string;
}

export function BlurhashImage({
  imageId,
  path,
  alt,
  width,
  height,
  blurhash,
  className = '',
  domain = 'localhost',
  r2Domain,
  loading = 'lazy',
  priority = false,
  transformations = {},
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
}: BlurhashImageProps) {
  const aspectRatio = width / height;

  // Get optimized image URL
  const src = getImageUrl(
    path,
    domain,
    {
      ...transformations,
      width,
      height,
      format: transformations.format || 'auto',
    },
    r2Domain
  );

  // Generate responsive srcset
  const srcSet = generateSrcSet(
    path,
    domain,
    width,
    {
      ...transformations,
      height,
      format: transformations.format || 'auto',
    },
    r2Domain
  );

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: aspectRatio.toString() }}>
      {/* Blurhash placeholder with CSS */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: `url(${blurhashToDataURL(blurhash, 32, Math.round((32 * height) / width))})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(40px)',
          transform: 'scale(1.2)',
        }}
      />

      {/* Actual image with loading state management */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        className="relative z-10 w-full h-full object-cover opacity-0 transition-opacity duration-300"
        loading={loading}
        decoding={priority ? 'sync' : 'async'}
        onLoad={(e: Event) => {
          // Fade in the image when loaded
          const img = e.target as HTMLImageElement;
          img.style.opacity = '1';

          // Hide the blurhash after transition
          setTimeout(() => {
            const placeholder = img.previousElementSibling as HTMLElement;
            if (placeholder) {
              placeholder.style.display = 'none';
            }
          }, 300);
        }}
        data-image-id={imageId}
      />
    </div>
  );
}

// Gallery component for multiple images
interface ImageGalleryProps {
  images: Array<{
    id: number;
    path: string;
    alt?: string;
    caption?: string;
    width: number;
    height: number;
    blurhash: string;
    displayOrder: number;
    isPrimary: boolean;
  }>;
  domain?: string;
  r2Domain?: string;
  className?: string;
}

export function ImageGallery({ images, domain = 'localhost', r2Domain, className = '' }: ImageGalleryProps) {
  if (images.length === 0) {
    return null;
  }

  // Sort by display order
  const sortedImages = [...images].sort((a, b) => a.displayOrder - b.displayOrder);

  // If only one image, show it large
  if (sortedImages.length === 1) {
    const image = sortedImages[0];
    return (
      <BlurhashImage
        imageId={image.id}
        path={image.path}
        alt={image.alt || ''}
        width={image.width}
        height={image.height}
        blurhash={image.blurhash}
        domain={domain}
        r2Domain={r2Domain}
        className={`w-full rounded-lg ${className}`}
        sizes="(max-width: 768px) 100vw, 768px"
      />
    );
  }

  // Grid layout for multiple images
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${className}`}>
      {sortedImages.map((image) => (
        <div key={image.id} className="relative group">
          <BlurhashImage
            imageId={image.id}
            path={image.path}
            alt={image.alt || ''}
            width={image.width}
            height={image.height}
            blurhash={image.blurhash}
            domain={domain}
            r2Domain={r2Domain}
            className="w-full rounded-lg transition-transform duration-200 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
          {image.caption && <p className="text-sm text-gray-600 mt-2">{image.caption}</p>}
          {image.isPrimary && (
            <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">Primary</span>
          )}
        </div>
      ))}
    </div>
  );
}
