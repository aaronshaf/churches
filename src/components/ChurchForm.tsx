import type { FC } from 'hono/jsx';

type ChurchFormProps = {
  action: string;
  church?: any;
  gatherings?: any[];
  affiliations?: any[];
  churchAffiliations?: any[];
  counties?: any[];
  images?: any[];
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
  images = [],
  error,
  isNew = false,
}) => {
  const statusOptions = ['Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed'];
  const selectedAffiliationIds = churchAffiliations.map((ca) => ca.affiliationId);

  return (
    <>
      <form
        method="POST"
        action={action}
        class="space-y-8"
        onsubmit="handleFormSubmit(event)"
        data-testid="church-form"
        enctype="multipart/form-data"
      >
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

                  <div id="add-service-container"></div>
                </div>

                {/* Contact Information */}
                <div class="sm:col-span-6">
                  <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Contact Information</h3>
                </div>

                <div class="sm:col-span-6">
                  <label for="website" class="block text-sm font-medium leading-6 text-gray-900">
                    Website
                  </label>
                  <div class="mt-2 space-y-2">
                    <input
                      type="url"
                      name="website"
                      id="website"
                      value={church?.website || ''}
                      placeholder="https://example.com"
                      data-testid="input-website"
                      class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    />
                    {!isNew && <div id="extraction-container"></div>}
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
                    >
                      {church?.publicNotes || ''}
                    </textarea>
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
                    >
                      {church?.privateNotes || ''}
                    </textarea>
                  </div>
                  <p class="mt-1 text-sm text-gray-500">These notes are only visible to administrators.</p>
                </div>

                <div class="sm:col-span-6">
                  <label class="block text-sm font-medium leading-6 text-gray-900">Church Images</label>

                  {/* Display existing images */}
                  {images.length > 0 && (
                    <div class="mt-4 mb-6">
                      <p class="text-sm text-gray-500 mb-3">Current images (drag to reorder):</p>
                      <div class="grid grid-cols-2 md:grid-cols-3 gap-4" id="existing-images">
                        {images.map((image, index) => (
                          <div class="relative group" data-image-id={image.id} draggable="true">
                            <img
                              src={image.imageUrl}
                              alt={image.caption || `Church image ${index + 1}`}
                              class="h-32 w-full object-cover rounded-lg shadow-sm"
                            />
                            <input type="hidden" name={`existingImages[${index}][id]`} value={image.id} />
                            <input
                              type="hidden"
                              name={`existingImages[${index}][order]`}
                              value={image.displayOrder || index}
                              class="image-order"
                            />
                            <input
                              type="text"
                              name={`existingImages[${index}][caption]`}
                              value={image.caption || ''}
                              placeholder="Add caption..."
                              class="mt-2 block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                            />
                            <button
                              type="button"
                              onclick={`this.closest('.relative').style.display='none'; this.closest('.relative').querySelector('input[name*="delete"]').value='true';`}
                              class="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove image"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                            <input type="hidden" name={`existingImages[${index}][delete]`} value="false" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload new images */}
                  <div class="mt-2">
                    <label for="churchImages" class="block text-sm font-medium text-gray-700 mb-2">
                      Upload new images
                    </label>
                    <input
                      type="file"
                      name="churchImages"
                      id="churchImages"
                      accept="image/*"
                      multiple
                      data-testid="input-churchImages"
                      class="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    <p class="mt-2 text-sm text-gray-500">
                      Upload multiple images of the church building, congregation, or events. You can select multiple
                      files at once.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-x-4 border-t border-gray-900/10 px-4 py-4 sm:px-8">
            <a
              href="/admin/churches"
              class="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700"
              data-testid="btn-cancel"
            >
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
        // Component-like helper functions
        const h = (tag, props = {}, ...children) => {
          const element = document.createElement(tag);
          
          // Handle props
          Object.entries(props).forEach(([key, value]) => {
            if (key === 'className') {
              element.className = value;
            } else if (key === 'onclick') {
              element.onclick = value;
            } else if (key === 'style' && typeof value === 'object') {
              Object.assign(element.style, value);
            } else {
              element.setAttribute(key, value);
            }
          });
          
          // Handle children
          children.forEach(child => {
            if (typeof child === 'string') {
              element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
              element.appendChild(child);
            }
          });
          
          return element;
        };
        
        const svg = (props = {}, ...children) => {
          const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          Object.entries(props).forEach(([key, value]) => {
            element.setAttribute(key, value);
          });
          children.forEach(child => {
            if (child instanceof Node) {
              element.appendChild(child);
            }
          });
          return element;
        };
        
        const path = (props = {}) => {
          const element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          Object.entries(props).forEach(([key, value]) => {
            element.setAttribute(key, value);
          });
          return element;
        };
        
        const circle = (props = {}) => {
          const element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          Object.entries(props).forEach(([key, value]) => {
            element.setAttribute(key, value);
          });
          return element;
        };
        
        // Components
        const Spinner = () => svg(
          { class: 'animate-spin h-4 w-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
          circle({ 
            class: 'opacity-25', 
            cx: '12', 
            cy: '12', 
            r: '10', 
            stroke: 'currentColor', 
            'stroke-width': '4' 
          }),
          path({
            class: 'opacity-75',
            fill: 'currentColor',
            d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
          })
        );
        
        const ExtractIcon = () => svg(
          { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
          path({
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'stroke-width': '2',
            d: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10'
          })
        );
        
        const RemoveIcon = () => svg(
          { class: 'h-5 w-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
          path({
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'stroke-width': '2',
            d: 'M6 18L18 6M6 6l12 12'
          })
        );
        
        // Form submit handler
        function handleFormSubmit(event) {
          const submitButton = document.getElementById('submit-button');
          const buttonText = document.getElementById('button-text');
          const buttonSpinner = document.getElementById('button-spinner');
          
          if (submitButton && buttonText && buttonSpinner) {
            submitButton.disabled = true;
            buttonText.classList.add('hidden');
            buttonSpinner.classList.remove('hidden');
            submitButton.classList.add('animate-pulse');
          }
        }
        
        // Initialize extraction UI
        function initExtractionUI(churchId) {
          const container = document.getElementById('extraction-container');
          if (!container || !churchId) return;
          
          let extractBtn, statusSpan, resultsDiv;
          
          // Create extraction button
          extractBtn = h('button', {
            type: 'button',
            className: 'inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
            'data-testid': 'btn-extract',
            onclick: () => extractChurchData(churchId)
          }, ExtractIcon(), h('span', { className: 'ml-2' }, 'Extract Info from Website'));
          
          statusSpan = h('span', { className: 'text-sm text-gray-500 ml-3' });
          
          resultsDiv = h('div', { className: 'hidden mt-2 p-3 bg-blue-50 rounded-md' },
            h('p', { className: 'text-sm font-medium text-blue-900 mb-1' }, 'Fields extracted from website:'),
            h('ul', { className: 'text-sm text-blue-800 space-y-0.5 ml-4' })
          );
          
          container.appendChild(extractBtn);
          container.appendChild(statusSpan);
          container.appendChild(resultsDiv);
          
          // Store references globally for extraction function
          window.extractionUI = { extractBtn, statusSpan, resultsDiv };
        }
        
        // Extraction functionality
        async function extractChurchData(churchId) {
          const websiteInput = document.getElementById('website');
          const { extractBtn, statusSpan, resultsDiv } = window.extractionUI;
          const resultsList = resultsDiv.querySelector('ul');
          
          const websiteUrl = websiteInput.value.trim();
          if (!websiteUrl) {
            statusSpan.textContent = 'Please enter a website URL first';
            statusSpan.className = 'text-sm text-red-600 ml-3';
            return;
          }
          
          // Update button to loading state
          extractBtn.disabled = true;
          extractBtn.innerHTML = '';
          extractBtn.appendChild(Spinner());
          extractBtn.appendChild(h('span', { className: 'ml-2' }, 'Extracting...'));
          
          statusSpan.textContent = 'Analyzing website...';
          statusSpan.className = 'text-sm text-gray-500 ml-3';
          resultsDiv.classList.add('hidden');
          
          try {
            const response = await fetch(\`/admin/churches/\${churchId}/extract\`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ websiteUrl }),
            });
            
            const data = await response.json();
            
            if (!response.ok) {
              throw new Error(data.error || 'Extraction failed');
            }
            
            // Apply extracted data to form fields
            const { extracted, fields } = data;
            
            // Clear existing list items
            resultsList.innerHTML = '';
            
            let changedCount = 0;
            let extractedCount = 0;
            
            // Helper to create list item
            const addListItem = (text, wasChanged = false) => {
              const li = h('li', 
                wasChanged ? { style: { fontWeight: 'bold' } } : {}, 
                '✓ ' + text
              );
              resultsList.appendChild(li);
            };
            
            // Helper to check if value changed and update field
            const updateField = (fieldId, newValue, fieldName) => {
              const field = document.getElementById(fieldId);
              const oldValue = field.value.trim();
              const cleanNewValue = newValue.trim();
              
              extractedCount++;
              
              if (oldValue !== cleanNewValue) {
                field.value = cleanNewValue;
                addListItem(fieldName + (oldValue ? ' (updated)' : ' (new)'), true);
                changedCount++;
                return true;
              } else {
                addListItem(fieldName, false);
                return false;
              }
            };
            
            if (fields.phone && extracted.phone) {
              updateField('phone', extracted.phone, 'Phone number');
            }
            
            if (fields.email && extracted.email) {
              updateField('email', extracted.email, 'Email address');
            }
            
            if (fields.address && extracted.address) {
              updateField('gatheringAddress', extracted.address, 'Physical address');
            }
            
            if (fields.instagram && extracted.instagram) {
              updateField('instagram', extracted.instagram, 'Instagram URL');
            }
            
            if (fields.facebook && extracted.facebook) {
              updateField('facebook', extracted.facebook, 'Facebook URL');
            }
            
            if (fields.spotify && extracted.spotify) {
              updateField('spotify', extracted.spotify, 'Spotify URL');
            }
            
            if (fields.youtube && extracted.youtube) {
              updateField('youtube', extracted.youtube, 'YouTube URL');
            }
            
            if (fields.statementOfFaithUrl && extracted.statement_of_faith_url) {
              updateField('statementOfFaith', extracted.statement_of_faith_url, 'Statement of Faith URL');
            }
            
            // Handle service times
            if (fields.serviceTimes && extracted.service_times) {
              const gatheringsContainer = document.getElementById('gatherings-container');
              
              // Get existing service times
              const existingTimes = Array.from(gatheringsContainer.querySelectorAll('input[name*="[time]"]'))
                .map(input => input.value.trim())
                .filter(time => time !== '');
              
              // Check if service times have changed
              const extractedTimes = extracted.service_times.map(service => 
                typeof service === 'string' ? service : service.time
              );
              
              const hasChanges = existingTimes.length !== extractedTimes.length ||
                !existingTimes.every((time, i) => time === extractedTimes[i]);
              
              if (hasChanges) {
                // Clear existing gatherings
                gatheringsContainer.innerHTML = '';
                
                // Add each service time using component helpers
                extracted.service_times.forEach((service, index) => {
                  const serviceTime = typeof service === 'string' ? service : service.time;
                  const serviceNotes = typeof service === 'object' ? (service.notes || '') : '';
                  
                  const newGathering = h('div', { className: 'flex gap-4 items-start p-4 bg-gray-50 rounded-lg' },
                    // Time input container
                    h('div', { className: 'flex-1' },
                      h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                        'Time ',
                        h('span', { className: 'text-red-500' }, '*')
                      ),
                      h('input', {
                        type: 'text',
                        name: \`gatherings[\${index}][time]\`,
                        value: serviceTime,
                        required: 'required',
                        className: 'block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6'
                      })
                    ),
                    // Notes input container
                    h('div', { className: 'flex-1' },
                      h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Notes (optional)'),
                      h('input', {
                        type: 'text',
                        name: \`gatherings[\${index}][notes]\`,
                        value: serviceNotes,
                        className: 'block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6'
                      })
                    ),
                    // Remove button
                    h('button', {
                      type: 'button',
                      className: 'mt-7 text-gray-400 hover:text-red-500 transition-colors',
                      title: 'Remove gathering',
                      onclick: function() { this.parentElement.remove(); }
                    }, RemoveIcon())
                  );
                  
                  gatheringsContainer.appendChild(newGathering);
                });
                
                const changeType = existingTimes.length === 0 ? ' (new)' : ' (updated)';
                addListItem(\`Service times (\${extracted.service_times.length} found)\${changeType}\`, true);
                changedCount++;
              } else {
                addListItem(\`Service times (\${extracted.service_times.length} found)\`, false);
              }
              extractedCount++;
            }
            
            // Show results
            if (extractedCount > 0) {
              resultsDiv.classList.remove('hidden');
              if (changedCount > 0) {
                statusSpan.textContent = \`Successfully extracted \${extractedCount} field\${extractedCount > 1 ? 's' : ''} (\${changedCount} \${changedCount === 1 ? 'change' : 'changes'})\`;
                statusSpan.className = 'text-sm text-green-600 ml-3';
              } else {
                statusSpan.textContent = \`Successfully extracted \${extractedCount} field\${extractedCount > 1 ? 's' : ''} (no changes needed)\`;
                statusSpan.className = 'text-sm text-blue-600 ml-3';
              }
            } else {
              statusSpan.textContent = 'No data could be extracted from the website';
              statusSpan.className = 'text-sm text-yellow-600 ml-3';
            }
            
          } catch (error) {
            console.error('Extraction error:', error);
            statusSpan.textContent = error.message || 'Failed to extract data';
            statusSpan.className = 'text-sm text-red-600 ml-3';
          } finally {
            // Re-enable button and restore original content
            extractBtn.disabled = false;
            extractBtn.innerHTML = '';
            extractBtn.appendChild(ExtractIcon());
            extractBtn.appendChild(h('span', { className: 'ml-2' }, 'Extract Info from Website'));
          }
        }
        
        // Drag and drop functionality for image reordering
        document.addEventListener('DOMContentLoaded', function() {
          const container = document.getElementById('existing-images');
          if (!container) return;
          
          let draggedElement = null;
          
          container.addEventListener('dragstart', function(e) {
            if (e.target.closest('[draggable="true"]')) {
              draggedElement = e.target.closest('[draggable="true"]');
              draggedElement.style.opacity = '0.5';
            }
          });
          
          container.addEventListener('dragend', function(e) {
            if (e.target.closest('[draggable="true"]')) {
              e.target.closest('[draggable="true"]').style.opacity = '';
            }
          });
          
          container.addEventListener('dragover', function(e) {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY);
            if (afterElement == null) {
              container.appendChild(draggedElement);
            } else {
              container.insertBefore(draggedElement, afterElement);
            }
          });
          
          container.addEventListener('drop', function(e) {
            e.preventDefault();
            updateImageOrder();
          });
          
          function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('[draggable="true"]:not([style*="opacity: 0.5"])')];
            
            return draggableElements.reduce((closest, child) => {
              const box = child.getBoundingClientRect();
              const offset = y - box.top - box.height / 2;
              
              if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
              } else {
                return closest;
              }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
          }
          
          function updateImageOrder() {
            const images = container.querySelectorAll('[draggable="true"]');
            images.forEach((img, index) => {
              const orderInput = img.querySelector('.image-order');
              if (orderInput) {
                orderInput.value = index;
              }
            });
          }
          
          // Initialize extraction UI
          const churchId = ${church?.id || 'null'};
          if (churchId) {
            initExtractionUI(churchId);
          }
          
          // Initialize add service button
          const addServiceContainer = document.getElementById('add-service-container');
          if (addServiceContainer) {
            const addServiceBtn = h('button', {
              type: 'button',
              className: 'mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
              'data-testid': 'btn-add-gathering',
              onclick: function() {
                const container = document.getElementById('gatherings-container');
                const index = container.children.length;
                
                const newGathering = h('div', { className: 'flex gap-4 items-start p-4 bg-gray-50 rounded-lg' },
                  // Time input container
                  h('div', { className: 'flex-1' },
                    h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' },
                      'Time ',
                      h('span', { className: 'text-red-500' }, '*')
                    ),
                    h('input', {
                      type: 'text',
                      name: \`gatherings[\${index}][time]\`,
                      placeholder: 'e.g., Sunday 10:30 AM',
                      required: 'required',
                      className: 'block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6'
                    })
                  ),
                  // Notes input container
                  h('div', { className: 'flex-1' },
                    h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Notes (optional)'),
                    h('input', {
                      type: 'text',
                      name: \`gatherings[\${index}][notes]\`,
                      placeholder: "e.g., Children's ministry available",
                      className: 'block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6'
                    })
                  ),
                  // Remove button
                  h('button', {
                    type: 'button',
                    className: 'mt-6 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500',
                    'data-testid': 'btn-remove-gathering',
                    onclick: function() { this.closest('.flex').remove(); }
                  }, 'Remove')
                );
                
                container.appendChild(newGathering);
              }
            },
              svg({ class: 'mr-2 h-4 w-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                path({ 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 4v16m8-8H4' })
              ),
              'Add Service'
            );
            
            addServiceContainer.appendChild(addServiceBtn);
          }
        });
      `,
        }}
      />
    </>
  );
};
