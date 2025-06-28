import type { FC } from 'hono/jsx';

type ChurchFormProps = {
  action: string;
  church?: any;
  gatherings?: any[];
  affiliations?: any[];
  churchAffiliations?: any[];
  counties?: any[];
  error?: string;
  isNew?: boolean;
};

export const ChurchForm: FC<ChurchFormProps> = ({
  action,
  church,
  gatherings = [],
  affiliations = [],
  churchAffiliations = [],
  counties = [],
  error,
  isNew = false,
}) => {
  const statusOptions = ['Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed'];
  const selectedAffiliationIds = churchAffiliations.map((ca) => ca.affiliationId);

  return (
    <>
      <form method="POST" action={action} class="space-y-8" onsubmit="handleFormSubmit(event)" data-testid="church-form">
        <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div class="px-4 py-6 sm:p-8">
            <div class="max-w-2xl">
              <h2 class="text-xl font-semibold leading-7 text-gray-900 mb-8">
                {isNew ? 'Create New Church' : 'Edit Church'}
              </h2>

              {error && (
                <div class="rounded-md bg-red-50 p-4 mb-6" data-testid="error-church-form">
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
                {/* Basic Information */}
                <div class="sm:col-span-4">
                  <label for="name" class="block text-sm font-medium leading-6 text-gray-900">
                    Church Name <span class="text-red-500">*</span>
                  </label>
                  <div class="mt-2">
                    <input
                      type="text"
                      name="name"
                      id="name"
                      required
                      value={church?.name || ''}
                      data-testid="input-name"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div class="sm:col-span-4">
                  <label for="path" class="block text-sm font-medium leading-6 text-gray-900">
                    URL Path
                  </label>
                  <div class="mt-2">
                    <input
                      type="text"
                      name="path"
                      id="path"
                      value={church?.path || ''}
                      placeholder="e.g., first-baptist-church-salt-lake"
                      pattern="[a-z0-9\-]+"
                      title="Only lowercase letters, numbers, and hyphens allowed"
                      data-testid="input-path"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label for="status" class="block text-sm font-medium leading-6 text-gray-900">
                    Status
                  </label>
                  <div class="mt-2">
                    <select
                      id="status"
                      name="status"
                      data-testid="select-status"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    >
                      <option value="">Select status</option>
                      {statusOptions.map((status) => (
                        <option value={status} selected={church?.status === status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label for="countyId" class="block text-sm font-medium leading-6 text-gray-900">
                    County
                  </label>
                  <div class="mt-2">
                    <select
                      id="countyId"
                      name="countyId"
                      data-testid="select-county"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    >
                      <option value="">Select county</option>
                      {counties.map((county) => (
                        <option value={county.id} selected={church?.countyId === county.id}>
                          {county.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label for="language" class="block text-sm font-medium leading-6 text-gray-900">
                    Language
                  </label>
                  <div class="mt-2">
                    <input
                      type="text"
                      name="language"
                      id="language"
                      value={church?.language || 'English'}
                      data-testid="input-language"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                {/* Location Information */}
                <div class="sm:col-span-6">
                  <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Location Information</h3>
                </div>

                <div class="sm:col-span-6">
                  <label for="gatheringAddress" class="block text-sm font-medium leading-6 text-gray-900">
                    Gathering Address
                  </label>
                  <div class="mt-2">
                    <input
                      type="text"
                      name="gatheringAddress"
                      id="gatheringAddress"
                      value={church?.gatheringAddress || ''}
                      data-testid="input-gatheringAddress"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label for="latitude" class="block text-sm font-medium leading-6 text-gray-900">
                    Latitude
                  </label>
                  <div class="mt-2">
                    <input
                      type="number"
                      name="latitude"
                      id="latitude"
                      step="any"
                      value={church?.latitude || ''}
                      data-testid="input-latitude"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label for="longitude" class="block text-sm font-medium leading-6 text-gray-900">
                    Longitude
                  </label>
                  <div class="mt-2">
                    <input
                      type="number"
                      name="longitude"
                      id="longitude"
                      step="any"
                      value={church?.longitude || ''}
                      data-testid="input-longitude"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                {/* Service Information */}
                <div class="sm:col-span-6">
                  <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Service Information</h3>
                </div>

                {/* Services */}
                <div class="sm:col-span-6">
                  <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Services</h3>
                  <p class="text-sm text-gray-500 mb-4">Add service times and optional notes</p>

                  <div id="gatherings-container" class="space-y-4">
                    {gatherings.map((gathering, index) => (
                      <div class="flex gap-4 items-start p-4 bg-gray-50 rounded-lg">
                        <div class="flex-1">
                          <label class="block text-sm font-medium text-gray-700 mb-1">
                            Time <span class="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name={`gatherings[${index}][time]`}
                            value={gathering.time}
                            placeholder="e.g., Sunday 10:30 AM"
                            required
                            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                          />
                        </div>
                        <div class="flex-1">
                          <label class="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                          <input
                            type="text"
                            name={`gatherings[${index}][notes]`}
                            value={gathering.notes || ''}
                            placeholder="e.g., Children's ministry available"
                            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                          />
                        </div>
                        <button
                          type="button"
                          onclick={`this.closest('.flex').remove()`}
                          data-testid="btn-remove-gathering"
                          class="mt-6 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    data-testid="btn-add-gathering"
                    onclick={`
                    const container = document.getElementById('gatherings-container');
                    const index = container.children.length;
                    const newGathering = document.createElement('div');
                    newGathering.className = 'flex gap-4 items-start p-4 bg-gray-50 rounded-lg';
                    newGathering.innerHTML = \`
                      <div class="flex-1">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                          Time <span class="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="gatherings[\${index}][time]"
                          placeholder="e.g., Sunday 10:30 AM"
                          required
                          class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        />
                      </div>
                      <div class="flex-1">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                          Notes (optional)
                        </label>
                        <input
                          type="text"
                          name="gatherings[\${index}][notes]"
                          placeholder="e.g., Children's ministry available"
                          class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        />
                      </div>
                      <button
                        type="button"
                        onclick="this.closest('.flex').remove()"
                        data-testid="btn-remove-gathering"
                        class="mt-6 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Remove
                      </button>
                    \`;
                    container.appendChild(newGathering);
                  `}
                    class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Service
                  </button>
                </div>

                {/* Contact Information */}
                <div class="sm:col-span-6">
                  <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Contact Information</h3>
                </div>

                <div class="sm:col-span-6">
                  <label for="website" class="block text-sm font-medium leading-6 text-gray-900">
                    Website
                  </label>
                  <div class="mt-2">
                    <input
                      type="url"
                      name="website"
                      id="website"
                      value={church?.website || ''}
                      placeholder="https://example.com"
                      data-testid="input-website"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label for="phone" class="block text-sm font-medium leading-6 text-gray-900">
                    Phone
                  </label>
                  <div class="mt-2">
                    <input
                      type="tel"
                      name="phone"
                      id="phone"
                      value={church?.phone || ''}
                      data-testid="input-phone"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label for="email" class="block text-sm font-medium leading-6 text-gray-900">
                    Email
                  </label>
                  <div class="mt-2">
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={church?.email || ''}
                      data-testid="input-email"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                {/* Social Media */}
                <div class="sm:col-span-6">
                  <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Social Media</h3>
                </div>

                <div class="sm:col-span-3">
                  <label for="facebook" class="block text-sm font-medium leading-6 text-gray-900">
                    Facebook
                  </label>
                  <div class="mt-2">
                    <input
                      type="url"
                      name="facebook"
                      id="facebook"
                      value={church?.facebook || ''}
                      placeholder="https://facebook.com/..."
                      data-testid="input-facebook"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label for="instagram" class="block text-sm font-medium leading-6 text-gray-900">
                    Instagram
                  </label>
                  <div class="mt-2">
                    <input
                      type="url"
                      name="instagram"
                      id="instagram"
                      value={church?.instagram || ''}
                      placeholder="https://instagram.com/..."
                      data-testid="input-instagram"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label for="youtube" class="block text-sm font-medium leading-6 text-gray-900">
                    YouTube
                  </label>
                  <div class="mt-2">
                    <input
                      type="url"
                      name="youtube"
                      id="youtube"
                      value={church?.youtube || ''}
                      placeholder="https://youtube.com/..."
                      data-testid="input-youtube"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label for="spotify" class="block text-sm font-medium leading-6 text-gray-900">
                    Spotify
                  </label>
                  <div class="mt-2">
                    <input
                      type="url"
                      name="spotify"
                      id="spotify"
                      value={church?.spotify || ''}
                      placeholder="https://open.spotify.com/..."
                      data-testid="input-spotify"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                {/* Affiliations */}
                <div class="sm:col-span-6">
                  <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Affiliations</h3>
                  <p class="text-sm text-gray-500 mb-4">Select all that apply</p>
                  <div class="space-y-3 max-h-48 overflow-y-auto border rounded-md p-4">
                    {affiliations.map((affiliation) => (
                      <div class="flex items-start">
                        <div class="flex items-center h-5">
                          <input
                            type="checkbox"
                            name="affiliations"
                            value={affiliation.id}
                            checked={selectedAffiliationIds.includes(affiliation.id)}
                            data-testid={`checkbox-affiliation-${affiliation.id}`}
                            class="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </div>
                        <div class="ml-3 text-sm">
                          <label class="font-medium text-gray-700">{affiliation.name}</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Information */}
                <div class="sm:col-span-6">
                  <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Additional Information</h3>
                </div>

                <div class="sm:col-span-6">
                  <label for="statementOfFaith" class="block text-sm font-medium leading-6 text-gray-900">
                    Statement of Faith URL
                  </label>
                  <div class="mt-2">
                    <input
                      type="url"
                      name="statementOfFaith"
                      id="statementOfFaith"
                      value={church?.statementOfFaith || ''}
                      data-testid="input-statementOfFaith"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>

                <div class="sm:col-span-6">
                  <label for="publicNotes" class="block text-sm font-medium leading-6 text-gray-900">
                    Public Notes
                  </label>
                  <div class="mt-2">
                    <textarea
                      name="publicNotes"
                      id="publicNotes"
                      rows={3}
                      data-testid="textarea-publicNotes"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    >{church?.publicNotes || ''}</textarea>
                  </div>
                  <p class="mt-1 text-sm text-gray-500">These notes will be visible on the public website.</p>
                </div>

                <div class="sm:col-span-6">
                  <label for="privateNotes" class="block text-sm font-medium leading-6 text-gray-900">
                    Private Notes
                  </label>
                  <div class="mt-2">
                    <textarea
                      name="privateNotes"
                      id="privateNotes"
                      rows={3}
                      data-testid="textarea-privateNotes"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    >{church?.privateNotes || ''}</textarea>
                  </div>
                  <p class="mt-1 text-sm text-gray-500">These notes are only visible to administrators.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-x-4 border-t border-gray-900/10 px-4 py-4 sm:px-8">
            <a href="/admin/churches" class="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700" data-testid="btn-cancel">
              Cancel
            </a>
            <button
              type="submit"
              id="submit-button"
              data-testid="btn-submit"
              class="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <span id="button-text">{isNew ? 'Create Church' : 'Save Changes'}</span>
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
