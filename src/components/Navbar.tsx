import { FC } from 'hono/jsx';

type NavbarProps = {
  user?: any;
  currentPath?: string;
};

export const Navbar: FC<NavbarProps> = ({ user, currentPath = '/' }) => {
  return (
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            {/* Logo/Brand */}
            <div class="flex-shrink-0 flex items-center">
              <a href="/" class="flex items-center">
                <img src="https://images.squarespace-cdn.com/content/v1/66844914d5f76b6f0a0d4b96/2e88a07c-afb4-43ed-9876-a783f09f399b/UtahChurches.jpg?format=256w" alt="Utah Churches" class="h-10 w-auto" />
              </a>
            </div>
            
            {/* Primary Navigation */}
            <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
              <a
                href="/"
                class={`${
                  currentPath === '/' 
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
              >
                Home
              </a>
              <a
                href="/map"
                class={`${
                  currentPath === '/map' 
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
              >
                Map
              </a>
              <a
                href="/networks"
                class={`${
                  currentPath === '/networks' 
                    ? 'border-primary-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
              >
                Networks
              </a>
            </div>
          </div>
          
          {/* Right side navigation */}
          <div class="hidden sm:ml-6 sm:flex sm:items-center">
            {user ? (
              <div class="flex items-center space-x-4">
                <a
                  href="/admin"
                  class="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                >
                  Dashboard
                </a>
                <div class="relative">
                  <div class="flex items-center">
                    <span class="text-sm text-gray-700 mr-3">{user.username}</span>
                    <a
                      href="/logout"
                      class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors"
                    >
                      Logout
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          
          {/* Mobile menu button */}
          <div class="-mr-2 flex items-center sm:hidden">
            <button
              type="button"
              class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              aria-controls="mobile-menu"
              aria-expanded="false"
              onclick="document.getElementById('mobile-menu').classList.toggle('hidden')"
            >
              <span class="sr-only">Open main menu</span>
              <svg class="block h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div class="hidden" id="mobile-menu">
        <div class="pt-2 pb-3 space-y-1">
          <a
            href="/"
            class={`${
              currentPath === '/'
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
          >
            Home
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