import type { FC } from 'hono/jsx';
import type { Church } from '../../types';

interface ChurchFormContactProps {
  church?: Church;
}

export const ChurchFormContact: FC<ChurchFormContactProps> = ({ church }) => {
  return (
    <>
      {/* Contact Information */}
      <div class="sm:col-span-6">
        <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Contact Information</h3>
      </div>

      <div class="sm:col-span-3">
        <label for="phone" class="block text-sm font-medium leading-6 text-gray-900">
          Phone Number
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
          Email Address
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

      <div class="sm:col-span-6">
        <label for="website" class="block text-sm font-medium leading-6 text-gray-900">
          Website URL
        </label>
        <div class="mt-2">
          <input
            type="url"
            name="website"
            id="website"
            value={church?.website || ''}
            data-testid="input-website"
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
          Facebook URL
        </label>
        <div class="mt-2">
          <input
            type="url"
            name="facebook"
            id="facebook"
            value={church?.facebook || ''}
            data-testid="input-facebook"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          />
        </div>
      </div>

      <div class="sm:col-span-3">
        <label for="instagram" class="block text-sm font-medium leading-6 text-gray-900">
          Instagram URL
        </label>
        <div class="mt-2">
          <input
            type="url"
            name="instagram"
            id="instagram"
            value={church?.instagram || ''}
            data-testid="input-instagram"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          />
        </div>
      </div>

      <div class="sm:col-span-3">
        <label for="twitter" class="block text-sm font-medium leading-6 text-gray-900">
          Twitter URL
        </label>
        <div class="mt-2">
          <input
            type="url"
            name="twitter"
            id="twitter"
            value={church?.twitter || ''}
            data-testid="input-twitter"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          />
        </div>
      </div>

      <div class="sm:col-span-3">
        <label for="youtube" class="block text-sm font-medium leading-6 text-gray-900">
          YouTube URL
        </label>
        <div class="mt-2">
          <input
            type="url"
            name="youtube"
            id="youtube"
            value={church?.youtube || ''}
            data-testid="input-youtube"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          />
        </div>
      </div>
    </>
  );
};
