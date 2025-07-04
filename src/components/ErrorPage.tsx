import type { FC } from 'hono/jsx';

type ErrorPageProps = {
  error?: string;
  statusCode?: number;
  errorId?: string;
  errorType?: string;
  errorDetails?: string;
};

export const ErrorPage: FC<ErrorPageProps> = ({ 
  error = 'An unexpected error occurred', 
  statusCode = 500,
  errorId,
  errorType = 'Error',
  errorDetails
}) => {
  const isNetworkError = errorType === 'Network Error' || error.includes('Network connection lost') || error.includes('Failed query');
  const isDatabaseError = errorType === 'Database Error' || error.includes('Database');
  const isAuthError = errorType === 'Authentication Error' || statusCode === 401;
  const isPermissionError = errorType === 'Permission Error' || statusCode === 403;
  const isNotFound = errorType === 'Not Found' || statusCode === 404;

  // Choose appropriate title and description based on error type
  const getErrorDisplay = () => {
    if (isNotFound) {
      return {
        title: 'Page Not Found',
        description: 'The page you are looking for does not exist or has been moved.',
        icon: 'M9 5l7 7-7 7' // Arrow path
      };
    }
    if (isAuthError) {
      return {
        title: 'Authentication Required',
        description: 'Please sign in to access this page.',
        icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' // Lock path
      };
    }
    if (isPermissionError) {
      return {
        title: 'Access Denied',
        description: 'You do not have permission to access this resource.',
        icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' // Shield X path
      };
    }
    if (isNetworkError || isDatabaseError) {
      return {
        title: 'Connection Error',
        description: "We're having trouble connecting to our services. This is usually temporary - please try again in a moment.",
        icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0' // Wifi off path
      };
    }
    return {
      title: 'Something went wrong',
      description: errorDetails || 'We encountered an unexpected error. Our team has been notified.',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' // Warning path
    };
  };

  const { title, description, icon } = getErrorDisplay();

  return (
    <div class="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex flex-col justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div class="absolute inset-0 overflow-hidden">
        <svg
          class="absolute -top-40 -right-40 h-80 w-80 text-red-100 opacity-50"
          fill="currentColor"
          viewBox="0 0 100 100"
        >
          <circle cx="50" cy="50" r="40" />
        </svg>
        <svg
          class="absolute -bottom-32 -left-32 h-64 w-64 text-red-100 opacity-30"
          fill="currentColor"
          viewBox="0 0 100 100"
        >
          <circle cx="50" cy="50" r="40" />
        </svg>
      </div>

      <div class="relative">
        <div class="max-w-2xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          {/* Error Icon */}
          <div class="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-8">
            <svg class="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d={icon}
              />
            </svg>
          </div>

          {/* Error message */}
          <div>
            <h1 class="text-3xl sm:text-4xl font-bold text-gray-900">{title}</h1>
            <p class="mt-4 text-lg text-gray-600 max-w-md mx-auto">{description}</p>
          </div>

          {/* Error details box */}
          {(error !== 'An unexpected error occurred' || errorType !== 'Error') && (
            <div class="mt-6 bg-gray-50 rounded-lg p-4 max-w-lg mx-auto">
              <div class="text-sm text-gray-600">
                {errorType && errorType !== 'Error' && (
                  <p class="font-medium text-gray-700 mb-1">{errorType}</p>
                )}
                <p class="text-xs break-words">{error}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div class="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthError ? (
              <a
                href="/auth/signin"
                class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Sign In
              </a>
            ) : (
              <button
                onclick="window.location.reload()"
                class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                <svg class="mr-2 -ml-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Try Again
              </button>
            )}

            <a
              href="/"
              class="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <svg class="mr-2 -ml-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Go to Homepage
            </a>
          </div>

          {/* Technical details (for development) */}
          {process.env.NODE_ENV === 'development' && (
            <details class="mt-12 text-left max-w-lg mx-auto">
              <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700">Developer details</summary>
              <pre class="mt-2 text-xs text-gray-600 bg-gray-100 p-4 rounded-lg overflow-x-auto">
{JSON.stringify({ error, statusCode, errorType, errorId, errorDetails }, null, 2)}
              </pre>
            </details>
          )}

          {/* Status and Error ID */}
          <div class="mt-12 text-sm text-gray-500">
            <p>Error Code: {statusCode}</p>
            {errorId && (
              <p class="mt-1">Reference ID: {errorId}</p>
            )}
            {(isNetworkError || isDatabaseError) && (
              <p class="mt-2">
                If this problem persists, please check{' '}
                <a
                  href="https://status.turso.tech/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-red-600 hover:text-red-700"
                >
                  our database status
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};