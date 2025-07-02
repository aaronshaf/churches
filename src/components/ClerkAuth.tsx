// Simplified Clerk authentication components using official SDK approach

export const ClerkSignIn = ({ publishableKey, redirectUrl }: { publishableKey: string; redirectUrl: string }) => {
  const scriptContent = `
    // Initialize Clerk with the publishable key
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
          throw new Error('Clerk not available after waiting');
        }
        
        const clerk = window.Clerk;
        
        // Wait for Clerk to be ready
        if (!clerk.isReady) {
          console.log('Waiting for Clerk to be ready...');
          await clerk.load();
          
          // Additional wait for components to be ready
          let componentRetries = 0;
          while (!clerk.isReady && componentRetries < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            componentRetries++;
          }
        }
        
        // Check if already signed in
        if (clerk.user) {
          window.location.href = ${JSON.stringify(redirectUrl)};
          return;
        }
        
        // Clear the loading message
        document.body.innerHTML = '';
        
        // Create a flex container to center the sign-in component
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; justify-content: center; align-items: center; min-height: 100vh; width: 100%;';
        document.body.appendChild(wrapper);
        
        // Create container for sign-in component
        const container = document.createElement('div');
        container.id = 'clerk-sign-in';
        wrapper.appendChild(container);
        
        // Mount the sign-in component
        await clerk.mountSignIn(container, {
          afterSignInUrl: ${JSON.stringify(redirectUrl)},
          afterSignUpUrl: ${JSON.stringify(redirectUrl)},
        });
      } catch (error) {
        console.error('Clerk initialization error:', error);
        document.body.innerHTML = \`
          <div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: sans-serif; text-align: center;">
            <h2>Authentication Error</h2>
            <p>Unable to load the authentication service.</p>
            <p><a href="/login">Try again</a></p>
          </div>
        \`;
      }
    };
    
    document.head.appendChild(script);
  `;
  
  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center">
        <h2 class="text-3xl font-bold text-gray-900">Loading...</h2>
        <p class="mt-2 text-gray-600">Please wait while we prepare the sign-in page.</p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: scriptContent }} />
    </div>
  );
};

export const ClerkSignOut = ({ publishableKey }: { publishableKey: string }) => {
  const scriptContent = `
    // Initialize Clerk and sign out
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
          throw new Error('Clerk not available');
        }
        
        const clerk = window.Clerk;
        
        // Wait for Clerk to be ready
        if (!clerk.isReady) {
          await clerk.load();
        }
        
        // Sign out and clear session
        await clerk.signOut();
        
        // Clear cookies for all domains
        document.cookie.split(";").forEach((c) => {
          const eqPos = c.indexOf("=");
          const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
          if (name.startsWith('__client') || name.startsWith('__session')) {
            // Clear for current domain
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
            // Clear for parent domain
            const domain = window.location.hostname.split('.').slice(-2).join('.');
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + domain;
          }
        });
        
        // Redirect to home
        window.location.href = '/';
      } catch (error) {
        console.error('Sign out error:', error);
        // Redirect anyway
        window.location.href = '/';
      }
    };
    
    document.head.appendChild(script);
  `;
  
  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center">
        <h2 class="text-3xl font-bold text-gray-900">Signing out...</h2>
        <p class="mt-2 text-gray-600">Please wait while we sign you out.</p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: scriptContent }} />
    </div>
  );
};