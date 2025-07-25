import type { FC } from 'hono/jsx';
import { t } from '../../lib/i18n';
import { ChurchDetailService } from '../../services/church-detail';

interface ChurchSocialMediaSectionProps {
  church: any;
}

export const ChurchSocialMediaSection: FC<ChurchSocialMediaSectionProps> = ({ church }) => {
  const formatUrlForDisplay = ChurchDetailService.formatUrlForDisplay;

  const socialLinks = [
    { url: church.facebook, icon: 'facebook', label: 'Facebook' },
    { url: church.instagram, icon: 'instagram', label: 'Instagram' },
    { url: church.youtube, icon: 'youtube', label: 'YouTube' },
  ].filter((link) => link.url);

  if (socialLinks.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 class="text-base font-medium text-gray-500">{t('church.socialMedia')}</h3>
      <div class="mt-2 space-y-1">
        {socialLinks.map((link) => (
          <div key={link.icon} class="flex items-center">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              {link.icon === 'facebook' && (
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              )}
              {link.icon === 'instagram' && (
                <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.621 5.367 11.988 11.988 11.988 6.62 0 11.987-5.367 11.987-11.988C24.004 5.367 18.637.001 12.017.001zM12 16.624A4.626 4.626 0 117.374 12 4.626 4.626 0 0112 16.624zm4.873-8.386a1.08 1.08 0 11-2.16 0 1.08 1.08 0 012.16 0z" />
              )}
              {link.icon === 'youtube' && (
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              )}
            </svg>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary-600 hover:text-primary-800"
            >
              {formatUrlForDisplay(link.url)}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};
