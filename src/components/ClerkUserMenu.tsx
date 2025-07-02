import type { FC } from 'hono/jsx';

type ClerkUserMenuProps = {
  publishableKey: string;
  user?: any;
};

export const ClerkUserMenu: FC<ClerkUserMenuProps> = ({ publishableKey, user }) => {
  if (!user) {
    return (
      <a
        href="/login"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-600 bg-white hover:bg-gray-50 border-primary-300 transition-colors"
      >
        Sign in
      </a>
    );
  }

  const scriptContent = `
    // Initialize Clerk for user menu
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@clerk/clerk-js@latest/dist/clerk.browser.js';
    script.setAttribute('data-clerk-publishable-key', ${JSON.stringify(publishableKey)});
    
    script.onload = async () => {
      try {
        // Wait for Clerk to be available
        let retries = 0;
        while (!window.Clerk && retries < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }
        
        if (!window.Clerk) {
          console.error('Clerk not available');
          return;
        }
        
        const clerk = window.Clerk;
        
        // Wait for Clerk to be ready
        if (!clerk.isReady) {
          await clerk.load();
        }
        
        // Mount the user button
        const container = document.getElementById('clerk-user-menu');
        if (container && clerk.user) {
          // Clear the fallback content
          container.innerHTML = '';
          
          // Mount Clerk's UserButton component
          await clerk.mountUserButton(container, {
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
        }
      } catch (error) {
        console.error('Error mounting Clerk user menu:', error);
      }
    };
    
    document.head.appendChild(script);
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
      
      {/* Clerk User Menu */}
      <div id="clerk-user-menu" class="flex items-center">
        {/* Fallback content while Clerk loads */}
        <div class="flex items-center space-x-3">
          {/* User avatar */}
          <div class="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
            <span class="text-sm font-medium text-white">
              {user.firstName?.charAt(0) || user.email?.charAt(0) || 'U'}
            </span>
          </div>
          {/* User name */}
          <span class="text-sm font-medium text-gray-700 hidden sm:block">
            {user.firstName || user.username || user.email}
          </span>
          {/* Dropdown arrow */}
          <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: scriptContent }} />
    </div>
  );
};