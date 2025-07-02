export const ClerkLogin = ({ publishableKey, redirectUrl }: { publishableKey: string; redirectUrl: string }) => {
  const scriptContent = `
    // Store configuration
    window.__CLERK_PUBLISHABLE_KEY__ = ${JSON.stringify(publishableKey)};
    window.__REDIRECT_URL__ = ${JSON.stringify(redirectUrl)};
    
    console.log('Clerk Login Configuration:');
    console.log('- Publishable Key:', window.__CLERK_PUBLISHABLE_KEY__);
    console.log('- Redirect URL:', window.__REDIRECT_URL__);
    
    // Extract domain from publishable key
    let clerkDomain = 'clerk.utahchurches.com'; // fallback
    
    try {
      // The key format is pk_[test|live]_[base64_encoded_domain]
      const keyParts = window.__CLERK_PUBLISHABLE_KEY__.split('_');
      if (keyParts.length >= 3) {
        // Join all parts after pk_test_ or pk_live_ in case there are underscores in the base64
        const base64Part = keyParts.slice(2).join('_');
        console.log('Base64 part:', base64Part);
        
        // Decode base64 to get clerk domain
        const decoded = atob(base64Part);
        console.log('Decoded domain:', decoded);
        
        // Remove trailing $ if present
        clerkDomain = decoded.endsWith('$') ? decoded.slice(0, -1) : decoded;
        clerkDomain = clerkDomain.trim();
      }
    } catch (e) {
      console.error('Failed to decode Clerk domain from key:', e);
      console.error('Key was:', window.__CLERK_PUBLISHABLE_KEY__);
    }
    
    console.log('Final Clerk domain:', clerkDomain);
    
    // Load Clerk
    const script = document.createElement('script');
    script.src = \`https://\${clerkDomain}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js\`;
    script.setAttribute('data-clerk-publishable-key', window.__CLERK_PUBLISHABLE_KEY__);
    script.onload = async () => {
      try {
        console.log('Clerk script loaded');
        
        // Wait a moment for Clerk to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if Clerk is available
        if (!window.Clerk) {
          throw new Error('Clerk not found on window object after script load');
        }
        
        console.log('Clerk available, checking initialization...');
        const clerk = window.Clerk;
        
        // Check if Clerk is already initialized (auto-initialized with data attribute)
        if (!clerk.isReady) {
          console.log('Loading Clerk...');
          if (clerk.load) {
            await clerk.load();
          }
        }
        
        // Wait for components to be ready
        console.log('Waiting for Clerk components...');
        if (clerk.__unstable__updateProps) {
          // This ensures components are ready
          await clerk.__unstable__updateProps();
        } else {
          // Alternative: wait a bit more
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Check if already signed in
        if (clerk.user) {
          console.log('User already signed in, redirecting...');
          window.location.href = window.__REDIRECT_URL__;
          return;
        }
        
        // For localhost, mount the sign-in UI
        console.log('Mounting sign-in UI...');
        
        // Clear the page content
        document.body.innerHTML = '';
        
        // Create a container for the sign-in component
        const container = document.createElement('div');
        container.id = 'clerk-sign-in';
        container.style.cssText = 'display: flex; justify-content: center; align-items: center; min-height: 100vh;';
        document.body.appendChild(container);
        
        // Mount the sign-in component
        await clerk.mountSignIn(container, {
          afterSignInUrl: window.__REDIRECT_URL__,
          afterSignUpUrl: window.__REDIRECT_URL__,
          redirectUrl: window.__REDIRECT_URL__,
        });
        
        console.log('Sign-in UI mounted');
      } catch (error) {
        console.error('Error during Clerk initialization:', error);
        console.error('Error details:', error.message, error.stack);
        
        // Show error message with debug info
        const errorMessageEl = document.getElementById('error-message');
        const errorDetailsEl = document.getElementById('error-details');
        
        if (errorMessageEl && errorDetailsEl) {
          errorMessageEl.style.display = 'block';
          errorDetailsEl.innerHTML = \`
            <strong>Error:</strong> \${error.message}<br>
            <strong>Key:</strong> \${window.__CLERK_PUBLISHABLE_KEY__}<br>
            <strong>Domain:</strong> \${clerkDomain}<br>
            <strong>Script URL:</strong> https://\${clerkDomain}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js
          \`;
        } else {
          // If we already cleared the body, recreate error UI
          document.body.innerHTML = \`
            <div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: sans-serif;">
              <h2>Authentication Error</h2>
              <p><strong>Error:</strong> \${error.message}</p>
              <p><strong>Key:</strong> \${window.__CLERK_PUBLISHABLE_KEY__}</p>
              <p><strong>Domain:</strong> \${clerkDomain}</p>
              <p><a href="/login">Try again</a> or <a href="/?USE_CLERK_AUTH=false">use legacy login</a></p>
            </div>
          \`;
        }
      }
    };
    script.onerror = (error) => {
      console.error('Failed to load Clerk script:', error);
      const errorMessageEl = document.getElementById('error-message');
      const errorDetailsEl = document.getElementById('error-details');
      
      if (errorMessageEl && errorDetailsEl) {
        errorMessageEl.style.display = 'block';
        errorDetailsEl.innerHTML = \`
          <strong>Script Load Error</strong><br>
          <strong>Key:</strong> \${window.__CLERK_PUBLISHABLE_KEY__}<br>
          <strong>Domain:</strong> \${clerkDomain}<br>
          <strong>Script URL:</strong> https://\${clerkDomain}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js<br>
          <strong>Note:</strong> Check if the domain is correct and accessible.
        \`;
      }
    };
    document.head.appendChild(script);
  `;
  
  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div class="text-center">
          <h2 class="mt-6 text-3xl font-extrabold text-gray-900">Signing in...</h2>
          <p class="mt-2 text-sm text-gray-600">Redirecting to secure login page...</p>
        </div>
        
        <div id="error-message" style="display: none;" class="rounded-md bg-red-50 p-4">
          <div class="flex">
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">Authentication Error</h3>
              <div class="mt-2 text-sm text-red-700">
                <p id="error-details">Unable to load authentication service.</p>
                <p class="mt-2">
                  <a href="/login" class="font-medium underline">Try again</a> or use 
                  <a href="/?USE_CLERK_AUTH=false" class="font-medium underline">legacy login</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: scriptContent }} />
    </div>
  );
};