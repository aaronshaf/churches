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
    <>
      <form method="POST" action={action} onsubmit="handleFormSubmit(event)" class="space-y-6" data-testid="user-form">
        <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div class="px-4 py-6 sm:p-8">
            <div class="max-w-2xl">
              <h2 class="text-xl font-semibold leading-7 text-gray-900 mb-8">
                {isNew ? 'Create New User' : 'Edit User'}
              </h2>

              {error && (
                <div class="rounded-md bg-red-50 p-4 mb-6" data-testid="error-user-form">
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
                      data-testid="input-username"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200 sm:text-sm sm:leading-6"
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
                      data-testid="input-email"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
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
                      data-testid="input-password"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
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
                      data-testid="select-userType"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200 sm:text-sm sm:leading-6"
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

          <div class="pt-5">
            <div class="flex justify-end space-x-3">
              <a
                href="/admin/users"
                class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                data-testid="btn-cancel"
              >
                Cancel
              </a>
              <button
                type="submit"
                id="submit-button"
                data-testid="btn-submit"
                class="inline-flex justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <span id="button-text">{isNew ? 'Create User' : 'Save Changes'}</span>
                <span id="button-spinner" class="hidden">
                  <svg
                    class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving...
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            function handleFormSubmit(event) {
              const submitButton = document.getElementById('submit-button');
              const buttonText = document.getElementById('button-text');
              const buttonSpinner = document.getElementById('button-spinner');
              
              // Disable the button and show spinner
              submitButton.disabled = true;
              buttonText.classList.add('hidden');
              buttonSpinner.classList.remove('hidden');
              
              // Add a subtle pulse animation to the button
              submitButton.classList.add('animate-pulse');
            }
          `,
        }}
      />
    </>
  );
};
