import type { FC } from 'hono/jsx';
import { BetterAuthUserMenu } from './BetterAuthUserMenu';

type NavbarProps = {
  user?: any;
  currentPath?: string;
  logoUrl?: string;
  pages?: Array<{ id: number; title: string; path: string; navbarOrder: number | null }>;
};

export const Navbar: FC<NavbarProps> = ({ user, currentPath = '/', logoUrl, pages = [] }) => {
  return (
    <nav class="bg-white shadow-sm border-b border-gray-200" aria-label="Main navigation" data-testid="navbar">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16 sm:h-20">
          {/* Logo/Brand - Left side */}
          <div class="flex-shrink-0 flex items-center">
            <a
              href="/"
              class="flex items-center"
              aria-label="Utah Churches - Home"
              data-testid="logo-link"
              onmouseover="prefetchAfterDelay('/', 200)"
              onmouseout="cancelPrefetch()"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Utah Churches" class="h-10 sm:h-12 w-auto" />
              ) : (
                <span class="text-xl sm:text-2xl font-bold text-gray-900">Utah Churches</span>
              )}
            </a>
          </div>

          {/* Primary Navigation and User Menu - Right side */}
          <div class="flex items-center">
            <div class="hidden sm:flex sm:space-x-8">
              <a
                href="/"
                class={`${
                  currentPath === '/'
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b text-base font-medium transition-colors`}
                aria-current={currentPath === '/' ? 'page' : undefined}
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
                } inline-flex items-center px-1 pt-1 border-b text-base font-medium transition-colors`}
                aria-current={currentPath === '/map' ? 'page' : undefined}
                data-testid="nav-map"
                onmouseover="prefetchAfterDelay('/map', 200)"
                onmouseout="cancelPrefetch()"
              >
                Map
              </a>
              <a
                href="/networks"
                class={`${
                  currentPath === '/networks' || currentPath?.startsWith('/admin/affiliations')
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b text-base font-medium transition-colors`}
                aria-current={currentPath === '/networks' || currentPath?.startsWith('/admin/affiliations') ? 'page' : undefined}
                data-testid="nav-networks"
                onmouseover="prefetchAfterDelay('/networks', 200)"
                onmouseout="cancelPrefetch()"
              >
                Networks
              </a>
              {pages
                .filter((page) => page.navbarOrder !== null)
                .sort((a, b) => (a.navbarOrder || 0) - (b.navbarOrder || 0))
                .map((page) => (
                  <a
                    href={`/${page.path}`}
                    class={`${
                      currentPath === `/${page.path}`
                        ? 'border-primary-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b text-base font-medium transition-colors`}
                    data-testid={`nav-page-${page.path}`}
                    onmouseover={`prefetchAfterDelay('/${page.path}', 200)`}
                    onmouseout="cancelPrefetch()"
                  >
                    {page.title}
                  </a>
                ))}
            </div>
            
            {/* User menu for desktop */}
            <div class={`hidden sm:block ${user ? 'ml-8' : 'ml-4'}`}>
              <BetterAuthUserMenu user={user} />
            </div>
          </div>

          {/* Mobile menu button and user menu */}
          <div class="flex items-center space-x-3 sm:hidden">
            <BetterAuthUserMenu user={user} />
            <button
              type="button"
              class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200"
              aria-controls="mobile-menu"
              aria-expanded="false"
              aria-label="Toggle navigation menu"
              onclick="const menu = document.getElementById('mobile-menu'); const expanded = menu.classList.toggle('hidden'); this.setAttribute('aria-expanded', !expanded);"
              data-testid="mobile-menu-button"
            >
              <span class="sr-only">Toggle main menu</span>
              <svg
                class="block h-6 w-6 transition-transform duration-200 hover:scale-110"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
            } block pl-3 pr-4 py-2 border-l text-base font-medium`}
          >
            Churches
          </a>
          <a
            href="/map"
            class={`${
              currentPath === '/map'
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l text-base font-medium`}
          >
            Map
          </a>
          <a
            href="/networks"
            class={`${
              currentPath === '/networks' || currentPath?.startsWith('/admin/affiliations')
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l text-base font-medium`}
          >
            Networks
          </a>
          {pages
            .filter((page) => page.navbarOrder !== null)
            .sort((a, b) => (a.navbarOrder || 0) - (b.navbarOrder || 0))
            .map((page) => (
              <a
                href={`/${page.path}`}
                class={`${
                  currentPath === `/${page.path}`
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l text-base font-medium`}
              >
                {page.title}
              </a>
            ))}
        </div>
      </div>
    </nav>
  );
};
