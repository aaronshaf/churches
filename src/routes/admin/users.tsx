import { Context } from 'hono';
import { Layout } from '../../components/Layout';

export async function AdminUsersPage(c: Context) {
  const clerk = c.get('clerk');
  
  // Fetch users from Clerk
  const users = await clerk.users.getUserList({ limit: 100 });
  
  return c.html(
    <Layout title="Manage Users - Admin" clerkPublishableKey={c.env.CLERK_PUBLISHABLE_KEY || ''}>
      <div class="max-w-6xl mx-auto p-6">
        <h1 class="text-3xl font-bold mb-6">User Management</h1>
        
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p class="text-sm">
            <strong>Note:</strong> User roles are managed through Clerk. 
            To change a user's role, use the command line tool:
          </p>
          <pre class="mt-2 bg-gray-100 p-2 rounded text-xs">
pnpm tsx scripts/set-clerk-admin.ts user@example.com admin
          </pre>
        </div>
        
        <div class="bg-white shadow rounded-lg overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {users.map(user => {
                const role = user.publicMetadata?.role || 'user';
                const roleColor = role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                                role === 'contributor' ? 'bg-green-100 text-green-800' : 
                                'bg-gray-100 text-gray-800';
                
                return (
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        {user.imageUrl ? (
                          <img class="h-10 w-10 rounded-full" src={user.imageUrl} alt="" />
                        ) : (
                          <div class="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span class="text-gray-600 font-medium">
                              {(user.firstName?.[0] || user.emailAddresses[0].emailAddress[0]).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div class="ml-4">
                          <div class="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div class="text-sm text-gray-500">
                            {user.username || 'No username'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900">{user.emailAddresses[0]?.emailAddress}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColor}`}>
                        {role}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div class="mt-8 space-y-4">
          <h2 class="text-xl font-semibold">Role Descriptions</h2>
          <div class="grid gap-4 md:grid-cols-3">
            <div class="border rounded-lg p-4">
              <h3 class="font-semibold text-purple-600">Admin</h3>
              <p class="text-sm text-gray-600 mt-1">
                Full access to edit churches, manage users, and moderate content
              </p>
            </div>
            <div class="border rounded-lg p-4">
              <h3 class="font-semibold text-green-600">Contributor</h3>
              <p class="text-sm text-gray-600 mt-1">
                Can suggest new churches and add comments (pending moderation)
              </p>
            </div>
            <div class="border rounded-lg p-4">
              <h3 class="font-semibold text-gray-600">User</h3>
              <p class="text-sm text-gray-600 mt-1">
                Can view churches and add comments (pending moderation)
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}