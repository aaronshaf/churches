import { FC } from 'hono/jsx';

type CountyFormProps = {
  action: string;
  county?: any;
  error?: string;
  isNew?: boolean;
};

export const CountyForm: FC<CountyFormProps> = ({ action, county, error, isNew = false }) => {
  return (
    <form method="POST" action={action} class="space-y-8 divide-y divide-gray-200">
      {error && (
        <div class="rounded-md bg-red-50 p-4 mb-6">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
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
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              {isNew ? 'Create New County' : 'Edit County'}
            </h3>
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
                  rows="4"
                  class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  placeholder="Brief description of the county, its location, or notable features..."
                >{county?.description || ''}</textarea>
              </div>
              <p class="mt-2 text-sm text-gray-500">This description may be shown on the county page.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="pt-5">
        <div class="flex justify-end space-x-3">
          <a
            href="/admin/counties"
            class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancel
          </a>
          <button
            type="submit"
            class="inline-flex justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            {isNew ? 'Create County' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );
};