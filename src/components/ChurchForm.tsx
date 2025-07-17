import type { FC } from 'hono/jsx';
import type { Affiliation, Church, ChurchAffiliation, ChurchGathering, ChurchImage, County } from '../types';
import { ChurchImageUpload } from './ChurchImageUpload';
import { ChurchFormAdditional } from './church-form/ChurchFormAdditional';
import { ChurchFormAffiliations } from './church-form/ChurchFormAffiliations';
import { ChurchFormBasicInfo } from './church-form/ChurchFormBasicInfo';
import { ChurchFormContact } from './church-form/ChurchFormContact';
import { ChurchFormGatherings } from './church-form/ChurchFormGatherings';
import { ChurchFormLocation } from './church-form/ChurchFormLocation';
import { ChurchFormScript } from './church-form/ChurchFormScript';

type ChurchFormProps = {
  action: string;
  church?: Church;
  gatherings?: ChurchGathering[];
  affiliations?: Affiliation[];
  churchAffiliations?: ChurchAffiliation[];
  churchImages?: ChurchImage[];
  imagesData?: Array<{
    id: number;
    imagePath: string;
    imageAlt: string | null;
    caption: string | null;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    sortOrder: number;
    isFeatured: boolean;
  }>;
  counties?: County[];
  error?: string;
  isNew?: boolean;
  cancelUrl?: string;
  r2Domain?: string;
  domain?: string;
};

export const ChurchForm: FC<ChurchFormProps> = ({
  action,
  church,
  gatherings = [],
  affiliations = [],
  churchAffiliations = [],
  churchImages = [],
  imagesData = [],
  counties = [],
  error,
  isNew = false,
  cancelUrl,
  r2Domain,
  domain = 'localhost',
}) => {
  const statusOptions = ['Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed'];
  const selectedAffiliationIds = churchAffiliations.map((ca) => ca.affiliationId);

  return (
    <>
      <form
        method="post"
        action={action}
        onsubmit="handleFormSubmit(event)"
        class="space-y-8"
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
                <ChurchFormBasicInfo church={church} statusOptions={statusOptions} />
                <ChurchFormLocation church={church} counties={counties} />

                {/* Geocoding button */}
                <div class="sm:col-span-6">
                  <button
                    type="button"
                    id="geocode-button"
                    onclick="getCoordinates()"
                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <span id="geocode-button-text">Get Coordinates</span>
                  </button>
                  <p class="mt-2 text-sm text-gray-500">
                    Click to automatically populate latitude and longitude from the address
                  </p>
                  <div id="geocode-message" class="mt-2 hidden"></div>
                </div>

                <ChurchFormGatherings church={church} gatherings={gatherings} />
                <ChurchFormContact church={church} />
                <ChurchFormAffiliations affiliations={affiliations} selectedAffiliationIds={selectedAffiliationIds} />
                <ChurchFormAdditional church={church} />

                {/* Church Images */}
                <div class="sm:col-span-6">
                  <ChurchImageUpload
                    churchImages={
                      imagesData.length > 0
                        ? imagesData
                        : churchImages.map((img, index) => ({
                            id: img.id,
                            imagePath: img.imagePath,
                            imageAlt: img.imageAlt,
                            caption: img.caption,
                            width: img.width,
                            height: img.height,
                            blurhash: img.blurhash,
                            sortOrder: img.sortOrder,
                            isFeatured: index === 0,
                          }))
                    }
                    domain={domain}
                    r2Domain={r2Domain}
                    churchId={church?.id}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-x-6">
          <a href={cancelUrl || '/admin/churches'} class="text-sm font-semibold leading-6 text-gray-900">
            Cancel
          </a>
          <button
            type="submit"
            id="submit-button"
            data-testid="btn-submit"
            class="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            <span class="button-text">{isNew ? 'Create Church' : 'Save Changes'}</span>
            <span class="button-spinner hidden ml-2">
              <svg
                class="animate-spin h-4 w-4 text-white"
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
            </span>
          </button>
        </div>
      </form>

      <ChurchFormScript />
    </>
  );
};
