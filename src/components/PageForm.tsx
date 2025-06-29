import type { FC } from 'hono/jsx';

type PageFormProps = {
  action: string;
  page?: any;
  error?: string;
  isNew?: boolean;
};

export const PageForm: FC<PageFormProps> = ({ action, page, error, isNew = false }) => {
  return (
    <>
      <form
        method="POST"
        action={action}
        onsubmit="handleFormSubmit(event)"
        class="space-y-6"
        data-testid="page-form"
        enctype="multipart/form-data"
      >
        <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div class="px-4 py-6 sm:p-8">
            <div class="max-w-2xl">
              <h2 class="text-xl font-semibold leading-7 text-gray-900 mb-8">
                {isNew ? 'Create New Page' : 'Edit Page'}
              </h2>

              {error && (
                <div class="rounded-md bg-red-50 p-4 mb-6" data-testid="error-page-form">
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
                <div class="sm:col-span-4">
                  <label for="title" class="block text-sm font-medium leading-6 text-gray-900">
                    Title <span class="text-red-500">*</span>
                  </label>
                  <div class="mt-2">
                    <input
                      type="text"
                      name="title"
                      id="title"
                      required
                      value={page?.title || ''}
                      data-testid="input-title"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                      placeholder="About Us"
                    />
                  </div>
                </div>

                <div class="sm:col-span-4">
                  <label for="path" class="block text-sm font-medium leading-6 text-gray-900">
                    URL Path <span class="text-red-500">*</span>
                  </label>
                  <div class="mt-2">
                    <input
                      type="text"
                      name="path"
                      id="path"
                      required
                      value={page?.path || ''}
                      pattern="[a-z0-9\-]+"
                      title="Only lowercase letters, numbers, and hyphens allowed"
                      data-testid="input-path"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                      placeholder="about-us"
                    />
                    <p class="mt-2 text-sm text-gray-500">This will be the URL: /{page?.path || 'your-path'}</p>
                  </div>
                </div>

                <div class="sm:col-span-6">
                  <label for="content" class="block text-sm font-medium leading-6 text-gray-900">
                    Content
                  </label>
                  <div class="mt-2">
                    <textarea
                      name="content"
                      id="content"
                      rows={12}
                      data-testid="textarea-content"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                      placeholder="Enter page content here..."
                    >
                      {page?.content || ''}
                    </textarea>
                    <p class="mt-2 text-sm text-gray-500">HTML is supported for formatting.</p>
                  </div>
                </div>

                <div class="sm:col-span-6">
                  <label for="featuredImage" class="block text-sm font-medium leading-6 text-gray-900">
                    Featured Image
                  </label>
                  <div class="mt-2">
                    {page?.featuredImageUrl && (
                      <div class="mb-4">
                        <img src={page.featuredImageUrl} alt="" class="h-32 w-auto rounded-lg shadow-sm" />
                        <p class="mt-2 text-sm text-gray-500">Current image</p>
                      </div>
                    )}
                    <input
                      type="file"
                      name="featuredImage"
                      id="featuredImage"
                      accept="image/*"
                      data-testid="input-featuredImage"
                      class="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    <p class="mt-2 text-sm text-gray-500">
                      Upload an image to display on the church page. Recommended size: 1200x630px.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-x-4 border-t border-gray-900/10 px-4 py-4 sm:px-8">
            <a
              href="/admin/pages"
              class="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700"
              data-testid="btn-cancel"
            >
              Cancel
            </a>
            <button
              type="submit"
              id="submit-button"
              data-testid="btn-submit"
              class="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              <span class="button-text">{isNew ? 'Create Page' : 'Save Changes'}</span>
              <span class="button-spinner hidden ml-2">
                <svg
                  class="animate-spin h-4 w-4 text-white"
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
              </span>
            </button>
          </div>
        </div>
      </form>

      <script>
        {`
        function handleFormSubmit(event) {
          const submitButton = document.getElementById('submit-button');
          const buttonText = submitButton.querySelector('.button-text');
          const buttonSpinner = submitButton.querySelector('.button-spinner');
          
          // Show spinner and hide text
          buttonText.classList.add('hidden');
          buttonSpinner.classList.remove('hidden');
          
          // Disable the button to prevent double submission
          submitButton.disabled = true;
        }
      `}
      </script>
    </>
  );
};
