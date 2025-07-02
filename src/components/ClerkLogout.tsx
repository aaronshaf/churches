export const ClerkLogout = ({ publishableKey }: { publishableKey: string }) => {
  // Create the script content with proper key injection
  const scriptContent = `
    // Store the publishable key
    window.__CLERK_PUBLISHABLE_KEY__ = ${JSON.stringify(publishableKey)};
    
    console.log('Publishable key passed to component:', ${JSON.stringify(publishableKey)});
    console.log('Window key after assignment:', window.__CLERK_PUBLISHABLE_KEY__);
    console.log('Starting logout process...');
    
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
    script.onload = async () => {
      try {
        console.log('Clerk script loaded');
        console.log('Initializing Clerk with key:', window.__CLERK_PUBLISHABLE_KEY__);
        const clerk = window.Clerk(window.__CLERK_PUBLISHABLE_KEY__);
        console.log('Clerk instance created:', clerk);
        await clerk.load();
        console.log('Clerk loaded successfully');
        
        // Attempt to sign out
        console.log('Attempting to sign out...');
        await clerk.signOut();
        
        // Clear all Clerk session data
        localStorage.clear();
        sessionStorage.clear();
        console.log('Sign out successful, redirecting...');
        window.location.href = '/';
      } catch (error) {
        console.error('Error during Clerk initialization:', error);
        console.error('Error details:', error.message, error.stack);
      }
    };
    script.onerror = (error) => {
      console.error('Failed to load Clerk script:', error);
    };
    document.head.appendChild(script);
  `;
  
  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div class="text-center">
          <h2 class="mt-6 text-3xl font-extrabold text-gray-900">Signing out...</h2>
          <p class="mt-2 text-sm text-gray-600">Please wait while we sign you out.</p>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: scriptContent }} />
    </div>
  );
};