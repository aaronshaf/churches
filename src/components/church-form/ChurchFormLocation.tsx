import type { FC } from 'hono/jsx';
import type { Church, County } from '../../types';

interface ChurchFormLocationProps {
  church?: Church;
  counties: County[];
}

export const ChurchFormLocation: FC<ChurchFormLocationProps> = ({ church, counties }) => {
  return (
    <>
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
            placeholder="123 Main St, Salt Lake City, UT 84101"
            data-testid="input-gathering-address"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          />
        </div>
      </div>

      <div class="sm:col-span-6">
        <label for="mailingAddress" class="block text-sm font-medium leading-6 text-gray-900">
          Mailing Address (if different)
        </label>
        <div class="mt-2">
          <input
            type="text"
            name="mailingAddress"
            id="mailingAddress"
            value={church?.mailingAddress || ''}
            placeholder="PO Box 123, Salt Lake City, UT 84101"
            data-testid="input-mailing-address"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          />
        </div>
      </div>

      <div class="sm:col-span-2">
        <label for="countyId" class="block text-sm font-medium leading-6 text-gray-900">
          County <span class="text-red-500">*</span>
        </label>
        <div class="mt-2">
          <select
            id="countyId"
            name="countyId"
            required
            data-testid="select-county"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          >
            <option value="">Select a county</option>
            {counties.map((county) => (
              <option key={county.id} value={county.id} selected={church?.countyId === county.id}>
                {county.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div class="sm:col-span-2">
        <label for="latitude" class="block text-sm font-medium leading-6 text-gray-900">
          Latitude
        </label>
        <div class="mt-2">
          <input
            type="number"
            name="latitude"
            id="latitude"
            step="0.000001"
            value={church?.latitude || ''}
            data-testid="input-latitude"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          />
        </div>
      </div>

      <div class="sm:col-span-2">
        <label for="longitude" class="block text-sm font-medium leading-6 text-gray-900">
          Longitude
        </label>
        <div class="mt-2">
          <input
            type="number"
            name="longitude"
            id="longitude"
            step="0.000001"
            value={church?.longitude || ''}
            data-testid="input-longitude"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          />
        </div>
      </div>
    </>
  );
};
