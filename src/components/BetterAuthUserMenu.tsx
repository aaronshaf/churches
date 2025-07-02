import type { FC } from 'hono/jsx';

type BetterAuthUserMenuProps = {
  user?: any;
};

export const BetterAuthUserMenu: FC<BetterAuthUserMenuProps> = ({ user }) => {
  if (!user) return null;

  return (
    <>
      {/* User Menu Container - reserve space to prevent layout shift */}
      <div id="better-auth-user-menu" class="inline-flex items-center w-6 h-6 relative">
        {/* Very subtle loading indicator */}
        <div class="absolute inset-0 rounded-full bg-gray-300 opacity-30"></div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          (function() {
            const container = document.getElementById('better-auth-user-menu');
            if (!container) return;
            
            // User initials for avatar
            const name = '${user.name || user.email || 'User'}';
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            
            // Create user menu HTML
            container.innerHTML = \`
              <div class="relative">
                <button id="user-menu-button" class="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" aria-expanded="false" aria-haspopup="true">
                  <span class="sr-only">Open user menu</span>
                  <div class="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-medium">
                    \${initials}
                  </div>
                </button>
                
                <div id="user-menu-dropdown" class="hidden origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                  <div class="py-1">
                    <div class="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                      <div class="font-medium">${user.name || 'User'}</div>
                      <div class="text-gray-500">${user.email || ''}</div>
                    </div>
                    <a href="/admin" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Dashboard</a>
                    <form method="POST" action="/auth/signout" class="block">
                      <button type="submit" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        Sign out
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            \`;
            
            // Add click handler for dropdown toggle
            const button = container.querySelector('#user-menu-button');
            const dropdown = container.querySelector('#user-menu-dropdown');
            
            if (button && dropdown) {
              button.addEventListener('click', function(e) {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
              });
              
              // Close dropdown when clicking outside
              document.addEventListener('click', function() {
                dropdown.classList.add('hidden');
              });
            }
          })();
        `,
        }}
      />
    </>
  );
};
