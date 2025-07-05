import type { FC } from 'hono/jsx';

interface BetterAuthUser {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'contributor' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

interface UserRoleManagerProps {
  users: BetterAuthUser[];
  currentUserId: string;
}

export const UserRoleManager: FC<UserRoleManagerProps> = ({ users, currentUserId }) => {
  return (
    <div class="max-w-6xl mx-auto p-6">
      <h1 class="text-3xl font-bold mb-6">User Role Management</h1>

      <div class="bg-white shadow-md rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current Role
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{user.name || user.email.split('@')[0]}</div>
                  <div class="text-sm text-gray-500">ID: {user.id}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{user.email}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {user.id === currentUserId ? (
                    <span class="text-gray-400">Current User</span>
                  ) : (
                    <form method="post" action={`/admin/users/${user.id}/role`} class="inline">
                      <select
                        name="newRole"
                        onchange="this.form.submit()"
                        class="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value={user.role} selected>
                          Change Role...
                        </option>
                        <option value="admin" disabled={user.role === 'admin'}>
                          Admin
                        </option>
                        <option value="contributor" disabled={user.role === 'contributor'}>
                          Contributor
                        </option>
                        <option value="user" disabled={user.role === 'user'}>
                          User
                        </option>
                      </select>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4">
        <div class="flex">
          <div class="ml-3">
            <p class="text-sm text-blue-700">
              <strong>Note:</strong> User roles are managed through the better-auth database. Changes are immediate and
              will affect user permissions across all sessions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
