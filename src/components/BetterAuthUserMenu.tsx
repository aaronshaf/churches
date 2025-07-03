import type { FC } from 'hono/jsx';
import { getGravatarUrl } from '../utils/crypto';

type BetterAuthUserMenuProps = {
  user?: any;
};

export const BetterAuthUserMenu: FC<BetterAuthUserMenuProps> = ({ user }) => {
  if (!user) return null;

  return (
    <>
      {/* User Menu Container - reserve space to prevent layout shift */}
      <div id="better-auth-user-menu" class="inline-flex items-center w-8 h-8 relative">
        {/* Very subtle loading indicator */}
        <div class="absolute inset-0 rounded-full bg-gray-200 opacity-20"></div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          (function() {
            const container = document.getElementById('better-auth-user-menu');
            if (!container) return;
            
            // User data for avatar
            const name = '${user.name || user.email || 'User'}';
            const email = '${user.email || ''}';
            const role = '${user.role || 'user'}';
            const image = '${user.image || ''}';
            const gravatarUrl = '${getGravatarUrl(user.email || '', 32)}';
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            
            // Create user menu HTML with Clerk-like styling
            container.innerHTML = \`
              <div class="relative">
                <button id="user-menu-button" class="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all" aria-expanded="false" aria-haspopup="true">
                  <span class="sr-only">Open user menu</span>
                  \${image ? \`
                    <img class="h-8 w-8 rounded-full object-cover shadow-sm hover:shadow-md transition-shadow" src="\${image}" alt="\${name}" onerror="this.src='\${gravatarUrl}'; this.onerror=null;" />
                  \` : \`
                    <img class="h-8 w-8 rounded-full object-cover shadow-sm hover:shadow-md transition-shadow" src="\${gravatarUrl}" alt="\${name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <div class="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 hidden items-center justify-center text-sm text-white font-medium shadow-sm hover:shadow-md transition-shadow" style="display: none;">
                      \${initials}
                    </div>
                  \`}
                </button>
                
                <div id="user-menu-dropdown" class="hidden origin-top-right absolute right-0 mt-2 w-72 rounded-xl shadow-xl bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
                  <div class="px-4 py-3 border-b border-gray-100">
                    <div class="flex items-center space-x-3">
                      \${image ? \`
                        <img class="h-10 w-10 rounded-full object-cover" src="\${image}" alt="\${name}" onerror="this.src='\${gravatarUrl}'; this.onerror=null;" />
                      \` : \`
                        <img class="h-10 w-10 rounded-full object-cover" src="\${gravatarUrl}" alt="\${name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                        <div class="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 hidden items-center justify-center text-sm text-white font-medium" style="display: none;">
                          \${initials}
                        </div>
                      \`}
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">${user.name || 'User'}</p>
                        <p class="text-sm text-gray-500 truncate">\${email}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div class="py-1">
                    <a href="/admin" class="group flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg class="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Dashboard
                    </a>
                    \${role === 'admin' ? \`
                    <a href="/admin/churches" class="group flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg class="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Manage Churches
                    </a>
                    <a href="/admin/users" class="group flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg class="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Manage Users
                    </a>
                    \` : ''}
                  </div>
                  
                  <div class="border-t border-gray-100">
                    <button onclick="window.location.href='/auth/signout'" class="group flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg class="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
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
                button.setAttribute('aria-expanded', dropdown.classList.contains('hidden') ? 'false' : 'true');
              });
              
              // Close dropdown when clicking outside
              document.addEventListener('click', function() {
                dropdown.classList.add('hidden');
                button.setAttribute('aria-expanded', 'false');
              });
              
              // Prevent dropdown from closing when clicking inside
              dropdown.addEventListener('click', function(e) {
                e.stopPropagation();
              });
            }
          })();
        `,
        }}
      />
    </>
  );
};
