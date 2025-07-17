import type { FC } from 'hono/jsx';
import type { Church } from '../../types';

interface ChurchFormBasicInfoProps {
  church?: Church;
  statusOptions: string[];
}

export const ChurchFormBasicInfo: FC<ChurchFormBasicInfoProps> = ({ church, statusOptions }) => {
  return (
    <>
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
            pattern="[a-z0-9\-]+"
            title="Only lowercase letters, numbers, and hyphens allowed"
            data-testid="input-path"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          />
        </div>
        <p class="mt-2 text-sm text-gray-500">URL-friendly path for the church page (e.g., "first-baptist-church")</p>
      </div>

      <div class="sm:col-span-2">
        <label for="status" class="block text-sm font-medium leading-6 text-gray-900">
          Status <span class="text-red-500">*</span>
        </label>
        <div class="mt-2">
          <select
            id="status"
            name="status"
            required
            data-testid="select-status"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status} selected={church?.status === status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div class="sm:col-span-6">
        <label for="statement_of_faith" class="block text-sm font-medium leading-6 text-gray-900">
          Statement of Faith
        </label>
        <div class="mt-2">
          <textarea
            id="statement_of_faith"
            name="statement_of_faith"
            rows={4}
            data-testid="textarea-statement-of-faith"
            class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
          >
            {church?.statementOfFaith || ''}
          </textarea>
        </div>
      </div>
    </>
  );
};
