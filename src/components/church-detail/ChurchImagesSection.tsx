import type { FC } from 'hono/jsx';
import { BlurhashImage } from '../BlurhashImage';
import { OptimizedImage } from '../OptimizedImage';
import { getImageUrl } from '../../utils/r2-images';

interface ChurchImagesSectionProps {
  churchImages: any[];
  settingsMap: Map<string, string>;
}

export const ChurchImagesSection: FC<ChurchImagesSectionProps> = ({ churchImages, settingsMap }) => {
  const r2Domain = settingsMap.get('r2_domain') || undefined;

  if (churchImages.length === 0) {
    return null;
  }

  return (
    <div class="space-y-4" data-testid="church-images">
      <h3 class="text-base font-medium text-gray-500">Images</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {churchImages.map((image) => (
          <div key={image.id} class="relative">
            {image.blurhash ? (
              <BlurhashImage
                src={getImageUrl(image.imagePath, r2Domain)}
                alt={image.imageAlt || ''}
                width={image.width || 400}
                height={image.height || 300}
                blurhash={image.blurhash}
                className="w-full h-48 object-cover rounded-lg shadow-sm"
              />
            ) : (
              <OptimizedImage
                src={getImageUrl(image.imagePath, r2Domain)}
                alt={image.imageAlt || ''}
                width={image.width || 400}
                height={image.height || 300}
                className="w-full h-48 object-cover rounded-lg shadow-sm"
              />
            )}
            {image.caption && <div class="mt-2 text-sm text-gray-600">{image.caption}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};
