import type { FC } from 'hono/jsx';
import type { Affiliation, Church } from '../types';
import { AffiliationImageUpload } from './AffiliationImageUpload';

type AffiliationFormProps = {
  action: string;
  affiliation?: Affiliation;
  affiliatedChurches?: Church[];
  allChurches?: Church[];
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
  cancelUrl?: string;
  r2Domain?: string;
  domain?: string;
};

export const AffiliationForm: FC<AffiliationFormProps> = ({
  action,
  affiliation,
  affiliatedChurches = [],
  allChurches = [],
  imagesData = [],
  error,
  isNew = false,
  r2Domain,
  domain = 'localhost',
}) => {
  const affiliatedChurchIds = affiliatedChurches.map((c) => c.id);
  return (
    <>
      <form
        method="post"
        action={action}
        class="space-y-8 divide-y divide-gray-200"
        onsubmit="handleFormSubmit(event)"
        data-testid="affiliation-form"
        enctype="multipart/form-data"
      >
        {error && (
          <div class="rounded-md bg-red-50 p-4 mb-6" data-testid="error-affiliation-form">
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
              <h3 class="text-lg leading-6 font-medium text-gray-900">
                {isNew ? 'Create New Affiliation' : 'Edit Affiliation'}
              </h3>
              <p class="mt-1 text-sm text-gray-500">
                {isNew ? 'Add a new church affiliation or denomination.' : 'Update the affiliation details.'}
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
                    value={affiliation?.name || ''}
                    data-testid="input-name"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="path" class="block text-sm font-medium text-gray-700">
                  URL Path
                </label>
                <div class="mt-1">
                  <input
                    type="text"
                    name="path"
                    id="path"
                    value={affiliation?.path || ''}
                    placeholder="e.g., southern-baptist-convention"
                    pattern="[a-z0-9\-]+"
                    title="Only lowercase letters, numbers, and hyphens allowed"
                    data-testid="input-path"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  />
                </div>
                <p class="mt-2 text-sm text-gray-500">
                  URL-friendly path for the network page. Leave blank to auto-generate from name.
                </p>
              </div>

              <div class="sm:col-span-3">
                <label for="status" class="block text-sm font-medium text-gray-700">
                  Status <span class="text-red-500">*</span>
                </label>
                <div class="mt-1">
                  <select
                    id="status"
                    name="status"
                    required
                    data-testid="select-status"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  >
                    <option value="Listed" selected={affiliation?.status === 'Listed' || (!affiliation && true)}>
                      Listed
                    </option>
                    <option value="Unlisted" selected={affiliation?.status === 'Unlisted'}>
                      Unlisted
                    </option>
                    <option value="Heretical" selected={affiliation?.status === 'Heretical'}>
                      Heretical
                    </option>
                  </select>
                </div>
                <p class="mt-2 text-sm text-gray-500">Choose how this affiliation should be displayed</p>
              </div>

              <div class="sm:col-span-4">
                <label for="website" class="block text-sm font-medium text-gray-700">
                  Website
                </label>
                <div class="mt-1">
                  <input
                    type="url"
                    name="website"
                    id="website"
                    value={affiliation?.website || ''}
                    placeholder="https://example.com"
                    data-testid="input-website"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  />
                </div>
                <p class="mt-2 text-sm text-gray-500">Must start with http:// or https://</p>
              </div>
            </div>
          </div>

          <div class="pt-8">
            <div>
              <h3 class="text-lg leading-6 font-medium text-gray-900">Notes</h3>
              <p class="mt-1 text-sm text-gray-500">Additional information about this affiliation.</p>
            </div>
            <div class="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div class="sm:col-span-6">
                <label for="publicNotes" class="block text-sm font-medium text-gray-700">
                  Public Notes
                </label>
                <div class="mt-1">
                  <textarea
                    id="publicNotes"
                    name="publicNotes"
                    rows={3}
                    data-testid="textarea-publicNotes"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="Notes visible to the public"
                  >
                    {affiliation?.publicNotes || ''}
                  </textarea>
                </div>
                <p class="mt-2 text-sm text-gray-500">These notes will be visible on the public website.</p>
              </div>

              <div class="sm:col-span-6">
                <label for="privateNotes" class="block text-sm font-medium text-gray-700">
                  Private Notes
                </label>
                <div class="mt-1">
                  <textarea
                    id="privateNotes"
                    name="privateNotes"
                    rows={3}
                    data-testid="textarea-privateNotes"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="Internal notes (not visible to public)"
                  >
                    {affiliation?.privateNotes || ''}
                  </textarea>
                </div>
                <p class="mt-2 text-sm text-gray-500">Internal notes for administrative purposes only.</p>
              </div>

              {/* Affiliation Images */}
              <AffiliationImageUpload
                affiliationImages={imagesData}
                domain={domain}
                r2Domain={r2Domain}
                affiliationId={affiliation?.id}
              />
            </div>
          </div>

          {!isNew && (
            <div class="pt-8">
              <div>
                <h3 class="text-lg leading-6 font-medium text-gray-900">Affiliated Churches</h3>
                <p class="mt-1 text-sm text-gray-500">Churches currently associated with this affiliation.</p>
              </div>

              {/* Currently affiliated churches */}
              {affiliatedChurches.length > 0 && (
                <div class="mt-6 mb-6 p-4 bg-blue-50 rounded-lg">
                  <p class="text-sm font-medium text-blue-900 mb-3">
                    Currently affiliated churches ({affiliatedChurches.length}):
                  </p>
                  <div class="space-y-2">
                    {affiliatedChurches.map((church) => (
                      <div key={church.id} class="flex items-center justify-between bg-white p-3 rounded-md">
                        <div>
                          <a
                            href={`/admin/churches/${church.id}/edit`}
                            class="text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            {church.name}
                          </a>
                          {church.countyName && (
                            <span class="text-sm text-gray-500 ml-2">({church.countyName} County)</span>
                          )}
                        </div>
                        <span
                          class={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                            church.status === 'Listed'
                              ? 'bg-green-50 text-green-700 ring-green-600/20'
                              : church.status === 'Ready to list'
                                ? 'bg-blue-50 text-blue-700 ring-blue-600/20'
                                : church.status === 'Heretical'
                                  ? 'bg-red-50 text-red-700 ring-red-600/20'
                                  : 'bg-gray-50 text-gray-700 ring-gray-600/20'
                          }`}
                        >
                          {church.status || 'No status'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add/remove churches */}
              <div class="mt-6">
                <label class="block text-sm font-medium text-gray-700 mb-3">
                  Add or remove churches from this affiliation:
                </label>
                <div class="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-md p-4">
                  {allChurches.map((church) => (
                    <label key={church.id} class="flex items-start p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        name="churches"
                        value={church.id}
                        checked={affiliatedChurchIds.includes(church.id)}
                        class="mt-0.5 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <div class="ml-3 flex-1">
                        <div class="text-sm font-medium text-gray-700">{church.name}</div>
                        <div class="text-xs text-gray-500">
                          {church.countyName && `${church.countyName} County`}
                          {church.status && ` • ${church.status}`}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <p class="mt-2 text-sm text-gray-500">
                  Check or uncheck churches to add or remove them from this affiliation.
                </p>
              </div>
            </div>
          )}
        </div>

        <div class="pt-5">
          <div class="flex justify-end space-x-3">
            <a
              href="/admin/affiliations"
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
              <span id="button-text">{isNew ? 'Create Affiliation' : 'Save Changes'}</span>
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
      </form>

      <script
        dangerouslySetInnerHTML={{
          __html: `
        function handleFormSubmit(event) {
          // Don't prevent default - let the form submit normally
          // Just update the UI optimistically
          
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
