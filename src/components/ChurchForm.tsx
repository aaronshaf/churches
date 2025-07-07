import type { FC } from 'hono/jsx';
import type { Affiliation, Church, ChurchAffiliation, ChurchGathering, ChurchImage, County } from '../types';

type ChurchFormProps = {
  action: string;
  church?: Church;
  gatherings?: ChurchGathering[];
  affiliations?: Affiliation[];
  churchAffiliations?: ChurchAffiliation[];
  counties?: County[];
  images?: ChurchImage[];
  error?: string;
  isNew?: boolean;
  cancelUrl?: string;
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
  cancelUrl,
}) => {
  const statusOptions = ['Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed'];
  const selectedAffiliationIds = churchAffiliations.map((ca) => ca.affiliationId);

  return (
    <>
      <form method="post" action={action} class="space-y-8" data-testid="church-form" enctype="multipart/form-data">
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
                  <div class="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      id="geocode-button"
                      onclick="getCoordinates()"
                      class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="geocode-button"
                    >
                      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span id="geocode-button-text">Get Coordinates</span>
                    </button>
                    <div id="geocode-message" class="hidden"></div>
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

                {/* Gatherings */}
                <div class="sm:col-span-6">
                  <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Gatherings</h3>
                  <p class="text-sm text-gray-500 mb-4">Add gathering times and optional notes</p>

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

                  {/* Currently selected affiliations */}
                  {selectedAffiliationIds.length > 0 && (
                    <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                      <p class="text-sm font-medium text-blue-900 mb-2">Currently selected:</p>
                      <div class="flex flex-wrap gap-2">
                        {selectedAffiliationIds.map((id) => {
                          const affiliation = affiliations.find((a) => a.id === id);
                          return affiliation ? (
                            <a
                              key={id}
                              href={`/admin/affiliations/${id}/edit`}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800 hover:bg-blue-200 transition-colors"
                            >
                              {affiliation.name}
                              <svg class="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  <p class="text-sm text-gray-500 mb-4">Select all that apply</p>
                  <div class="space-y-3 max-h-48 overflow-y-auto border rounded-md p-4">
                    {affiliations.map((affiliation) => (
                      <div class="flex items-start">
                        <div class="flex items-center h-5">
                          <input
                            type="checkbox"
                            name="affiliations"
                            id={`affiliation-${affiliation.id}`}
                            value={affiliation.id}
                            checked={selectedAffiliationIds.includes(affiliation.id)}
                            data-testid={`checkbox-affiliation-${affiliation.id}`}
                            class="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </div>
                        <div class="ml-3 text-sm">
                          <label for={`affiliation-${affiliation.id}`} class="font-medium text-gray-700 cursor-pointer">
                            {affiliation.name}
                          </label>
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
                    <div
                      id="drop-zone"
                      class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors"
                    >
                      <div class="space-y-1 text-center">
                        <svg
                          class="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                          aria-hidden="true"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                        <div class="flex text-sm text-gray-600">
                          <label
                            for="churchImages"
                            class="relative cursor-pointer rounded-md bg-white font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2"
                          >
                            <span>Upload files</span>
                            <input
                              type="file"
                              name="churchImages"
                              id="churchImages"
                              accept="image/*"
                              multiple
                              data-testid="input-churchImages"
                              class="sr-only"
                            />
                          </label>
                          <p class="pl-1">or drag and drop</p>
                        </div>
                        <p class="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                      </div>
                    </div>
                    <div id="file-list" class="mt-4 hidden">
                      <p class="text-sm font-medium text-gray-700 mb-2">Selected files:</p>
                      <ul class="text-sm text-gray-600 space-y-1"></ul>
                    </div>
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
            {!isNew && (
              <button
                type="submit"
                name="continue"
                value="true"
                id="submit-continue-button"
                data-testid="btn-submit-continue"
                class="rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <span class="button-text">Save and continue</span>
                <span class="button-spinner hidden">
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
            )}
            <button
              type="submit"
              id="submit-button"
              data-testid="btn-submit"
              class="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <span id="button-text">
                {isNew ? 'Create Church' : 'Save Changes'}
                <span class="ml-2 text-xs opacity-75 hidden sm:inline">⌘⏎</span>
              </span>
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
        
        // Store which button was clicked
        let submitAction = 'save';
        
        // Form submit handler
        function handleFormSubmit(event) {
          // Disable all submit buttons
          const submitButton = document.getElementById('submit-button');
          const continueButton = document.getElementById('submit-continue-button');
          
          if (submitButton) {
            submitButton.disabled = true;
            const buttonText = submitButton.querySelector('#button-text, .button-text');
            const buttonSpinner = submitButton.querySelector('#button-spinner, .button-spinner');
            
            if (submitAction === 'save' && buttonText && buttonSpinner) {
              buttonText.classList.add('hidden');
              buttonSpinner.classList.remove('hidden');
              submitButton.classList.add('animate-pulse');
            }
          }
          
          if (continueButton) {
            continueButton.disabled = true;
            const buttonText = continueButton.querySelector('.button-text');
            const buttonSpinner = continueButton.querySelector('.button-spinner');
            
            if (submitAction === 'continue' && buttonText && buttonSpinner) {
              buttonText.classList.add('hidden');
              buttonSpinner.classList.remove('hidden');
              continueButton.classList.add('animate-pulse');
            }
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
            const { extracted = {}, fields = {} } = data || {};
            
            // Validate we have data
            if (!extracted || typeof extracted !== 'object') {
              throw new Error('No data extracted from website');
            }
            
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
        
        // Function to reset button states
        function resetButtonStates() {
          const submitButton = document.getElementById('submit-button');
          const continueButton = document.getElementById('submit-continue-button');
          
          if (submitButton) {
            submitButton.disabled = false;
            const buttonText = submitButton.querySelector('#button-text');
            const buttonSpinner = submitButton.querySelector('#button-spinner');
            if (buttonText) buttonText.classList.remove('hidden');
            if (buttonSpinner) buttonSpinner.classList.add('hidden');
          }
          
          if (continueButton) {
            continueButton.disabled = false;
            const buttonText = continueButton.querySelector('.button-text');
            const buttonSpinner = continueButton.querySelector('.button-spinner');
            if (buttonText) buttonText.classList.remove('hidden');
            if (buttonSpinner) buttonSpinner.classList.add('hidden');
          }
        }
        
        // Reset on page load
        document.addEventListener('DOMContentLoaded', function() {
          resetButtonStates();
          
          // Initialize extraction UI and add service button first
          const churchId = ${church?.id || 'null'};
          if (churchId) {
            initExtractionUI(churchId);
          }
          
          // Handle affiliation checkbox changes
          const affiliationCheckboxes = document.querySelectorAll('input[name="affiliations"]');
          const currentlySelectedDiv = document.querySelector('.bg-blue-50.rounded-lg');
          
          if (affiliationCheckboxes.length > 0) {
            const affiliations = ${JSON.stringify(affiliations || [])};
            
            function updateCurrentlySelected() {
              const selectedIds = Array.from(affiliationCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => parseInt(cb.value));
              
              if (selectedIds.length === 0 && currentlySelectedDiv) {
                currentlySelectedDiv.style.display = 'none';
              } else if (selectedIds.length > 0) {
                if (!currentlySelectedDiv) {
                  // Create the currently selected div if it doesn't exist
                  const affiliationsSection = document.querySelector('.sm\\:col-span-6 h3.text-lg');
                  if (affiliationsSection) {
                    const newDiv = document.createElement('div');
                    newDiv.className = 'mb-4 p-3 bg-blue-50 rounded-lg';
                    newDiv.innerHTML = '<p class="text-sm font-medium text-blue-900 mb-2">Currently selected:</p><div class="flex flex-wrap gap-2"></div>';
                    affiliationsSection.parentNode.insertBefore(newDiv, affiliationsSection.nextSibling);
                  }
                }
                
                const selectedDiv = document.querySelector('.bg-blue-50.rounded-lg');
                if (selectedDiv) {
                  selectedDiv.style.display = 'block';
                  const badgesContainer = selectedDiv.querySelector('.flex.flex-wrap.gap-2');
                  badgesContainer.innerHTML = '';
                  
                  selectedIds.forEach(id => {
                    const affiliation = affiliations.find(a => a.id === id);
                    if (affiliation) {
                      const link = document.createElement('a');
                      link.href = '/admin/affiliations/' + id + '/edit';
                      link.target = '_blank';
                      link.rel = 'noopener noreferrer';
                      link.className = 'inline-flex items-center rounded-md bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800 hover:bg-blue-200 transition-colors';
                      link.innerHTML = affiliation.name + '<svg class="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>';
                      badgesContainer.appendChild(link);
                    }
                  });
                }
              }
            }
            
            // Add event listeners to all affiliation checkboxes
            affiliationCheckboxes.forEach(checkbox => {
              checkbox.addEventListener('change', updateCurrentlySelected);
            });
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
          
          // Setup form submit handler
          const form = document.querySelector('form[data-testid="church-form"]');
          if (form) {
            form.addEventListener('submit', handleFormSubmit);
          }
          
          // Setup save and continue button handlers
          const saveButton = document.getElementById('submit-button');
          const continueButton = document.getElementById('submit-continue-button');
          
          if (saveButton) {
            saveButton.addEventListener('click', function() {
              submitAction = 'save';
            });
          }
          
          if (continueButton) {
            continueButton.addEventListener('click', function() {
              submitAction = 'continue';
              // Add hidden input to form
              const form = document.querySelector('form');
              let input = form.querySelector('input[name="continue"]');
              if (!input) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'continue';
                form.appendChild(input);
              }
              input.value = 'true';
            });
          }
          
          // Cmd+Enter / Ctrl+Enter save hotkey
          document.addEventListener('keydown', function(e) {
            // Check if we're in the church form context
            if (!form) return;
            
            // Detect platform for the right modifier key
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifierKey = isMac ? e.metaKey : e.ctrlKey;
            
            if (e.key === 'Enter' && modifierKey && !e.shiftKey && !e.altKey) {
              e.preventDefault();
              
              // Trigger the primary save button
              if (saveButton && !saveButton.disabled) {
                saveButton.click();
              }
            }
          });
          
          // Update hotkey hint based on platform
          document.addEventListener('DOMContentLoaded', function() {
            const hotkeyHint = document.querySelector('#button-text .text-xs');
            if (hotkeyHint) {
              const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
              hotkeyHint.textContent = isMac ? '⌘⏎' : 'Ctrl+⏎';
            }
          });
          
          // File upload drag and drop functionality
          const dropZone = document.getElementById('drop-zone');
          const fileInput = document.getElementById('churchImages');
          const fileList = document.getElementById('file-list');
          const fileListUl = fileList?.querySelector('ul');
          
          if (dropZone && fileInput) {
            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
              dropZone.addEventListener(eventName, preventDefaults, false);
              document.body.addEventListener(eventName, preventDefaults, false);
            });
            
            // Highlight drop area when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
              dropZone.addEventListener(eventName, highlight, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
              dropZone.addEventListener(eventName, unhighlight, false);
            });
            
            // Handle dropped files
            dropZone.addEventListener('drop', handleDrop, false);
            
            // Handle file input change
            fileInput.addEventListener('change', function() {
              handleFiles(this.files);
            });
            
            function preventDefaults(e) {
              e.preventDefault();
              e.stopPropagation();
            }
            
            function highlight(e) {
              dropZone.classList.add('border-primary-500', 'bg-primary-50');
            }
            
            function unhighlight(e) {
              dropZone.classList.remove('border-primary-500', 'bg-primary-50');
            }
            
            function handleDrop(e) {
              const dt = e.dataTransfer;
              const files = dt.files;
              handleFiles(files);
            }
            
            function handleFiles(files) {
              const imageFiles = [...files].filter(file => file.type.startsWith('image/'));
              
              if (imageFiles.length > 0) {
                // Create a new DataTransfer object to combine files
                const dataTransfer = new DataTransfer();
                
                // Add existing files
                const existingFiles = fileInput.files;
                for (let i = 0; i < existingFiles.length; i++) {
                  dataTransfer.items.add(existingFiles[i]);
                }
                
                // Add new files
                imageFiles.forEach(file => {
                  dataTransfer.items.add(file);
                });
                
                // Update the file input
                fileInput.files = dataTransfer.files;
                
                // Update the file list display
                updateFileList();
              }
            }
            
            function updateFileList() {
              if (!fileListUl) return;
              
              fileListUl.innerHTML = '';
              const files = [...fileInput.files];
              
              if (files.length > 0) {
                fileList.classList.remove('hidden');
                files.forEach((file, index) => {
                  const li = document.createElement('li');
                  li.className = 'flex items-center justify-between';
                  li.innerHTML = \`
                    <span>\${file.name} (\${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    <button type="button" onclick="removeFile(\${index})" class="text-red-600 hover:text-red-800 text-sm">Remove</button>
                  \`;
                  fileListUl.appendChild(li);
                });
              } else {
                fileList.classList.add('hidden');
              }
            }
            
            window.removeFile = function(index) {
              const dt = new DataTransfer();
              const files = fileInput.files;
              
              for (let i = 0; i < files.length; i++) {
                if (i !== index) {
                  dt.items.add(files[i]);
                }
              }
              
              fileInput.files = dt.files;
              updateFileList();
            };
          }
          
          // Handle image drag and drop reordering for existing images
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
        });
        
        // Also handle browser back/forward cache
        window.addEventListener('pageshow', function(event) {
          // Reset button states when navigating back
          if (event.persisted) {
            resetButtonStates();
          }
        });
        
        // Address validation and geocoding function
        async function getCoordinates() {
          const addressField = document.getElementById('gatheringAddress');
          const latField = document.getElementById('latitude');
          const lngField = document.getElementById('longitude');
          const button = document.getElementById('geocode-button');
          const buttonText = document.getElementById('geocode-button-text');
          const messageDiv = document.getElementById('geocode-message');
          
          const address = addressField?.value?.trim();
          
          if (!address) {
            showGeocodeMessage('Please enter an address first', 'error');
            return;
          }
          
          // Show loading state
          button.disabled = true;
          buttonText.textContent = 'Validating address...';
          messageDiv.className = 'mt-2 hidden';
          
          try {
            const response = await fetch('/api/geocode', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ address: address })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              // Success - update the latitude and longitude fields
              if (latField) latField.value = data.latitude;
              if (lngField) lngField.value = data.longitude;
              
              // Handle address validation results intelligently
              handleAddressValidation(data, addressField);
              
            } else {
              // Error from the API
              showGeocodeMessage(data.error || 'Failed to get coordinates', 'error');
            }
          } catch (error) {
            console.error('Address validation error:', error);
            showGeocodeMessage('Network error. Please try again.', 'error');
          } finally {
            // Reset button state
            button.disabled = false;
            buttonText.textContent = 'Get Coordinates';
          }
        }
        
        function handleAddressValidation(data, addressField) {
          const { 
            original_address, 
            validated_address, 
            formatted_address, 
            address_quality, 
            address_suggestion,
            location_type,
            validation_error
          } = data;
          
          let message = 'Coordinates updated successfully!';
          let messageType = 'success';
          
          // If validation failed due to API restrictions, inform user but continue
          if (validation_error && validation_error.includes('referrer restriction')) {
            message = 'Coordinates found (address validation unavailable due to API settings)';
            messageType = 'warning';
            
            // Still offer geocoding-based formatting suggestion
            if (formatted_address && formatted_address !== original_address) {
              if (confirm('Google suggests this formatted address:\\n\\n' + formatted_address + '\\n\\nWould you like to use this format?')) {
                addressField.value = formatted_address;
                message = 'Address formatted and coordinates set!';
                messageType = 'success';
              }
            }
            
            showGeocodeMessage(message, messageType);
            return;
          }
          
          // Handle different address quality scenarios
          switch (address_quality) {
            case 'complete':
              // Address is perfect, but check if formatting improved
              if (formatted_address !== original_address) {
                if (confirm('Google suggests this formatted address:\\n\\n' + formatted_address + '\\n\\nWould you like to use this format?')) {
                  addressField.value = formatted_address;
                  message = 'Address updated and coordinates set!';
                }
              }
              break;
              
            case 'corrected':
              // Address had issues that were corrected
              if (address_suggestion && address_suggestion !== original_address) {
                if (confirm('Google corrected your address:\\n\\nOriginal: ' + original_address + '\\nCorrected: ' + address_suggestion + '\\n\\nWould you like to use the corrected address?')) {
                  addressField.value = address_suggestion;
                  message = 'Address corrected and coordinates set!';
                } else {
                  message = 'Coordinates set (using original address)';
                  messageType = 'warning';
                }
              }
              break;
              
            case 'inferred':
              // Some parts were inferred/guessed
              message = 'Coordinates set (some address parts were inferred)';
              messageType = 'warning';
              if (formatted_address !== original_address) {
                console.log('Google inferred address:', formatted_address);
              }
              break;
              
            case 'incomplete':
              // Address validation found issues
              message = 'Coordinates found, but address may be incomplete';
              messageType = 'warning';
              break;
              
            default:
              // Validation API didn't work, but geocoding did
              if (formatted_address && formatted_address !== original_address) {
                if (confirm('Google suggests this formatted address:\\n\\n' + formatted_address + '\\n\\nWould you like to use this format?')) {
                  addressField.value = formatted_address;
                  message = 'Address formatted and coordinates set!';
                }
              }
          }
          
          // Add location precision info for very precise coordinates
          if (location_type === 'ROOFTOP') {
            message += ' (Rooftop precision)';
          } else if (location_type === 'RANGE_INTERPOLATED') {
            message += ' (Street-level precision)';
          }
          
          showGeocodeMessage(message, messageType);
        }
        
        function showGeocodeMessage(message, type) {
          const messageDiv = document.getElementById('geocode-message');
          
          messageDiv.textContent = message;
          
          // Set appropriate styling based on message type
          if (type === 'success') {
            messageDiv.className = 'text-sm text-green-600 font-medium animate-fade-in';
          } else if (type === 'warning') {
            messageDiv.className = 'text-sm text-yellow-600 font-medium animate-fade-in';
          } else {
            messageDiv.className = 'text-sm text-red-600 font-medium animate-fade-in';
          }
          
          // Auto-hide success and warning messages after 5 seconds
          if (type === 'success' || type === 'warning') {
            setTimeout(() => {
              messageDiv.classList.add('animate-fade-out');
              setTimeout(() => {
                messageDiv.className = 'hidden';
              }, 300);
            }, 5000);
          }
        }

        // Phone number formatting
        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
          phoneInput.addEventListener('blur', function() {
            const phone = this.value;
            if (phone) {
              // Remove all non-digit characters
              const digits = phone.replace(/\\D/g, '');
              
              // Check if it's a 10-digit phone number
              if (digits.length === 10) {
                // Format as (XXX) XXX-XXXX
                this.value = '(' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
              }
            }
          });
        }
      `,
        }}
      />
    </>
  );
};
