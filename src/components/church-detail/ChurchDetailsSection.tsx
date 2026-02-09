import type { FC } from 'hono/jsx';
import { t } from '../../lib/i18n';
import { ChurchDetailService } from '../../services/church-detail';

interface ChurchDetailsSectionProps {
  church: any;
  affiliations: any[];
  gatherings: any[];
}

export const ChurchDetailsSection: FC<ChurchDetailsSectionProps> = ({ church, affiliations, gatherings }) => {
  const _formatUrlForDisplay = ChurchDetailService.formatUrlForDisplay;

  return (
    <div class="space-y-4" data-testid="church-details">
      {church.gatheringAddress && (
        <div data-testid="church-directions">
          <h3 class="text-base font-medium text-gray-500">{t('church.getDirections')}</h3>
          {church.latitude && church.longitude && (
            <div class="flex gap-2 mt-3">
              <a
                href={`https://maps.google.com/?q=${church.latitude},${church.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                data-testid="google-maps-link"
              >
                <svg
                  class="w-5 h-5 mr-1.5 group-hover:text-[#0F9D58] group-focus:text-[#0F9D58] transition-colors"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span class="hidden sm:inline">Google Maps</span>
                <span class="sm:hidden">Google</span>
              </a>
              <a
                href={`https://maps.apple.com/?ll=${church.latitude},${church.longitude}&q=${encodeURIComponent(church.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                data-testid="apple-maps-link"
              >
                <svg
                  class="w-5 h-5 mr-1.5 group-hover:text-[#007AFF] group-focus:text-[#007AFF] transition-colors"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" />
                </svg>
                <span class="hidden sm:inline">Apple Maps</span>
                <span class="sm:hidden">Apple</span>
              </a>
            </div>
          )}
        </div>
      )}

      {gatherings.length > 0 && (
        <div data-testid="church-gatherings">
          <h3 class="text-base font-medium text-gray-500">{t('church.gatherings')}</h3>
          <div class="mt-1 space-y-1">
            {gatherings.map((gathering, index) => (
              <div class="text-base text-gray-900" data-testid={`gathering-${index}`}>
                <span class="font-medium" data-testid={`gathering-time-${index}`}>
                  {gathering.time}
                </span>
                {gathering.notes && (
                  <span class="text-gray-600" data-testid={`gathering-notes-${index}`}>
                    {' '}
                    – {gathering.notes}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {church.phone && (
        <div data-testid="church-phone">
          <h3 class="text-base font-medium text-gray-500">{t('church.phone')}</h3>
          <a href={`tel:${church.phone}`} class="mt-1 text-base text-primary-600 hover:text-primary-500">
            {church.phone}
          </a>
        </div>
      )}

      {church.email && (
        <div data-testid="church-email">
          <h3 class="text-base font-medium text-gray-500">{t('church.email')}</h3>
          <a href={`mailto:${church.email}`} class="mt-1 text-base text-primary-600 hover:text-primary-500">
            {church.email}
          </a>
        </div>
      )}
    </div>
  );
};
