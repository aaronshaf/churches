import { Hono } from 'hono';
import { Layout } from '../../components/Layout';
import { getUser, requireAdminBetter } from '../../middleware/better-auth';
import type { AuthVariables, Bindings } from '../../types';
import { cacheInvalidation } from '../../utils/cache-invalidation';
import { getCommonLayoutProps } from '../../utils/layout-props';

type Variables = AuthVariables;

export const adminCacheRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Admin page to manage cache
adminCacheRoutes.get('/', requireAdminBetter, async (c) => {
  const layoutProps = await getCommonLayoutProps(c);
  const { user } = layoutProps;

  return c.html(
    <Layout title="Cache Management - Admin" currentPath="/admin" {...layoutProps}>
      <div class="bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
            <div class="px-4 py-5 sm:p-6">
              <h1 class="text-2xl font-semibold text-gray-900 mb-6">Cache Management</h1>

              <div class="space-y-6">
                <div>
                  <h2 class="text-lg font-medium text-gray-900 mb-2">Clear All Cache</h2>
                  <p class="text-sm text-gray-600 mb-4">
                    This will clear all cached pages, forcing them to regenerate with the latest content and settings.
                    Use this if you've updated the logo, favicon, or other site-wide settings and want the changes to
                    appear immediately.
                  </p>
                  <form method="post" action="/admin/cache/clear-all">
                    <button
                      type="submit"
                      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Clear All Cache
                    </button>
                  </form>
                </div>

                <div class="border-t pt-6">
                  <h2 class="text-lg font-medium text-gray-900 mb-2">Cache Information</h2>
                  <dl class="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-200">
                    <div class="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt class="text-sm font-medium text-gray-500">Cache Strategy</dt>
                      <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        Cloudflare Cache API with KV storage for settings
                      </dd>
                    </div>
                    <div class="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt class="text-sm font-medium text-gray-500">Page Cache TTL</dt>
                      <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <ul class="list-disc list-inside">
                          <li>Homepage: 3 days</li>
                          <li>Church/County/Network pages: 7 days</li>
                          <li>Map: 3 days</li>
                          <li>API endpoints: 3-7 days</li>
                        </ul>
                      </dd>
                    </div>
                    <div class="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt class="text-sm font-medium text-gray-500">Settings Cache TTL</dt>
                      <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">7 days (KV storage)</dd>
                    </div>
                    <div class="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt class="text-sm font-medium text-gray-500">Automatic Invalidation</dt>
                      <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        Cache is automatically cleared when:
                        <ul class="list-disc list-inside mt-1">
                          <li>Churches are created, updated, or deleted</li>
                          <li>Counties or affiliations are modified</li>
                          <li>Settings are updated</li>
                        </ul>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
});

// Clear all cache endpoint
adminCacheRoutes.post('/clear-all', requireAdminBetter, async (c) => {
  try {
    // Clear all cache (same as when settings are updated)
    await cacheInvalidation.settings(c);

    // Also invalidate KV settings cache
    const { invalidateSettingsCache } = await import('../../utils/settings-cache');
    await invalidateSettingsCache(c.env.SETTINGS_CACHE);

    return c.redirect('/admin/cache?success=true');
  } catch (error) {
    console.error('Error clearing cache:', error);
    return c.redirect('/admin/cache?error=true');
  }
});
