import type { FC } from 'hono/jsx';

type Church = {
  id: number;
  name: string;
  path: string | null;
  status: string | null;
  gatheringAddress: string | null;
  countyName?: string | null;
  serviceTimes: string | null;
  website: string | null;
  language?: string | null;
  publicNotes?: string | null;
};

type ChurchCardProps = {
  church: Church;
};

const statusStyles: Record<string, string> = {
  Listed: 'bg-green-50 text-green-700 ring-green-600/20',
  'Ready to list': 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Assess: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  'Needs data': 'bg-orange-50 text-orange-700 ring-orange-600/20',
  Unlisted: 'bg-gray-50 text-gray-700 ring-gray-600/20',
  Heretical: 'bg-red-50 text-red-700 ring-red-600/20',
  Closed: 'bg-gray-800 text-white ring-gray-800',
};

export const ChurchCard: FC<ChurchCardProps> = ({ church }) => {
  const statusStyle = church.status ? statusStyles[church.status] || '' : '';

  return (
    <div class="group relative bg-white rounded-lg shadow-sm ring-1 ring-gray-200 hover:shadow-md transition-all duration-200">
      <div class="p-6">
        {/* Church Name */}
        <h3 class="text-lg font-semibold text-gray-900 mb-3">
          {church.path ? (
            <a href={`/churches/${church.path}`} class="hover:text-primary-600 transition-colors">
              {church.name}
            </a>
          ) : (
            church.name
          )}
        </h3>

        {/* Church Details */}
        <div class="space-y-2">
          {church.gatheringAddress && (
            <div class="flex items-start text-sm text-gray-600">
              <svg
                class="w-4 h-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>{church.gatheringAddress}</span>
            </div>
          )}

          {church.countyName && (
            <div class="flex items-start text-sm text-gray-600">
              <svg
                class="w-4 h-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                />
              </svg>
              <span>{church.countyName} County</span>
            </div>
          )}

          {church.serviceTimes && (
            <div class="flex items-start text-sm text-gray-600">
              <svg
                class="w-4 h-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{church.serviceTimes}</span>
            </div>
          )}

          {church.website && (
            <div class="flex items-start text-sm">
              <svg
                class="w-4 h-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              <a
                href={church.website}
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-600 hover:text-primary-500 transition-colors"
              >
                Visit Website
              </a>
            </div>
          )}

          {church.language && church.language !== 'English' && (
            <div class="flex items-start text-sm text-gray-600">
              <svg
                class="w-4 h-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
              </svg>
              <span>{church.language}</span>
            </div>
          )}

          {church.publicNotes && <p class="text-sm text-gray-600 italic mt-3">{church.publicNotes}</p>}
        </div>

        {/* Status Badge */}
        {church.status && church.status !== 'Listed' && (
          <div class="mt-4">
            <span
              class={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusStyle}`}
            >
              {church.status}
            </span>
          </div>
        )}
      </div>

      {/* Hover effect border */}
      <div class="absolute inset-0 rounded-lg ring-1 ring-inset ring-gray-200 group-hover:ring-primary-500 transition-all duration-200 pointer-events-none"></div>
    </div>
  );
};
