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
              {church.gatheringAddress && (
                <p class="mt-4 text-xl text-primary-100" data-testid="church-address">
                  {church.gatheringAddress}
                </p>
              )}
              {church.status && church.status !== 'Listed' && church.status !== 'Unlisted' && (
                <div class="mt-4">
                  <span
                    class={`inline-flex items-center rounded-md px-3 py-1 text-sm font-medium ${
                      church.status === 'Heretical' ? 'bg-red-100 text-red-800' : 'bg-primary-800 text-primary-100'
                    }`}
                    data-testid="church-status"
                  >
                    {church.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
