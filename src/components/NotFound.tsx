import type { FC } from 'hono/jsx';

export const NotFound: FC = () => {
  return (
    <div class="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex flex-col justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div class="absolute inset-0 overflow-hidden">
        <svg
          class="absolute -top-40 -right-40 h-80 w-80 text-primary-100 opacity-50"
          fill="currentColor"
          viewBox="0 0 100 100"
        >
          <circle cx="50" cy="50" r="40" />
        </svg>
        <svg
          class="absolute -bottom-32 -left-32 h-64 w-64 text-primary-100 opacity-30"
          fill="currentColor"
          viewBox="0 0 100 100"
        >
          <circle cx="50" cy="50" r="40" />
        </svg>
      </div>

      <div class="relative">
        <div class="max-w-2xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          {/* Animated 404 */}
          <div class="relative">
            <h1 class="text-[10rem] sm:text-[12rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600 leading-none select-none animate-pulse">
              404
            </h1>

            {/* Church icon overlay */}
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="bg-white rounded-full p-8 shadow-2xl">
                <svg class="h-20 w-20 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Error message */}
          <div class="mt-6">
            <h2 class="text-3xl sm:text-4xl font-bold text-gray-900">Oops! Page not found</h2>
            <p class="mt-4 text-lg text-gray-600 max-w-md mx-auto">
              Looks like you've wandered off the beaten path. The page you're looking for has moved or doesn't exist.
            </p>
          </div>

          {/* Quick links grid */}
          <div class="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-lg mx-auto">
            <a
              href="/"
              class="group relative flex items-center justify-center px-6 py-4 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 border border-gray-100"
            >
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                    <svg class="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                  </div>
                </div>
                <div class="ml-4 text-left">
                  <p class="text-base font-semibold text-gray-900">Homepage</p>
                  <p class="text-sm text-gray-500">Browse all counties</p>
                </div>
              </div>
            </a>

            <a
              href="/map"
              class="group relative flex items-center justify-center px-6 py-4 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 border border-gray-100"
            >
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                    <svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                  </div>
                </div>
                <div class="ml-4 text-left">
                  <p class="text-base font-semibold text-gray-900">Church Map</p>
                  <p class="text-sm text-gray-500">Find churches near you</p>
                </div>
              </div>
            </a>
          </div>

          {/* Footer text */}
          <p class="mt-8 text-sm text-gray-500">
            Need help?{' '}
            <a href="/data" class="font-medium text-primary-600 hover:text-primary-700">
              Download church data
            </a>{' '}
            or{' '}
            <a href="/networks" class="font-medium text-primary-600 hover:text-primary-700">
              browse networks
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
