import type { ImageTransformations } from '../utils/r2-images';
import { generateSrcSet, getImageUrl } from '../utils/r2-images';

interface OptimizedImageProps {
  path: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  className?: string;
  responsive?: boolean;
  domain?: string;
  r2Domain?: string;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  transformations?: Omit<ImageTransformations, 'width' | 'height' | 'quality'>;
}

export function OptimizedImage({
  path,
  alt,
  width = 800,
  height,
  quality = 80,
  className = '',
  responsive = true,
  domain = 'localhost',
  r2Domain,
  loading = 'lazy',
  priority = false,
  transformations = {},
}: OptimizedImageProps) {
  if (!path) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-sm">No image</span>
      </div>
    );
  }

  const fullTransformations: ImageTransformations = {
    ...transformations,
    width,
    height,
    quality,
    format: transformations.format || 'auto',
  };

  const src = getImageUrl(path, domain, fullTransformations, r2Domain);

  if (responsive) {
    const srcSet = generateSrcSet(
      path,
      domain,
      width,
      {
        ...transformations,
        height,
        quality,
        format: transformations.format || 'auto',
      },
      r2Domain
    );

    return (
      <img
        src={src}
        srcSet={srcSet}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        alt={alt}
        className={className}
        loading={loading}
        decoding={priority ? 'sync' : 'async'}
      />
    );
  }

  return <img src={src} alt={alt} className={className} loading={loading} decoding={priority ? 'sync' : 'async'} />;
}
