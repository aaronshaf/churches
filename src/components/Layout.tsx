import type { FC } from 'hono/jsx';
import type { SupportedLanguage } from '../lib/i18n';
import type { BetterAuthUser } from '../types';
import { Footer } from './Footer';
import { Navbar } from './Navbar';
import { QuickEditShortcut } from './QuickEditShortcut';
import { QuickSearch } from './QuickSearch';

type LayoutProps = {
  title?: string;
  siteTitle?: string;
  children: any;
  user?: BetterAuthUser | null;
  currentPath?: string;
  jsonLd?: Record<string, unknown>;
  churchId?: string;
  countyId?: string;
  affiliationId?: string;
  faviconUrl?: string;
  logoUrl?: string;
  description?: string;
  ogImage?: string;
  pages?: Array<{ id: number; title: string; path: string; navbarOrder: number | null }>;
  showMap?: boolean;
  hideFooter?: boolean;
  language?: SupportedLanguage;
  t?: (key: string, options?: object) => string;
  sessionBookmark?: string;
};

export const Layout: FC<LayoutProps> = ({
  title,
  siteTitle = 'Churches',
  children,
  user,
  currentPath,
  jsonLd,
  churchId,
  countyId,
  affiliationId,
  faviconUrl,
  logoUrl,
  description = 'Discover Christian churches. Find church locations, service times, and contact information.',
  ogImage,
  pages = [],
  showMap = true,
  hideFooter = false,
  language = 'en',
  t,
  sessionBookmark,
}) => {
  const pageTitle = title ? `${title} - ${siteTitle}` : siteTitle;
  return (
    <html lang={language}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{pageTitle}</title>
        <meta name="description" content={description} />

        {/* Open Graph meta tags for Facebook */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={currentPath ? `${currentPath}` : '/'} />
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
        <link rel="stylesheet" href="/css/styles.css" />
        <link rel="stylesheet" href="/fonts/inter.css" />
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
            let preloadTimeout;
            let prefetchedUrls = new Set();
            
            // Store the current D1 bookmark for sequential consistency
            const currentBookmark = ${sessionBookmark ? `'${sessionBookmark}'` : 'null'};
            
            function preloadAfterDelay(url, delay) {
              if (preloadTimeout) {
                clearTimeout(preloadTimeout);
              }
              
              preloadTimeout = setTimeout(() => {
                if (!prefetchedUrls.has(url)) {
                  const link = document.createElement('link');
                  link.rel = 'prefetch';
                  link.href = url;
                  
                  // Add bookmark header if available
                  if (currentBookmark) {
                    // For prefetch links, we can't set headers directly
                    // The bookmark will be passed via cookie instead
                  }
                  
                  document.head.appendChild(link);
                  prefetchedUrls.add(url);
                }
              }, delay);
            }
            
            function cancelPreload() {
              if (preloadTimeout) {
                clearTimeout(preloadTimeout);
                preloadTimeout = null;
              }
            }
            
            // Helper to add bookmark to navigation requests
            function navigateWithBookmark(url) {
              if (currentBookmark) {
                // The bookmark is already set as a cookie by the server
                // Just navigate normally
                window.location.href = url;
              } else {
                window.location.href = url;
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
            
            // Search button tooltip functionality
            document.addEventListener('DOMContentLoaded', function() {
              const searchButtons = document.querySelectorAll('[data-testid="search-button"], [data-testid="mobile-search-button"]');
              
              searchButtons.forEach(button => {
                let tooltip = null;
                
                // Show tooltip on hover
                button.addEventListener('mouseenter', function() {
                  // Create tooltip
                  tooltip = document.createElement('div');
                  tooltip.className = 'absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg pointer-events-none whitespace-nowrap';
                  tooltip.style.top = '100%';
                  tooltip.style.left = '50%';
                  tooltip.style.transform = 'translateX(-50%) translateY(8px)';
                  tooltip.innerHTML = 'Search <kbd class="ml-1 px-1 py-0.5 text-xs font-bold bg-gray-700 rounded">/ </kbd>';
                  
                  // Add arrow pointing up
                  const arrow = document.createElement('div');
                  arrow.className = 'absolute w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900';
                  arrow.style.bottom = '100%';
                  arrow.style.left = '50%';
                  arrow.style.transform = 'translateX(-50%)';
                  tooltip.appendChild(arrow);
                  
                  // Position relative to button
                  button.style.position = 'relative';
                  button.appendChild(tooltip);
                });
                
                // Hide tooltip on leave
                button.addEventListener('mouseleave', function() {
                  if (tooltip) {
                    tooltip.remove();
                    tooltip = null;
                  }
                });
              });
            });
          `,
          }}
        />
      </head>
      <body class="bg-gray-50 text-gray-900 antialiased min-h-screen flex flex-col" data-testid="layout-body">
        <a
          href="#main-content"
          class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-600 text-white px-4 py-2 rounded-md"
          data-testid="skip-link"
        >
          Skip to main content
        </a>
        <Navbar user={user} currentPath={currentPath} logoUrl={logoUrl} pages={pages} showMap={showMap} t={t} />
        <main id="main-content" class="flex-grow" data-testid="main-content">
          {children}
        </main>
        {!hideFooter && (
          <Footer
            user={user}
            churchId={churchId}
            countyId={countyId}
            affiliationId={affiliationId}
            currentPath={currentPath}
            t={t}
          />
        )}
        {currentPath === '/admin/churches' && <script src="/js/church-filters.js"></script>}
        <QuickSearch userRole={user?.role} language={language} t={t} />
        <QuickEditShortcut userRole={user?.role} />
      </body>
    </html>
  );
};
