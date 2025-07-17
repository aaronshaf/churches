import type { FC } from 'hono/jsx';
import { t } from '../../lib/i18n';

interface ChurchHeaderProps {
  church: any;
  county: any;
}

export const ChurchHeader: FC<ChurchHeaderProps> = ({ church, county }) => {
  return (
    <div class="bg-gradient-to-r from-primary-600 to-primary-700" data-testid="church-header">
      <div class="max-w-7xl mx-auto px-8 sm:px-6 lg:px-8">
        <div class="py-12 md:py-16">
          <div class="md:flex md:items-center md:justify-between">
            <div class="flex-1 min-w-0">
              <h1 class="text-4xl font-bold text-white md:text-5xl" data-testid="church-name">
                {church.name}
              </h1>
              {church.address && (
                <p class="mt-4 text-xl text-primary-100" data-testid="church-address">
                  {church.address}, {church.city}, {church.state} {church.zip}
                </p>
              )}
              <div class="mt-4">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
                  {t('church.status')}: {church.status}
                </span>
                {county && (
                  <span class="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                    {county.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
