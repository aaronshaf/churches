import type { FC } from 'hono/jsx';
import type { Affiliation } from '../../types';

interface ChurchFormAffiliationsProps {
  affiliations: Affiliation[];
  selectedAffiliationIds: number[];
}

export const ChurchFormAffiliations: FC<ChurchFormAffiliationsProps> = ({ affiliations, selectedAffiliationIds }) => {
  return (
    <>
      {/* Affiliations */}
      <div class="sm:col-span-6">
        <h3 class="text-lg font-medium leading-6 text-gray-900 mt-4 mb-4">Affiliations</h3>
      </div>

      <div class="sm:col-span-6">
        <fieldset>
          <legend class="text-sm font-medium leading-6 text-gray-900">Church Affiliations</legend>
          <div class="mt-4 space-y-3">
            {affiliations.map((affiliation) => (
              <div key={affiliation.id} class="flex items-center">
                <input
                  id={`affiliation-${affiliation.id}`}
                  name="affiliations"
                  type="checkbox"
                  value={affiliation.id}
                  checked={selectedAffiliationIds.includes(affiliation.id)}
                  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                />
                <label for={`affiliation-${affiliation.id}`} class="ml-3 text-sm leading-6 text-gray-900">
                  {affiliation.name}
                </label>
              </div>
            ))}
          </div>
        </fieldset>
      </div>
    </>
  );
};
