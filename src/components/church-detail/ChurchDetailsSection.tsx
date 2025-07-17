import type { FC } from 'hono/jsx';
import { t } from '../../lib/i18n';
import { ChurchDetailService } from '../../services/church-detail';

interface ChurchDetailsSectionProps {
  church: any;
  affiliations: any[];
  gatherings: any[];
}

export const ChurchDetailsSection: FC<ChurchDetailsSectionProps> = ({ church, affiliations, gatherings }) => {
  const formatUrlForDisplay = ChurchDetailService.formatUrlForDisplay;

  return (
    <div class="space-y-4" data-testid="church-details">
      {/* Get Directions */}
      {church.address && (
        <div>
          <h3 class="text-base font-medium text-gray-500">{t('church.getDirections')}</h3>
          <div class="mt-2">
            <div class="flex gap-2 mt-3">
              <a
                href={`https://maps.google.com/maps?q=${encodeURIComponent(
                  `${church.address}, ${church.city}, ${church.state} ${church.zip}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span class="hidden sm:inline">Google Maps</span>
                <span class="sm:hidden">Google</span>
              </a>
              <a
                href={`https://maps.apple.com/?q=${encodeURIComponent(
                  `${church.address}, ${church.city}, ${church.state} ${church.zip}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span class="hidden sm:inline">Apple Maps</span>
                <span class="sm:hidden">Apple</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Contact Information */}
      <div>
        <h3 class="text-base font-medium text-gray-500">{t('church.contact')}</h3>
        <div class="mt-2 space-y-1">
          {church.phone && (
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <a href={`tel:${church.phone}`} class="text-primary-600 hover:text-primary-800">
                {church.phone}
              </a>
            </div>
          )}
          {church.email && (
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <a href={`mailto:${church.email}`} class="text-primary-600 hover:text-primary-800">
                {church.email}
              </a>
            </div>
          )}
          {church.website && (
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              <a
                href={church.website}
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-600 hover:text-primary-800"
              >
                {formatUrlForDisplay(church.website)}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Affiliations */}
      {affiliations.length > 0 && (
        <div>
          <h3 class="text-base font-medium text-gray-500">{t('church.affiliations')}</h3>
          <div class="mt-2 space-y-1">
            {affiliations.map((affiliation) => (
              <div key={affiliation.id} class="flex items-center">
                <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                {affiliation.website ? (
                  <a
                    href={affiliation.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-600 hover:text-primary-800"
                  >
                    {affiliation.name}
                  </a>
                ) : (
                  <span class="text-gray-900">{affiliation.name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gatherings */}
      {gatherings.length > 0 && (
        <div>
          <h3 class="text-base font-medium text-gray-500">{t('church.gatherings')}</h3>
          <div class="mt-2 space-y-1">
            {gatherings.map((gathering) => (
              <div key={gathering.id} class="flex items-start">
                <svg class="w-4 h-4 mr-2 mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-gray-900">
                    <span class="font-medium">{gathering.day}</span>
                    {gathering.time && <span class="ml-2">{gathering.time}</span>}
                    {gathering.type && <span class="ml-2 text-gray-500">({gathering.type})</span>}
                  </div>
                  {gathering.notes && <div class="mt-1 text-sm text-gray-500">{gathering.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
