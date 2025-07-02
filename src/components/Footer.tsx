import type { FC } from 'hono/jsx';

type FooterProps = {
  user?: any;
  churchId?: string;
  countyId?: string;
  affiliationId?: string;
};

export const Footer: FC<FooterProps> = ({ user, churchId, countyId, affiliationId }) => {
  return (
    <footer class="bg-white border-t border-gray-200 mt-auto" data-testid="footer">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex flex-col sm:flex-row justify-between items-center">
          <div class="text-gray-600 text-sm text-center sm:text-left">
            <p class="italic">"Peace be to you. The friends greet you.</p>
            <p class="italic">Greet the friends, each by name."</p>
            <p class="mt-1 text-gray-500">– 3 John 1:15</p>
          </div>
          <div class="mt-4 sm:mt-0 flex items-center space-x-3">
            {user && churchId && (
              <a
                href={`/admin/churches/${churchId}/edit`}
                class="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 hover:underline transition-colors"
                data-testid="edit-church-link"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit
              </a>
            )}
            {user && countyId && (
              <a
                href={`/admin/counties/${countyId}/edit`}
                class="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 hover:underline transition-colors"
                data-testid="edit-county-link"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit
              </a>
            )}
            {user && affiliationId && (
              <a
                href={`/admin/affiliations/${affiliationId}/edit`}
                class="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 hover:underline transition-colors"
                data-testid="edit-affiliation-link"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit
              </a>
            )}
            {user && !churchId && !countyId && !affiliationId && (
              <a
                href="/admin"
                class="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 hover:underline transition-colors"
                data-testid="admin-link"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Admin
              </a>
            )}
            <a
              href="/data"
              class="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 hover:underline transition-colors"
              data-testid="data-link"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              Data
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
