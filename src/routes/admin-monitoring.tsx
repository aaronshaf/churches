import { Hono } from 'hono';
import type { Bindings } from '../types';
import { requireAdmin, getUser } from '../middleware/unified-auth';
import { getAuthEvents, getAuthStats } from '../middleware/auth-monitoring';
import { Layout } from '../components/Layout';

const adminMonitoringApp = new Hono<{ Bindings: Bindings }>();

// Apply admin middleware to all routes
adminMonitoringApp.use('*', requireAdmin);

// Auth monitoring dashboard
adminMonitoringApp.get('/', async (c) => {
  const user = getUser(c);
  const useBetterAuth = c.env.USE_BETTER_AUTH === 'true';
  
  // Get auth stats for last 24 hours
  const stats = getAuthStats();
  
  // Get recent events (last 50)
  const recentEvents = getAuthEvents(undefined, 50);
  
  return c.html(
    <Layout title="Auth Monitoring - Admin" user={user} currentPath="/admin/monitoring" useBetterAuth={useBetterAuth}>
      <div class="max-w-7xl mx-auto p-6">
        <h1 class="text-3xl font-bold mb-6">Authentication System Monitoring</h1>
        
        {/* Current System Status */}
        <div class="bg-white rounded-lg shadow mb-6 p-6">
          <h2 class="text-xl font-semibold mb-4">Current Configuration</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex items-center">
              <div class={`w-3 h-3 rounded-full mr-2 ${useBetterAuth ? 'bg-blue-500' : 'bg-green-500'}`}></div>
              <span class="font-medium">Active System: </span>
              <span class="ml-2">{useBetterAuth ? 'Better-Auth (Google OAuth)' : 'Clerk (SaaS)'}</span>
            </div>
            <div class="text-sm text-gray-600">
              Switch via USE_BETTER_AUTH environment variable
            </div>
          </div>
        </div>

        {/* Auth Statistics (Last 24 Hours) */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Clerk Stats */}
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold mb-4 flex items-center">
              <div class="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              Clerk Statistics
            </h3>
            <div class="space-y-2">
              <div class="flex justify-between">
                <span>Total Events:</span>
                <span class="font-medium">{stats.clerk.total}</span>
              </div>
              <div class="flex justify-between">
                <span>Successful Logins:</span>
                <span class="font-medium text-green-600">{stats.clerk.success}</span>
              </div>
              <div class="flex justify-between">
                <span>Failed Attempts:</span>
                <span class="font-medium text-red-600">{stats.clerk.failure}</span>
              </div>
              <div class="flex justify-between">
                <span>Success Rate:</span>
                <span class="font-medium">
                  {stats.clerk.total > 0 ? Math.round((stats.clerk.success / stats.clerk.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Better-Auth Stats */}
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold mb-4 flex items-center">
              <div class="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
              Better-Auth Statistics
            </h3>
            <div class="space-y-2">
              <div class="flex justify-between">
                <span>Total Events:</span>
                <span class="font-medium">{stats.betterAuth.total}</span>
              </div>
              <div class="flex justify-between">
                <span>Successful Logins:</span>
                <span class="font-medium text-green-600">{stats.betterAuth.success}</span>
              </div>
              <div class="flex justify-between">
                <span>Failed Attempts:</span>
                <span class="font-medium text-red-600">{stats.betterAuth.failure}</span>
              </div>
              <div class="flex justify-between">
                <span>Success Rate:</span>
                <span class="font-medium">
                  {stats.betterAuth.total > 0 ? Math.round((stats.betterAuth.success / stats.betterAuth.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Events */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b">
            <h2 class="text-xl font-semibold">Recent Authentication Events</h2>
            <p class="text-sm text-gray-600">Last 50 events across both systems</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">System</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Path</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                {recentEvents.length === 0 ? (
                  <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                      No authentication events recorded yet
                    </td>
                  </tr>
                ) : (
                  recentEvents.map((event, index) => (
                    <tr key={index}>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        {new Date(event.timestamp).toLocaleString()}
                      </td>
                      <td class="px-6 py-4 text-sm">
                        <span class={`inline-flex px-2 py-1 text-xs rounded-full ${
                          event.system === 'clerk' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {event.system}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-sm">
                        <span class={`inline-flex px-2 py-1 text-xs rounded-full ${
                          event.type === 'login_success' ? 'bg-green-100 text-green-800' :
                          event.type === 'login_failure' || event.type === 'auth_error' ? 'bg-red-100 text-red-800' :
                          event.type === 'logout' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {event.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        {event.userId ? (
                          <div>
                            <div class="font-medium">{event.userId.substring(0, 8)}...</div>
                            {event.userRole && (
                              <div class="text-xs text-gray-500">{event.userRole}</div>
                            )}
                          </div>
                        ) : (
                          <span class="text-gray-400">-</span>
                        )}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-500">
                        {event.path || '-'}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-500">
                        {event.error ? (
                          <span class="text-red-600 text-xs">{event.error}</span>
                        ) : (
                          <span class="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Migration Actions */}
        <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold mb-2 text-blue-900">Migration Controls</h3>
          <p class="text-sm text-blue-700 mb-4">
            Switch authentication systems using environment variables. Restart required after changes.
          </p>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white p-4 rounded border">
              <h4 class="font-medium mb-2">Current: {useBetterAuth ? 'Better-Auth' : 'Clerk'}</h4>
              <p class="text-sm text-gray-600 mb-3">
                {useBetterAuth 
                  ? 'Using self-hosted authentication with Google OAuth'
                  : 'Using Clerk SaaS authentication'
                }
              </p>
              <div class="text-xs text-gray-500">
                Environment: USE_BETTER_AUTH={useBetterAuth ? 'true' : 'false/unset'}
              </div>
            </div>
            
            <div class="bg-white p-4 rounded border">
              <h4 class="font-medium mb-2">Switch To: {useBetterAuth ? 'Clerk' : 'Better-Auth'}</h4>
              <p class="text-sm text-gray-600 mb-3">
                {useBetterAuth 
                  ? 'Switch back to Clerk for rollback testing'
                  : 'Test better-auth with Google OAuth'
                }
              </p>
              <div class="text-xs text-gray-500">
                Set USE_BETTER_AUTH={useBetterAuth ? 'false' : 'true'} and restart
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
});

export { adminMonitoringApp };