import { Hono } from 'hono';
import { Layout } from '../../components/Layout';
import { requireAdminWithRedirect } from '../../middleware/redirect-auth';
import { getLogoUrl } from '../../utils/settings';
import { getTimingStats, getTimingSummary, clearTimingStats } from '../../utils/db-timing';
import type { Bindings } from '../../types';

type Variables = {
  user: any;
};

export const adminDbPerformanceRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply admin middleware to all routes
adminDbPerformanceRoutes.use('*', requireAdminWithRedirect);

// Database Performance Dashboard
adminDbPerformanceRoutes.get('/', async (c) => {
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  
  const stats = getTimingStats();
  const summary = getTimingSummary();
  
  // Group stats by route
  const statsByRoute = stats.reduce((acc, stat) => {
    const route = stat.route || 'unknown';
    if (!acc[route]) acc[route] = [];
    acc[route].push(stat);
    return acc;
  }, {} as Record<string, typeof stats>);

  return c.html(
    <Layout title="Database Performance" currentPath="/admin" logoUrl={logoUrl} user={user}>
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div class="mb-8 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Database Performance</h1>
            <p class="mt-2 text-sm text-gray-700">Turso database call timing and performance metrics</p>
          </div>
          <div class="flex gap-2">
            <a
              href="/admin/db-performance?refresh=1"
              class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              🔄 Refresh
            </a>
            <form method="POST" action="/admin/db-performance/clear" class="inline">
              <button
                type="submit"
                onclick="return confirm('Clear all timing data?')"
                class="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
              >
                🗑️ Clear Data
              </button>
            </form>
          </div>
        </div>

        {/* Summary Cards */}
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="text-2xl">📊</div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">Total Queries</dt>
                    <dd class="text-lg font-medium text-gray-900">{summary.count}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="text-2xl">⚡</div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">Avg Response Time</dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {summary.avgDuration ? `${summary.avgDuration.toFixed(1)}ms` : 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="text-2xl">🚀</div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">P95 Response Time</dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {summary.p95Duration ? `${summary.p95Duration.toFixed(1)}ms` : 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="text-2xl">{summary.errorCount > 0 ? '❌' : '✅'}</div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">Error Rate</dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {summary.count > 0 ? `${((summary.errorCount / summary.count) * 100).toFixed(1)}%` : '0%'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance by Route */}
        <div class="bg-white shadow rounded-lg mb-8">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Performance by Route</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Queries</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min/Max</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Errors</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {Object.entries(statsByRoute).map(([route, routeStats]) => {
                    const successfulStats = routeStats.filter(s => !s.error);
                    const durations = successfulStats.map(s => s.duration);
                    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
                    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
                    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
                    const errorCount = routeStats.filter(s => s.error).length;
                    
                    return (
                      <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {route}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {routeStats.length}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {avgDuration.toFixed(1)}ms
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {minDuration.toFixed(1)}ms / {maxDuration.toFixed(1)}ms
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            errorCount > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {errorCount} errors
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Queries */}
        <div class="bg-white shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Recent Queries (Last 20)</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Query</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {stats.slice(-20).reverse().map((stat, index) => (
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stat.timestamp.toLocaleTimeString()}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {stat.query}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stat.route || '-'}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span class={`font-medium ${
                          stat.duration > 1000 ? 'text-red-600' : 
                          stat.duration > 500 ? 'text-yellow-600' : 
                          'text-green-600'
                        }`}>
                          {stat.duration.toFixed(1)}ms
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        {stat.error ? (
                          <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Error
                          </span>
                        ) : (
                          <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Success
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Analytics Engine Status */}
        <div class="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 class="text-lg font-medium text-purple-900 mb-2">Analytics Engine Status</h3>
          <div class="text-sm text-purple-800">
            {c.env.DB_ANALYTICS ? (
              <div class="flex items-center space-x-2">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  ✅ Enabled
                </span>
                <span>Database metrics are being sent to Cloudflare Analytics Engine for long-term analysis.</span>
              </div>
            ) : (
              <div class="flex items-center space-x-2">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  ⚠️ Not Configured
                </span>
                <span>Analytics Engine not configured. Metrics are only stored in memory (current session).</span>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 class="text-lg font-medium text-blue-900 mb-2">Performance Analysis</h3>
          <div class="text-sm text-blue-800 space-y-2">
            {summary.avgDuration > 500 && (
              <p>⚠️ Average response time is high ({summary.avgDuration.toFixed(1)}ms). Consider switching to D1 for better performance.</p>
            )}
            {summary.p95Duration > 1000 && (
              <p>🐌 95th percentile is very slow ({summary.p95Duration.toFixed(1)}ms). This could impact user experience.</p>
            )}
            {summary.errorCount > 0 && (
              <p>❌ You have {summary.errorCount} database errors. Check the logs for details.</p>
            )}
            {summary.avgDuration <= 200 && summary.errorCount === 0 && (
              <p>✅ Your database performance looks good! Average response time: {summary.avgDuration.toFixed(1)}ms</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
});

// Clear timing data
adminDbPerformanceRoutes.post('/clear', async (c) => {
  clearTimingStats();
  return c.redirect('/admin/db-performance');
});