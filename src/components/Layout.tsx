import type { FC } from 'hono/jsx';
import { Footer } from './Footer';
import { Navbar } from './Navbar';

type LayoutProps = {
  title?: string;
  children: any;
  user?: any;
  currentPath?: string;
  jsonLd?: any;
  churchId?: string;
  countyId?: string;
  affiliationId?: string;
  faviconUrl?: string;
  logoUrl?: string;
  description?: string;
  ogImage?: string;
  pages?: Array<{ id: number; title: string; path: string; navbarOrder: number | null }>;
};

export const Layout: FC<LayoutProps> = ({
  title = 'Utah Churches',
  children,
  user,
  currentPath,
  jsonLd,
  churchId,
  countyId,
  affiliationId,
  faviconUrl,
  logoUrl,
  description = 'Discover Christian churches in Utah. Find church locations, service times, and contact information across all Utah counties.',
  ogImage,
  pages = [],
}) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <meta name="description" content={description} />
        
        {/* Open Graph meta tags for Facebook */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://utahchurches.org" />
        {(ogImage || logoUrl) && <meta property="og:image" content={ogImage || logoUrl} />}
        
        {/* Twitter Card meta tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {(ogImage || logoUrl) && <meta name="twitter:image" content={ogImage || logoUrl} />}
        
        {faviconUrl && (
          <>
            <link rel="icon" type="image/png" href={faviconUrl} />
            <link rel="apple-touch-icon" href={faviconUrl} />
          </>
        )}
        <script src="https://cdn.tailwindcss.com"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    primary: {
                      50: '#eff6ff',
                      100: '#dbeafe',
                      200: '#bfdbfe',
                      300: '#93bbfd',
                      400: '#60a5fa',
                      500: '#3b82f6',
                      600: '#2563eb',
                      700: '#1d4ed8',
                      800: '#1e40af',
                      900: '#1e3a8a',
                      950: '#172554',
                    }
                  },
                  fontFamily: {
                    sans: ['Inter var', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
                  },
                }
              }
            }
          `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
        {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
        <script
          dangerouslySetInnerHTML={{
            __html: `
// Client-side form validation
(function() {
  'use strict';
  const validators = {
    email: function(value) {
      if (!value.trim()) return { valid: false, message: 'Email is required' };
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) return { valid: false, message: 'Invalid email format' };
      if (value.length > 255) return { valid: false, message: 'Email too long' };
      return { valid: true };
    },
    url: function(value) {
      if (!value.trim()) return { valid: true };
      try { new URL(value); return { valid: true }; } 
      catch { return { valid: false, message: 'Invalid URL format' }; }
    },
    phone: function(value) {
      if (!value.trim()) return { valid: true };
      const phoneRegex = /^[\\+]?[1-9][\\d]{0,15}$/;
      if (!phoneRegex.test(value.replace(/[\\s\\-\\(\\)]/g, ''))) {
        return { valid: false, message: 'Invalid phone number format' };
      }
      return { valid: true };
    },
    path: function(value) {
      if (!value.trim()) return { valid: false, message: 'Path is required' };
      if (value.length > 100) return { valid: false, message: 'Path too long' };
      if (!/^[a-z0-9-]+$/.test(value)) return { valid: false, message: 'Path must be lowercase with hyphens only' };
      if (value.startsWith('-') || value.endsWith('-')) return { valid: false, message: 'Path cannot start or end with hyphen' };
      return { valid: true };
    },
    username: function(value) {
      if (!value.trim()) return { valid: false, message: 'Username is required' };
      if (value.length < 3) return { valid: false, message: 'Username must be at least 3 characters' };
      if (value.length > 50) return { valid: false, message: 'Username too long' };
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) return { valid: false, message: 'Username can only contain letters, numbers, hyphens, and underscores' };
      return { valid: true };
    },
    required: function(value) {
      if (!value.trim()) return { valid: false, message: 'This field is required' };
      return { valid: true };
    }
  };

  function showError(field, message) {
    let errorDiv = field.parentElement.querySelector('.field-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'field-error text-red-600 text-sm mt-1';
      field.parentElement.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    field.classList.add('border-red-500');
    field.classList.remove('border-gray-300');
  }

  function hideError(field) {
    const errorDiv = field.parentElement.querySelector('.field-error');
    if (errorDiv) errorDiv.style.display = 'none';
    field.classList.remove('border-red-500');
    field.classList.add('border-gray-300');
  }

  function validateField(field) {
    const validationType = field.dataset.validate;
    if (!validationType) return true;
    const validator = validators[validationType];
    if (!validator) return true;
    const result = validator(field.value);
    if (result.valid) {
      hideError(field);
      return true;
    } else {
      showError(field, result.message);
      return false;
    }
  }

  function initValidation() {
    document.querySelectorAll('[data-validate]').forEach(field => {
      field.addEventListener('blur', () => validateField(field));
      field.addEventListener('input', () => hideError(field));
    });

    document.querySelectorAll('form[data-validate-form]').forEach(form => {
      form.addEventListener('submit', function(e) {
        let isValid = true;
        form.querySelectorAll('[data-validate]').forEach(field => {
          if (!validateField(field)) isValid = false;
        });
        if (!isValid) {
          e.preventDefault();
          const firstError = form.querySelector('.field-error[style*="block"]');
          if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initValidation);
  } else {
    initValidation();
  }
})();
          `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
            let prefetchTimer;
            let prefetchedUrls = new Set();
            
            function prefetchAfterDelay(url, delay) {
              cancelPrefetch();
              prefetchTimer = setTimeout(() => {
                if (!prefetchedUrls.has(url)) {
                  const link = document.createElement('link');
                  link.rel = 'prefetch';
                  link.href = url;
                  document.head.appendChild(link);
                  prefetchedUrls.add(url);
                }
              }, delay);
            }
            
            function cancelPrefetch() {
              if (prefetchTimer) {
                clearTimeout(prefetchTimer);
                prefetchTimer = null;
              }
            }
            
            // Keyboard navigation for button groups
            document.addEventListener('DOMContentLoaded', function() {
              const buttonGroups = document.querySelectorAll('[role="group"]');
              
              buttonGroups.forEach(group => {
                const buttons = Array.from(group.querySelectorAll('button'));
                
                buttons.forEach((button, index) => {
                  button.setAttribute('tabindex', '0');
                  
                  button.addEventListener('keydown', (e) => {
                    let nextIndex = -1;
                    
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      nextIndex = index === 0 ? buttons.length - 1 : index - 1;
                    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      nextIndex = index === buttons.length - 1 ? 0 : index + 1;
                    } else if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      button.click();
                      return;
                    }
                    
                    if (nextIndex !== -1) {
                      buttons[nextIndex].focus();
                    }
                  });
                });
                
                // Set aria attributes
                group.setAttribute('aria-label', 'Sort options');
                buttons.forEach((button, index) => {
                  button.setAttribute('aria-checked', button.classList.contains('bg-primary-600') ? 'true' : 'false');
                  button.setAttribute('role', 'radio');
                });
              });
            });
          `,
          }}
        />
      </head>
      <body class="bg-gray-50 text-gray-900 antialiased min-h-screen flex flex-col">
        <a
          href="#main-content"
          class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-600 text-white px-4 py-2 rounded-md"
          data-testid="skip-link"
        >
          Skip to main content
        </a>
        <Navbar user={user} currentPath={currentPath} logoUrl={logoUrl} pages={pages} />
        <main id="main-content" class="flex-grow" data-testid="main-content">
          {children}
        </main>
        <Footer user={user} churchId={churchId} countyId={countyId} affiliationId={affiliationId} />
      </body>
    </html>
  );
};
