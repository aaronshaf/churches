import type { FC } from 'hono/jsx';

type ClerkLoginProps = {
  publishableKey: string;
  redirectUrl?: string;
};

export const ClerkLogin: FC<ClerkLoginProps> = ({ publishableKey, redirectUrl = '/admin' }) => {
  return (
    <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div class="max-w-md w-full space-y-8">
        <div>
          <div class="flex justify-center">
            <svg class="h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
          <p class="mt-2 text-center text-sm text-gray-600">Access the admin dashboard</p>
        </div>

        <div class="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div class="text-center">
            <p class="text-sm text-gray-600 mb-4">
              This site uses Clerk for authentication. Click below to sign in.
            </p>
            
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  // Redirect to Clerk's Account Portal sign-in page
                  window.location.href = 'https://accounts.${window.location.hostname}/sign-in?redirect_url=' + encodeURIComponent('${redirectUrl}');
                `
              }}
            />
            
            <noscript>
              <a 
                href={`https://accounts.${typeof window !== 'undefined' ? window.location.hostname : 'utahchurches.raymati.com'}/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Continue to Sign In
              </a>
            </noscript>
          </div>
        </div>
      </div>
    </div>
  );
};