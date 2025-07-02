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
      const container = document.getElementById('clerk-user-menu');
      if (!container) return;
      
      try {
        // Check if Clerk is already loaded
        if (window.Clerk && window.Clerk.isReady && window.Clerk.user) {
          await mountClerkButton();
          return;
        }
        
        // Load Clerk script if not already present
        if (!document.querySelector('script[data-clerk-publishable-key]')) {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/@clerk/clerk-js@latest/dist/clerk.browser.js';
          script.setAttribute('data-clerk-publishable-key', ${JSON.stringify(publishableKey)});
          
          script.onload = async () => {
            await mountClerkButton();
          };
          
          document.head.appendChild(script);
        }
        
        async function mountClerkButton() {
          // Wait for Clerk to be available
          let retries = 0;
          while (!window.Clerk && retries < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
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
          
          // Only mount if user is authenticated
          if (container && clerk.user) {
            // Clear the placeholder content
            container.innerHTML = '';
            
            // Mount Clerk's UserButton component directly
            await clerk.mountUserButton(container, {
              appearance: {
                elements: {
                  userButtonAvatarBox: 'w-8 h-8',
                  userButtonPopoverCard: 'shadow-lg border border-gray-200',
                  userButtonPopoverActionButton: 'hover:bg-gray-50',
                }
              },
              userProfileMode: 'modal',
              afterSignOutUrl: '/',
            });
          }
        }
        
      } catch (error) {
        console.error('Error mounting Clerk user menu:', error);
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
      
      {/* Clerk User Menu Container - Start with neutral placeholder */}
      <div id="clerk-user-menu" class="flex items-center">
        {/* Neutral placeholder that matches Clerk's UserButton size exactly */}
        <div class="h-8 w-8"></div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: scriptContent }} />
    </div>
  );
};