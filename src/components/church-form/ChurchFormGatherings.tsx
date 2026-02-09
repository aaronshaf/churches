import type { FC } from 'hono/jsx';
import type { Church, ChurchGathering } from '../../types';

interface ChurchFormGatheringsProps {
  church?: Church;
  gatherings: ChurchGathering[];
}

export const ChurchFormGatherings: FC<ChurchFormGatheringsProps> = ({ church: _church, gatherings }) => {
  return (
    <>
      {/* Service Information */}
      <div class="sm:col-span-6">
        <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Service Information</h3>
      </div>

      {/* Gatherings */}
      <div class="sm:col-span-6">
        <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Gatherings</h3>
        <div id="gatherings-container" class="space-y-4">
          {gatherings.map((gathering, index) => (
            <div key={gathering.id} class="border border-gray-200 rounded-lg p-4 gathering-item">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700">Day</label>
                  <select
                    name={`gathering_day_${index}`}
                    class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  >
                    <option value="">Select Day</option>
                    <option value="Sunday">Sunday</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">Time</label>
                  <input
                    type="time"
                    name={`gathering_time_${index}`}
                    value={gathering.time || ''}
                    class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">Type</label>
                  <input
                    type="text"
                    name={`gathering_type_${index}`}
                    value=""
                    placeholder="e.g., Worship Service, Bible Study"
                    class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
              <div class="mt-3">
                <label class="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  name={`gathering_notes_${index}`}
                  rows={2}
                  class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  placeholder="Additional notes about this gathering"
                >
                  {gathering.notes || ''}
                </textarea>
              </div>
              <div class="mt-2">
                <button
                  type="button"
                  onclick="removeGathering(this)"
                  class="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div class="mt-4">
          <button
            type="button"
            onclick="addGathering()"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Add Gathering
          </button>
        </div>
      </div>
    </>
  );
};
