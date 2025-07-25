import type { FC } from 'hono/jsx';
import { t } from '../../lib/i18n';
import { ChurchDetailService } from '../../services/church-detail';

interface ChurchRightColumnProps {
  church: any;
  affiliations: any[];
}

export const ChurchRightColumn: FC<ChurchRightColumnProps> = ({ church, affiliations }) => {
  const formatUrlForDisplay = ChurchDetailService.formatUrlForDisplay;

  return (
    <div class="space-y-4">
      {church.website && (
        <div data-testid="church-website">
          <h3 class="text-base font-medium text-gray-500">{t('church.website')}</h3>
          <a
            href={church.website}
            rel="noopener noreferrer"
            class="mt-1 text-base text-primary-600 hover:text-primary-500"
          >
            {formatUrlForDisplay(church.website)}
          </a>
        </div>
      )}

      {church.statementOfFaith && (
        <div data-testid="church-statement-of-faith">
          <h3 class="text-base font-medium text-gray-500">{t('church.statementOfFaith')}</h3>
          <a
            href={church.statementOfFaith}
            rel="noopener noreferrer"
            class="mt-1 text-base text-primary-600 hover:text-primary-500"
          >
            {formatUrlForDisplay(church.statementOfFaith)}
          </a>
        </div>
      )}

      {/* Social Media Links */}
      {(church.facebook || church.instagram || church.youtube || church.spotify) && (
        <div>
          <h3 class="text-base font-medium text-gray-500">{t('church.socialMedia')}</h3>
          <div class="flex gap-2 mt-3 flex-wrap" data-testid="social-media-links">
            {church.facebook && (
              <a
                href={church.facebook}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                data-testid="facebook-link"
              >
                <svg
                  class="w-5 h-5 mr-1.5 group-hover:text-[#1877f2] group-focus:text-[#1877f2] transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
                <span>Facebook</span>
              </a>
            )}
            {church.instagram && (
              <a
                href={church.instagram}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                data-testid="instagram-link"
              >
                <svg
                  class="w-5 h-5 mr-1.5 group-hover:text-[#E4405F] group-focus:text-[#E4405F] transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" />
                </svg>
                <span>Instagram</span>
              </a>
            )}
            {church.youtube && (
              <a
                href={church.youtube}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                data-testid="youtube-link"
              >
                <svg
                  class="w-5 h-5 mr-1.5 group-hover:text-[#FF0000] group-focus:text-[#FF0000] transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <span>YouTube</span>
              </a>
            )}
            {church.spotify && (
              <a
                href={church.spotify}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                data-testid="spotify-link"
              >
                <svg
                  class="w-5 h-5 mr-1.5 group-hover:text-[#1DB954] group-focus:text-[#1DB954] transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                <span>Spotify</span>
              </a>
            )}
          </div>
        </div>
      )}

      {affiliations.length > 0 && (
        <div data-testid="church-affiliations">
          <h3 class="text-base font-medium text-gray-500">{t('church.affiliations')}</h3>
          <div class="mt-1 space-y-1">
            {affiliations.map((affiliation) => (
              <div key={affiliation.affiliationId}>
                <a href={`/networks/${affiliation.path}`} class="text-base text-primary-600 hover:text-primary-500">
                  {affiliation.name}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
