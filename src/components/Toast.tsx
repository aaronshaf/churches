import type { FC } from 'hono/jsx';

type ToastProps = {
  message: string;
  churchName?: string;
  churchPath?: string;
  type?: 'success' | 'error' | 'info';
};

export const Toast: FC<ToastProps> = ({ message, churchName, churchPath, type = 'success' }) => {
  const bgColor = type === 'success' ? 'bg-green-50' : type === 'error' ? 'bg-red-50' : 'bg-blue-50';
  const borderColor = type === 'success' ? 'border-green-200' : type === 'error' ? 'border-red-200' : 'border-blue-200';
  const textColor = type === 'success' ? 'text-green-800' : type === 'error' ? 'text-red-800' : 'text-blue-800';
  const iconColor = type === 'success' ? 'text-green-400' : type === 'error' ? 'text-red-400' : 'text-blue-400';

  return (
    <>
      <div
        id="toast"
        class={`fixed top-4 right-4 z-50 transform transition-all duration-300 ease-in-out translate-x-full opacity-0 ${bgColor} ${borderColor} border rounded-lg shadow-lg p-4 max-w-md`}
      >
        <div class="flex items-start">
          <div class="flex-shrink-0">
            {type === 'success' ? (
              <svg class={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : type === 'error' ? (
              <svg class={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg class={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </div>
          <div class="ml-3 flex-1">
            <p class={`text-sm font-medium ${textColor}`}>{message}</p>
            {churchName && churchPath && (
              <p class="mt-1 text-sm text-gray-600">
                <a
                  href={`/churches/${churchPath}`}
                  class="font-medium text-primary-600 hover:text-primary-800 underline"
                >
                  View {churchName} →
                </a>
              </p>
            )}
          </div>
          <div class="ml-4 flex-shrink-0 flex">
            <button
              type="button"
              onclick="closeToast()"
              class={`inline-flex ${textColor} hover:${textColor} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 focus:ring-green-500`}
            >
              <span class="sr-only">Dismiss</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          function showToast() {
            const toast = document.getElementById('toast');
            if (toast) {
              // Show toast
              setTimeout(() => {
                toast.classList.remove('translate-x-full', 'opacity-0');
                toast.classList.add('translate-x-0', 'opacity-100');
              }, 100);
              
              // Auto-hide after 5 seconds
              setTimeout(() => {
                closeToast();
              }, 5000);
            }
          }
          
          function closeToast() {
            const toast = document.getElementById('toast');
            if (toast) {
              toast.classList.add('translate-x-full', 'opacity-0');
              toast.classList.remove('translate-x-0', 'opacity-100');
            }
          }
          
          // Show toast on page load
          window.addEventListener('DOMContentLoaded', showToast);
        `,
        }}
      />
    </>
  );
};
