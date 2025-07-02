import type { FC } from 'hono/jsx';

type ClerkUserMenuProps = {
  publishableKey: string;
  user?: any;
};

export const ClerkUserMenu: FC<ClerkUserMenuProps> = ({ publishableKey, user }) => {
  // Always render the component, let Clerk decide if user is authenticated
  // The user prop from server might be stale or null on some routes

  const scriptContent = `
    (async function initClerkUserMenu() {
      const container = document.getElementById('clerk-user-menu');
      if (!container) return;
      
      try {
        console.log('ClerkUserMenu: Initializing...', { 
          hasClerk: !!window.Clerk, 
          isReady: window.Clerk?.isReady,
          hasUser: !!window.Clerk?.user 
        });
        
        // Check if Clerk is already loaded and ready
        if (window.Clerk) {
          // Clerk exists, but might not be ready
          if (window.Clerk.isReady) {
            console.log('ClerkUserMenu: Clerk already ready');
            await mountClerkButton();
          } else {
            // Wait for Clerk to be ready
            console.log('ClerkUserMenu: Waiting for Clerk to be ready');
            await window.Clerk.load();
            await mountClerkButton();
          }
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
        } else {
          // Script exists but Clerk might still be loading
          // Wait for it to be available
          await mountClerkButton();
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
          
          console.log('ClerkUserMenu: About to mount', { 
            hasContainer: !!container, 
            hasUser: !!clerk.user,
            userId: clerk.user?.id 
          });
          
          // Only mount if user is authenticated
          if (container && clerk.user) {
            // Fade out loading indicator
            const loader = container.querySelector('.bg-gray-300');
            if (loader) {
              loader.style.transition = 'opacity 200ms ease-out';
              loader.style.opacity = '0';
              setTimeout(() => {
                container.innerHTML = '';
              }, 200);
            } else {
              container.innerHTML = '';
            }
            
            // Small delay to ensure smooth transition
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Create a wrapper for fade-in effect
            const wrapper = document.createElement('div');
            wrapper.style.opacity = '0';
            wrapper.style.transition = 'opacity 300ms ease-in';
            wrapper.className = 'w-6 h-6';
            container.appendChild(wrapper);
            
            // Mount Clerk's UserButton component directly
            await clerk.mountUserButton(wrapper, {
              appearance: {
                elements: {
                  userButtonAvatarBox: 'w-6 h-6',
                  userButtonPopoverCard: 'shadow-lg border border-gray-200',
                  userButtonPopoverActionButton: 'hover:bg-gray-50',
                  userButtonTrigger: 'opacity-70 hover:opacity-100 transition-opacity',
                  rootBox: 'w-6 h-6',
                }
              },
              userProfileMode: 'modal',
              afterSignOutUrl: '/',
            });
            
            // Fade in the button
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                wrapper.style.opacity = '1';
              });
            });
          }
        }
        
      } catch (error) {
        console.error('Error mounting Clerk user menu:', error);
      }
    })();
  `;

  return (
    <>
      {/* Clerk User Menu Container - reserve space to prevent layout shift */}
      <div id="clerk-user-menu" class="inline-flex items-center w-6 h-6 relative">
        {/* Very subtle loading indicator */}
        <div class="absolute inset-0 rounded-full bg-gray-300 opacity-30"></div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: scriptContent }} />
    </>
  );
};