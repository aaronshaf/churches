import type { FC } from 'hono/jsx';
import type { Church } from '../../types';

interface ChurchFormAdditionalProps {
  church?: Church;
}

export const ChurchFormAdditional: FC<ChurchFormAdditionalProps> = ({ church }) => {
  return (
    <>
      {/* Additional Information */}
      <div class="sm:col-span-6">
        <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Additional Information</h3>
      </div>

      <div class="sm:col-span-6">
        <label for="publicNotes" class="block text-sm font-medium leading-6 text-gray-900">
          Public Notes
        </label>
        <div class="mt-2">
          <textarea
            id="publicNotes"
            name="publicNotes"
            rows={3}
            data-testid="textarea-public-notes"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
            placeholder="Notes that will be visible to the public"
          >
            {church?.publicNotes || ''}
          </textarea>
        </div>
      </div>

      <div class="sm:col-span-6">
        <label for="privateNotes" class="block text-sm font-medium leading-6 text-gray-900">
          Private Notes
        </label>
        <div class="mt-2">
          <textarea
            id="privateNotes"
            name="privateNotes"
            rows={3}
            data-testid="textarea-private-notes"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
            placeholder="Internal notes not visible to the public"
          >
            {church?.privateNotes || ''}
          </textarea>
        </div>
      </div>
    </>
  );
};
