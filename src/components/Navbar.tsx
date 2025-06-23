import type { FC } from 'hono/jsx';

type NavbarProps = {
  user?: any;
  currentPath?: string;
};

export const Navbar: FC<NavbarProps> = ({ user, currentPath = '/' }) => {
  return (
    <nav class="bg-white shadow-sm border-b border-gray-200" data-testid="navbar">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16 sm:h-20">
          {/* Logo/Brand - Left side */}
          <div class="flex-shrink-0 flex items-center">
            <a
              href="/"
              class="flex items-center"
              data-testid="logo-link"
              onmouseover="prefetchAfterDelay('/', 200)"
              onmouseout="cancelPrefetch()"
            >
              <img
                src="https://images.squarespace-cdn.com/content/v1/66844914d5f76b6f0a0d4b96/2e88a07c-afb4-43ed-9876-a783f09f399b/UtahChurches.jpg?format=256w"
                alt="Utah Churches"
                class="h-10 sm:h-12 w-auto"
              />
            </a>
          </div>

          {/* Primary Navigation - Right side */}
          <div class="flex items-center">
            <div class="hidden sm:flex sm:space-x-8">
              <a
                href="/"
                class={`${
                  currentPath === '/'
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-base font-medium transition-colors`}
                data-testid="nav-churches"
                onmouseover="prefetchAfterDelay('/', 200)"
                onmouseout="cancelPrefetch()"
              >
                Churches
              </a>
              <a
                href="/map"
                class={`${
                  currentPath === '/map'
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-base font-medium transition-colors`}
                data-testid="nav-map"
                onmouseover="prefetchAfterDelay('/map', 200)"
                onmouseout="cancelPrefetch()"
              >
                Map
              </a>
              <a
                href="/networks"
                class={`${
                  currentPath === '/networks'
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-base font-medium transition-colors`}
                data-testid="nav-networks"
                onmouseover="prefetchAfterDelay('/networks', 200)"
                onmouseout="cancelPrefetch()"
              >
                Networks
              </a>
              {user && (
                <>
                  <a
                    href="/admin"
                    class={`${
                      currentPath?.startsWith('/admin')
                        ? 'border-primary-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-base font-medium transition-colors`}
                  >
                    Admin
                  </a>
                  <div class="flex items-center ml-6">
                    <span class="text-sm text-gray-700 mr-3">{user.username}</span>
                    <a
                      href="/logout"
                      class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors"
                    >
                      Logout
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div class="-mr-2 flex items-center sm:hidden">
            <button
              type="button"
              class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200"
              aria-controls="mobile-menu"
              aria-expanded="false"
              onclick="document.getElementById('mobile-menu').classList.toggle('hidden')"
              data-testid="mobile-menu-button"
            >
              <span class="sr-only">Open main menu</span>
              <svg
                class="block h-6 w-6 transition-transform duration-200 hover:scale-110"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div class="hidden" id="mobile-menu" data-testid="mobile-menu">
        <div class="pt-2 pb-3 space-y-1">
          <a
            href="/"
            class={`${
              currentPath === '/'
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
          >
            Churches
          </a>
          <a
            href="/map"
            class={`${
              currentPath === '/map'
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
          >
            Map
          </a>
          <a
            href="/networks"
            class={`${
              currentPath === '/networks'
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
          >
            Networks
          </a>
        </div>
        <div class="pt-4 pb-3 border-t border-gray-200">
          {user ? (
            <div class="space-y-1">
              <div class="px-4 pb-2">
                <div class="text-base font-medium text-gray-800">{user.username}</div>
                <div class="text-sm font-medium text-gray-500">{user.email}</div>
              </div>
              <a
                href="/admin"
                class="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              >
                Dashboard
              </a>
              <a
                href="/logout"
                class="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              >
                Logout
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
};
