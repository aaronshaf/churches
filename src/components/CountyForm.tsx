import type { FC } from 'hono/jsx';
import { CountyImageUpload } from './CountyImageUpload';

interface County {
  id?: number;
  name?: string;
  path?: string | null;
  population?: number | null;
  description?: string | null;
}

type CountyFormProps = {
  action: string;
  county?: County;
  imagesData?: Array<{
    id: number;
    imagePath: string;
    imageAlt: string | null;
    caption: string | null;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    sortOrder: number;
  }>;
  error?: string;
  isNew?: boolean;
  r2Domain?: string;
  domain?: string;
};

export const CountyForm: FC<CountyFormProps> = ({
  action,
  county,
  imagesData = [],
  error,
  isNew = false,
  r2Domain,
  domain = 'localhost',
}) => {
  return (
    <>
      <form
        method="post"
        action={action}
        onsubmit="handleFormSubmit(event)"
        class="space-y-8 divide-y divide-gray-200"
        data-testid="county-form"
        enctype="multipart/form-data"
      >
        {error && (
          <div class="rounded-md bg-red-50 p-4 mb-6" data-testid="error-county-form">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div class="space-y-8 divide-y divide-gray-200">
          <div>
            <div>
              <h3 class="text-lg leading-6 font-medium text-gray-900">{isNew ? 'Create New County' : 'Edit County'}</h3>
              <p class="mt-1 text-sm text-gray-500">
                {isNew ? 'Add a new county to the directory.' : 'Update the county information.'}
              </p>
            </div>

            <div class="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div class="sm:col-span-4">
                <label for="name" class="block text-sm font-medium text-gray-700">
                  Name <span class="text-red-500">*</span>
                </label>
                <div class="mt-1">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    value={county?.name || ''}
                    placeholder="e.g., Salt Lake County"
                    data-testid="input-name"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  />
                </div>
                <p class="mt-2 text-sm text-gray-500">The official name of the county</p>
              </div>

              <div class="sm:col-span-3">
                <label for="path" class="block text-sm font-medium text-gray-700">
                  URL Path
                </label>
                <div class="mt-1">
                  <input
                    type="text"
                    name="path"
                    id="path"
                    value={county?.path || ''}
                    placeholder="e.g., salt-lake"
                    pattern="[a-z0-9\-]+"
                    title="Only lowercase letters, numbers, and hyphens allowed"
                    data-testid="input-path"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  />
                </div>
                <p class="mt-2 text-sm text-gray-500">URL-friendly slug (lowercase, hyphens only)</p>
              </div>

              <div class="sm:col-span-2">
                <label for="population" class="block text-sm font-medium text-gray-700">
                  Population
                </label>
                <div class="mt-1">
                  <input
                    type="number"
                    name="population"
                    id="population"
                    value={county?.population || ''}
                    min="0"
                    placeholder="e.g., 1185238"
                    data-testid="input-population"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  />
                </div>
                <p class="mt-2 text-sm text-gray-500">Current population estimate</p>
              </div>
            </div>
          </div>

          <div class="pt-8">
            <div>
              <h3 class="text-lg leading-6 font-medium text-gray-900">Additional Information</h3>
              <p class="mt-1 text-sm text-gray-500">Optional details about the county.</p>
            </div>
            <div class="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div class="sm:col-span-6">
                <label for="description" class="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <div class="mt-1">
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    data-testid="textarea-description"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="Brief description of the county, its location, or notable features..."
                  >
                    {county?.description || ''}
                  </textarea>
                </div>
                <p class="mt-2 text-sm text-gray-500">This description may be shown on the county page.</p>
              </div>

              {/* County Images */}
              <CountyImageUpload countyImages={imagesData} domain={domain} r2Domain={r2Domain} countyId={county?.id} />
            </div>
          </div>
        </div>

        <div class="pt-5">
          <div class="flex justify-end space-x-3">
            <a
              href="/admin/counties"
              class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              data-testid="btn-cancel"
            >
              Cancel
            </a>
            <button
              type="submit"
              id="submit-button"
              data-testid="btn-submit"
              class="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              <span class="button-text">{isNew ? 'Create County' : 'Save Changes'}</span>
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
