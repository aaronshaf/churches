import { Hono } from 'hono';
import { Layout } from '../../components/Layout';
import { requireAdminWithRedirect } from '../../middleware/redirect-auth';
import type { AuthenticatedVariables, Bindings } from '../../types';
import { getLogoUrl } from '../../utils/settings';

type Variables = AuthenticatedVariables;

export const adminDebugRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply admin middleware to all routes
adminDebugRoutes.use('*', requireAdminWithRedirect);

// Debug endpoint to check church_images table structure
adminDebugRoutes.get('/church-images-schema', async (c) => {
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);

  try {
    const d1 = c.env.DB;

    // Get table schema
    const schemaResult = await d1.prepare('PRAGMA table_info(church_images)').all();

    // Get the create statement
    const createStatement = await d1
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='church_images'")
      .first();

    // Try a test insert to see what happens
    let testInsertError = null;
    try {
      await d1
        .prepare(
          `INSERT INTO church_images (church_id, image_path, image_alt, caption, is_featured, sort_order) 
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(999999, 'test/path.jpg', 'test alt', 'test caption', 0, 0)
        .run();

      // If successful, delete the test record
      await d1.prepare('DELETE FROM church_images WHERE church_id = ?').bind(999999).run();
    } catch (error) {
      testInsertError = error instanceof Error ? error.message : 'Unknown error';
    }

    const debugInfo = {
      tableInfo: schemaResult.results,
      createStatement: createStatement,
      testInsertError: testInsertError,
      timestamp: new Date().toISOString(),
    };

    return c.html(
      <Layout title="Church Images Debug" currentPath="/admin" logoUrl={logoUrl} user={user}>
        <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 class="text-2xl font-semibold text-gray-900 mb-6">Church Images Table Debug</h1>

          <div class="bg-white shadow overflow-hidden sm:rounded-lg">
            <div class="px-4 py-5 sm:px-6">
              <h3 class="text-lg leading-6 font-medium text-gray-900">Table Schema</h3>
            </div>
            <div class="border-t border-gray-200">
              <dl>
                <div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt class="text-sm font-medium text-gray-500">Timestamp</dt>
                  <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{debugInfo.timestamp}</dd>
                </div>

                <div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt class="text-sm font-medium text-gray-500">Create Statement</dt>
                  <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <pre class="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                      {debugInfo.createStatement?.sql || 'No create statement found'}
                    </pre>
                  </dd>
                </div>

                <div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt class="text-sm font-medium text-gray-500">Table Columns</dt>
                  <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Not Null</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Primary Key</th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        {debugInfo.tableInfo?.map((col) => (
                          <tr>
                            <td class="px-3 py-2 text-sm text-gray-900">{col.name}</td>
                            <td class="px-3 py-2 text-sm text-gray-900">{col.type}</td>
                            <td class="px-3 py-2 text-sm text-gray-900">{col.notnull ? 'Yes' : 'No'}</td>
                            <td class="px-3 py-2 text-sm text-gray-900">{col.dflt_value || '-'}</td>
                            <td class="px-3 py-2 text-sm text-gray-900">{col.pk ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </dd>
                </div>

                <div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt class="text-sm font-medium text-gray-500">Test Insert Result</dt>
                  <dd class="mt-1 text-sm sm:mt-0 sm:col-span-2">
                    {testInsertError ? (
                      <span class="text-red-600">Error: {testInsertError}</span>
                    ) : (
                      <span class="text-green-600">Success - Test insert worked without ID field</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div class="mt-6">
            <a href="/admin/churches" class="text-blue-600 hover:text-blue-500">
              ← Back to Churches
            </a>
          </div>
        </div>
      </Layout>
    );
  } catch (error) {
    return c.html(
      <Layout title="Error" currentPath="/admin" logoUrl={logoUrl} user={user}>
        <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div class="rounded-md bg-red-50 p-4">
            <h3 class="text-sm font-medium text-red-800">Debug Error</h3>
            <p class="mt-2 text-sm text-red-700">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </div>
      </Layout>
    );
  }
});
