import type { FC } from 'hono/jsx';

type ClerkUserMenuProps = {
  publishableKey: string;
  user?: any;
};

export const ClerkUserMenu: FC<ClerkUserMenuProps> = ({ publishableKey, user }) => {
  if (!user) {
    return null; // Don't show anything when not signed in
  }

  const scriptContent = `
    (async function initClerkUserMenu() {
      // Get DOM elements
      const container = document.getElementById('clerk-user-menu');
      const fallback = document.getElementById('clerk-fallback');
      const loading = document.getElementById('clerk-loading');
      
      // Show fallback after 300ms if Clerk hasn't loaded
      const fallbackTimer = setTimeout(() => {
        if (fallback && loading) {
          loading.style.display = 'none';
          fallback.style.display = 'flex';
          fallback.style.opacity = '1';
        }
      }, 300);
      
      try {
        // Check if Clerk is already loaded
        if (window.Clerk) {
          clearTimeout(fallbackTimer);
          await mountClerkButton();
          return;
        }
        
        // Load Clerk script if not already present
        if (!document.querySelector('script[data-clerk-publishable-key]')) {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/@clerk/clerk-js@latest/dist/clerk.browser.js';
          script.setAttribute('data-clerk-publishable-key', ${JSON.stringify(publishableKey)});
          
          script.onload = async () => {
            clearTimeout(fallbackTimer);
            await mountClerkButton();
          };
          
          document.head.appendChild(script);
        }
        
        async function mountClerkButton() {
          // Wait for Clerk to be available
          let retries = 0;
          while (!window.Clerk && retries < 30) {
            await new Promise(resolve => setTimeout(resolve, 50));
            retries++;
          }
          
          if (!window.Clerk) {
            console.error('Clerk not available after retries');
            return;
          }
          
          const clerk = window.Clerk;
          
          // Wait for Clerk to be ready
          if (!clerk.isReady) {
            await clerk.load();
          }
          
          // Mount the user button with smooth transition
          if (container && clerk.user) {
            // Hide loading placeholder
            if (loading) {
              loading.style.display = 'none';
            }
            
            // Fade out fallback if visible
            if (fallback && fallback.style.display !== 'none') {
              fallback.style.opacity = '0';
              fallback.style.transition = 'opacity 200ms ease-out';
              setTimeout(() => {
                fallback.style.display = 'none';
              }, 200);
            }
            
            // Create Clerk container
            const clerkContainer = document.createElement('div');
            clerkContainer.id = 'clerk-button-container';
            clerkContainer.style.opacity = '0';
            clerkContainer.style.transition = 'opacity 200ms ease-in';
            
            container.appendChild(clerkContainer);
            
            // Mount Clerk's UserButton component
            await clerk.mountUserButton(clerkContainer, {
              appearance: {
                elements: {
                  userButtonAvatarBox: 'w-8 h-8',
                  userButtonPopoverCard: 'shadow-lg border border-gray-200',
                  userButtonPopoverActionButton: 'hover:bg-gray-50',
                }
              },
              userProfileMode: 'navigation',
              userProfileUrl: '/user-profile',
              afterSignOutUrl: '/',
            });
            
            // Fade in Clerk button
            setTimeout(() => {
              clerkContainer.style.opacity = '1';
            }, 50);
          }
        }
        
      } catch (error) {
        clearTimeout(fallbackTimer);
        console.error('Error mounting Clerk user menu:', error);
        // Hide loading and show fallback on error
        if (loading) {
          loading.style.display = 'none';
        }
        if (fallback) {
          fallback.style.display = 'flex';
          fallback.style.opacity = '1';
        }
      }
    })();
  `;

  return (
    <div class="flex items-center space-x-4">
      {/* Admin link for admin users */}
      {user.role === 'admin' && (
        <a
          href="/admin"
          class="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium transition-colors"
        >
          Admin
        </a>
      )}
      
      {/* Clerk User Menu Container */}
      <div id="clerk-user-menu" class="flex items-center relative">
        {/* Fallback content - hidden initially, shown only if Clerk takes too long */}
        <div 
          id="clerk-fallback" 
          class="items-center space-x-2" 
          style="display: none; opacity: 0; transition: opacity 200ms ease-in-out;"
        >
          {/* Simplified avatar matching Clerk's style */}
          <div class="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center cursor-pointer hover:bg-primary-700 transition-colors">
            <span class="text-sm font-medium text-white">
              {user.firstName?.charAt(0) || user.email?.charAt(0) || 'U'}
            </span>
          </div>
        </div>
        
        {/* Loading placeholder - very minimal to reduce flicker */}
        <div id="clerk-loading" class="h-8 w-8 rounded-full bg-gray-200 animate-pulse"></div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: scriptContent }} />
    </div>
  );
};