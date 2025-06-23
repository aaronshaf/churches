import type { FC } from 'hono/jsx';

type UserFormProps = {
  action: string;
  user?: any;
  error?: string;
  isNew?: boolean;
  isOnlyAdmin?: boolean;
};

export const UserForm: FC<UserFormProps> = ({ action, user, error, isNew = false, isOnlyAdmin = false }) => {
  return (
    <form method="POST" action={action} class="space-y-6">
      <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div class="px-4 py-6 sm:p-8">
          <div class="max-w-2xl">
            <h2 class="text-xl font-semibold leading-7 text-gray-900 mb-8">
              {isNew ? 'Create New User' : 'Edit User'}
            </h2>

            {error && (
              <div class="rounded-md bg-red-50 p-4 mb-6">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <p class="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="username" class="block text-sm font-medium leading-6 text-gray-900">
                  Username
                </label>
                <div class="mt-2">
                  <input
                    type="text"
                    name="username"
                    id="username"
                    required
                    disabled={!isNew}
                    value={user?.username || ''}
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="email" class="block text-sm font-medium leading-6 text-gray-900">
                  Email address
                </label>
                <div class="mt-2">
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    value={user?.email || ''}
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="password" class="block text-sm font-medium leading-6 text-gray-900">
                  Password
                  {!isNew && <span class="text-gray-500 font-normal"> (leave blank to keep current)</span>}
                </label>
                <div class="mt-2">
                  <input
                    type="password"
                    name="password"
                    id="password"
                    required={isNew}
                    minlength="6"
                    placeholder={isNew ? '' : 'Leave blank to keep current password'}
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="userType" class="block text-sm font-medium leading-6 text-gray-900">
                  User Type
                  {isOnlyAdmin && <span class="text-gray-500 font-normal"> (Cannot change - only admin)</span>}
                </label>
                <div class="mt-2">
                  <select
                    id="userType"
                    name="userType"
                    required
                    disabled={isOnlyAdmin}
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200 sm:text-sm sm:leading-6"
                  >
                    <option value="contributor" selected={user?.userType === 'contributor' || (!user && !isNew)}>
                      Contributor
                    </option>
                    <option value="admin" selected={user?.userType === 'admin'}>
                      Admin
                    </option>
                  </select>
                  {isOnlyAdmin && <input type="hidden" name="userType" value="admin" />}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-x-4 border-t border-gray-900/10 px-4 py-4 sm:px-8">
          <a href="/admin/users" class="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700">
            Cancel
          </a>
          <button
            type="submit"
            class="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            {isNew ? 'Create User' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );
};
