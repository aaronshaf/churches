import type { FC } from 'hono/jsx';
import { BlurhashImage } from '../BlurhashImage';
import { OptimizedImage } from '../OptimizedImage';
import type { SettingsMap } from '../../utils/settings-cache';

interface ChurchImagesSectionProps {
  churchImages: any[];
  settingsMap: SettingsMap;
}

export const ChurchImagesSection: FC<ChurchImagesSectionProps> = ({ churchImages, settingsMap }) => {
  const r2Domain = settingsMap.r2_image_domain || undefined;
  const domain = settingsMap.site_domain || 'localhost';

  if (churchImages.length === 0) {
    return null;
  }

  return (
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="church-gallery-grid">
      {churchImages.map((image, index) => (
        <div
          key={image.id}
          class="relative group cursor-pointer"
          onclick={`openImageModal({
            src: '${
              r2Domain
                ? `https://${domain}/cdn-cgi/image/format=auto,width=1200/https://${r2Domain}/${image.imagePath}`
                : `https://${domain}/cdn-cgi/image/format=auto,width=1200/${image.imagePath}`
            }',
            alt: '${(image.imageAlt || `Church photo ${index + 1}`).replace(/'/g, "\\'")}',
            caption: '${(image.caption || '').replace(/'/g, "\\'")}'
          })`}
        >
          {image.blurhash ? (
            <BlurhashImage
              imageId={image.id}
              path={image.imagePath}
              alt={image.imageAlt || `Church photo ${index + 1}`}
              width={image.width || 300}
              height={image.height || 200}
              blurhash={image.blurhash}
              className="w-full h-32 md:h-40 object-cover rounded-lg transition-transform duration-200 group-hover:scale-105"
              domain={domain}
              r2Domain={r2Domain}
            />
          ) : (
            <OptimizedImage
              path={image.imagePath}
              alt={image.imageAlt || `Church photo ${index + 1}`}
              width={300}
              height={200}
              className="w-full h-32 md:h-40 object-cover rounded-lg transition-transform duration-200 group-hover:scale-105"
              domain={domain}
              r2Domain={r2Domain}
            />
          )}
          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
            <svg
              class="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
              ></path>
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
};
