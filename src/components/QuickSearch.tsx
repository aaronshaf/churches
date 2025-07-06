import type { FC } from 'hono/jsx';

type QuickSearchProps = {
  userRole?: string;
};

export const QuickSearch: FC<QuickSearchProps> = ({ userRole }) => {
  // Quick search is available for all users
  // userRole determines which churches are searchable

  return (
    <>
      {/* Quick Search Modal */}
      <div
        id="quick-search-modal"
        class="hidden fixed inset-0 z-50 overflow-y-auto"
        aria-labelledby="quick-search-title"
        role="dialog"
        aria-modal="true"
      >
        <div class="flex items-start justify-center min-h-screen pt-20 px-4 pb-20 text-center sm:block sm:p-0">
          {/* Background overlay */}
          <div
            class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            aria-hidden="true"
            onclick="closeQuickSearch()"
          ></div>

          {/* Modal panel */}
          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
            <div class="bg-white">
              <div class="border-b border-gray-200 px-4 py-3">
                <div class="flex items-center">
                  <div class="flex-1 relative">
                    <input
                      type="text"
                      id="quick-search-input"
                      class="w-full pl-10 pr-4 py-2 border-0 focus:ring-0 focus:outline-none text-lg"
                      placeholder="Search for a church, county, or network..."
                      autocomplete="off"
                      oninput="performQuickSearch(this.value)"
                      onkeydown="handleQuickSearchKeydown(event)"
                    />
                    <div class="absolute left-3 top-3">
                      <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <button type="button" class="ml-3 text-gray-400 hover:text-gray-500" onclick="closeQuickSearch()">
                    <span class="sr-only">Close</span>
                    <kbd class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      ESC
                    </kbd>
                  </button>
                </div>
              </div>
              <div id="quick-search-results" class="max-h-96 overflow-y-auto">
                <div class="px-4 py-8 text-center text-gray-500">
                  <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p class="mt-2 text-sm">Start typing to search for churches</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Search Script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            let allChurches = [];
            let allCounties = [];
            let allAffiliations = [];
            let quickSearchResults = [];
            let selectedIndex = -1;
            let dataLoaded = false;
            let searchDebounceTimer = null;
            const userRole = '${userRole || ''}';

            // Initialize quick search
            document.addEventListener('DOMContentLoaded', function() {
              // Preload all data
              loadAllData();
              
              // Listen for forward slash key
              document.addEventListener('keydown', function(e) {
                // Check if user is not in an input field
                const tagName = e.target.tagName.toLowerCase();
                const isInputField = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || e.target.contentEditable === 'true';
                
                if (e.key === '/' && !isInputField && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  openQuickSearch();
                }
              });
            });

            async function loadAllData() {
              if (dataLoaded) return;
              
              try {
                const [churchesResponse, countiesResponse, affiliationsResponse] = await Promise.all([
                  fetch('/api/churches?limit=1000'),
                  fetch('/api/counties'),
                  fetch('/api/networks')
                ]);
                
                if (churchesResponse.ok) {
                  const data = await churchesResponse.json();
                  allChurches = data.churches || [];
                }
                
                if (countiesResponse.ok) {
                  const data = await countiesResponse.json();
                  allCounties = data || [];
                }
                
                if (affiliationsResponse.ok) {
                  const data = await affiliationsResponse.json();
                  allAffiliations = data || [];
                }
                
                dataLoaded = true;
              } catch (error) {
                console.error('Failed to load data:', error);
              }
            }

            function openQuickSearch() {
              const modal = document.getElementById('quick-search-modal');
              const input = document.getElementById('quick-search-input');
              
              if (modal && input) {
                modal.classList.remove('hidden');
                input.value = '';
                input.focus();
                resetQuickSearch();
              }
            }

            function closeQuickSearch() {
              const modal = document.getElementById('quick-search-modal');
              if (modal) {
                modal.classList.add('hidden');
                resetQuickSearch();
              }
              // Clear any pending debounce timer
              if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = null;
              }
            }

            function resetQuickSearch() {
              quickSearchResults = [];
              selectedIndex = -1;
              const resultsContainer = document.getElementById('quick-search-results');
              if (resultsContainer) {
                resultsContainer.innerHTML = \`
                  <div class="px-4 py-8 text-center text-gray-500">
                    <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p class="mt-2 text-sm">Start typing to search for churches</p>
                  </div>
                \`;
              }
            }

            function performQuickSearch(query) {
              // Clear any existing debounce timer
              if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = null;
              }

              if (!query || query.length < 1) {
                resetQuickSearch();
                return;
              }

              // Instant client-side filtering
              const searchQuery = query.toLowerCase();
              const results = [];
              
              // Search churches
              const churchResults = allChurches
                .filter(church => {
                  if (!church.name) return false;
                  
                  // Filter out heretical churches for non-admin/contributor users
                  if (userRole !== 'admin' && userRole !== 'contributor' && church.status === 'Heretical') {
                    return false;
                  }
                  
                  const name = church.name.toLowerCase();
                  const path = (church.path || '').toLowerCase();
                  // Extract domain from website URL
                  const website = (church.website || '').toLowerCase();
                  const domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
                  
                  return name.includes(searchQuery) || path.includes(searchQuery) || domain.includes(searchQuery);
                })
                .map(church => ({ ...church, type: 'church' }))
                .sort((a, b) => {
                  const aName = a.name.toLowerCase();
                  const bName = b.name.toLowerCase();
                  const aPath = (a.path || '').toLowerCase();
                  const bPath = (b.path || '').toLowerCase();
                  
                  // Prioritize exact name matches
                  const aNameStartsWith = aName.startsWith(searchQuery);
                  const bNameStartsWith = bName.startsWith(searchQuery);
                  if (aNameStartsWith && !bNameStartsWith) return -1;
                  if (!aNameStartsWith && bNameStartsWith) return 1;
                  
                  // Then prioritize exact path matches
                  const aPathStartsWith = aPath.startsWith(searchQuery);
                  const bPathStartsWith = bPath.startsWith(searchQuery);
                  if (aPathStartsWith && !bPathStartsWith) return -1;
                  if (!aPathStartsWith && bPathStartsWith) return 1;
                  
                  return a.name.localeCompare(b.name);
                });
              
              // Search counties
              const countyResults = allCounties
                .filter(county => {
                  if (!county.name) return false;
                  const name = county.name.toLowerCase();
                  const path = (county.path || '').toLowerCase();
                  return name.includes(searchQuery) || path.includes(searchQuery);
                })
                .map(county => ({ ...county, type: 'county' }))
                .sort((a, b) => {
                  const aName = a.name.toLowerCase();
                  const bName = b.name.toLowerCase();
                  const aPath = (a.path || '').toLowerCase();
                  const bPath = (b.path || '').toLowerCase();
                  
                  // Prioritize exact name matches
                  const aNameStartsWith = aName.startsWith(searchQuery);
                  const bNameStartsWith = bName.startsWith(searchQuery);
                  if (aNameStartsWith && !bNameStartsWith) return -1;
                  if (!aNameStartsWith && bNameStartsWith) return 1;
                  
                  // Then prioritize exact path matches
                  const aPathStartsWith = aPath.startsWith(searchQuery);
                  const bPathStartsWith = bPath.startsWith(searchQuery);
                  if (aPathStartsWith && !bPathStartsWith) return -1;
                  if (!aPathStartsWith && bPathStartsWith) return 1;
                  
                  return a.name.localeCompare(b.name);
                });
              
              // Search affiliations
              const affiliationResults = allAffiliations
                .filter(affiliation => {
                  if (!affiliation.name) return false;
                  const name = affiliation.name.toLowerCase();
                  // For affiliations, also search by ID since that's used in URLs
                  const idString = (affiliation.id || '').toString();
                  return name.includes(searchQuery) || idString.includes(searchQuery);
                })
                .map(affiliation => ({ ...affiliation, type: 'affiliation' }))
                .sort((a, b) => {
                  const aName = a.name.toLowerCase();
                  const bName = b.name.toLowerCase();
                  const aStartsWith = aName.startsWith(searchQuery);
                  const bStartsWith = bName.startsWith(searchQuery);
                  
                  if (aStartsWith && !bStartsWith) return -1;
                  if (!aStartsWith && bStartsWith) return 1;
                  
                  return a.name.localeCompare(b.name);
                });
              
              // Combine results - churches first, then counties, then affiliations
              quickSearchResults = [
                ...churchResults.slice(0, 5),
                ...countyResults.slice(0, 3),
                ...affiliationResults.slice(0, 2)
              ].slice(0, 10);
              
              // If no results found, try fuzzy search
              if (quickSearchResults.length === 0) {
                quickSearchResults = performFuzzySearch(searchQuery);
              }
              
              selectedIndex = -1;
              displayQuickSearchResults();
              
              // Set up debounce timer to prefetch first result after 200ms
              if (quickSearchResults.length > 0) {
                searchDebounceTimer = setTimeout(() => {
                  prefetchResult(quickSearchResults[0]);
                }, 200);
              }
            }
            
            function performFuzzySearch(query) {
              const results = [];
              const searchWords = query.toLowerCase().split(/\s+/);
              
              // Fuzzy search churches
              const churchResults = allChurches
                .filter(church => {
                  if (!church.name) return false;
                  
                  // Filter out heretical churches for non-admin/contributor users
                  if (userRole !== 'admin' && userRole !== 'contributor' && church.status === 'Heretical') {
                    return false;
                  }
                  
                  const name = church.name.toLowerCase();
                  const path = (church.path || '').toLowerCase();
                  // Extract domain from website URL
                  const website = (church.website || '').toLowerCase();
                  const domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
                  
                  // Check if all search words appear anywhere in the name, path, or domain
                  return searchWords.every(word => name.includes(word) || path.includes(word) || domain.includes(word));
                })
                .map(church => ({ ...church, type: 'church' }))
                .slice(0, 5);
              
              // Fuzzy search counties
              const countyResults = allCounties
                .filter(county => {
                  if (!county.name) return false;
                  const name = county.name.toLowerCase();
                  const path = (county.path || '').toLowerCase();
                  return searchWords.every(word => name.includes(word) || path.includes(word));
                })
                .map(county => ({ ...county, type: 'county' }))
                .slice(0, 3);
              
              // Fuzzy search affiliations
              const affiliationResults = allAffiliations
                .filter(affiliation => {
                  if (!affiliation.name) return false;
                  const name = affiliation.name.toLowerCase();
                  const idString = (affiliation.id || '').toString();
                  return searchWords.every(word => name.includes(word) || idString.includes(word));
                })
                .map(affiliation => ({ ...affiliation, type: 'affiliation' }))
                .slice(0, 2);
              
              return [...churchResults, ...countyResults, ...affiliationResults].slice(0, 10);
            }

            function displayQuickSearchResults() {
              const resultsContainer = document.getElementById('quick-search-results');
              if (!resultsContainer) return;

              if (quickSearchResults.length === 0) {
                resultsContainer.innerHTML = \`
                  <div class="px-4 py-8 text-center text-gray-500">
                    <p class="text-sm">No churches found</p>
                  </div>
                \`;
                return;
              }

              resultsContainer.innerHTML = quickSearchResults.map((result, index) => {
                const isSelected = index === selectedIndex;
                let href, title, subtitle, typeLabel, typeColor;
                
                if (result.type === 'church') {
                  href = \`/churches/\${result.path}\`;
                  title = result.name;
                  subtitle = result.gatheringAddress || '';
                  typeLabel = result.status || 'Church';
                  if (result.status === 'Listed') {
                    typeColor = isSelected ? 'bg-blue-100 text-blue-800' : 'bg-green-50 text-green-700';
                  } else {
                    typeColor = isSelected ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700';
                  }
                } else if (result.type === 'county') {
                  href = \`/counties/\${result.path}\`;
                  title = result.name + ' County';
                  subtitle = result.description || 'View all churches';
                  typeLabel = 'County';
                  typeColor = isSelected ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
                } else if (result.type === 'affiliation') {
                  href = \`/networks/\${result.id}\`;
                  title = result.name;
                  subtitle = result.publicNotes || 'Church network';
                  typeLabel = 'Network';
                  typeColor = isSelected ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
                }
                
                return \`
                  <a
                    href="\${href}"
                    class="quick-search-result group block transition-colors duration-150 ease-in-out border-b border-gray-100 last:border-0 \${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}"
                    style="padding: 12px 16px 12px \${isSelected ? '12px' : '16px'}; border-left: \${isSelected ? '4px solid #3b82f6' : 'none'};"
                    data-index="\${index}"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate \${isSelected ? 'text-blue-900' : 'text-gray-900 group-hover:text-gray-900'}">\${title}</p>
                        <p class="text-xs truncate \${isSelected ? 'text-blue-700' : 'text-gray-500 group-hover:text-gray-600'}">\${subtitle}</p>
                      </div>
                      <div class="flex items-center ml-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium \${typeColor}">\${typeLabel}</span>
                        <svg class="ml-2 h-4 w-4 \${isSelected ? 'text-blue-500' : 'text-transparent'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                      </div>
                    </div>
                  </a>
                \`;
              }).join('');
            }

            function updateSelectedResult() {
              // Re-render results to update selection state
              displayQuickSearchResults();
            }


            function prefetchResult(result) {
              if (!result) return;
              
              let url;
              if (result.type === 'church') {
                url = \`/churches/\${result.path}\`;
              } else if (result.type === 'county') {
                url = \`/counties/\${result.path}\`;
              } else if (result.type === 'affiliation') {
                url = \`/networks/\${result.id}\`;
              }
              
              if (!url) return;
              
              // Check if already prefetched
              if (document.querySelector(\`link[href="\${url}"][rel="prefetch"]\`)) {
                return;
              }
              
              // Create prefetch link
              const link = document.createElement('link');
              link.rel = 'prefetch';
              link.href = url;
              document.head.appendChild(link);
            }

            function handleQuickSearchKeydown(event) {
              if (event.key === 'Escape') {
                closeQuickSearch();
                return;
              }

              if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (quickSearchResults.length > 0 && selectedIndex < quickSearchResults.length - 1) {
                  selectedIndex++;
                  updateSelectedResult();
                }
                return;
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (selectedIndex > -1) {
                  selectedIndex--;
                  updateSelectedResult();
                }
                return;
              }

              if (event.key === 'Enter') {
                event.preventDefault();
                // If no item is selected but there are results, select the first one
                let targetIndex = selectedIndex;
                if (selectedIndex === -1 && quickSearchResults.length > 0) {
                  targetIndex = 0;
                }
                
                if (targetIndex >= 0 && quickSearchResults[targetIndex]) {
                  const result = quickSearchResults[targetIndex];
                  let url;
                  if (result.type === 'church') {
                    url = \`/churches/\${result.path}\`;
                  } else if (result.type === 'county') {
                    url = \`/counties/\${result.path}\`;
                  } else if (result.type === 'affiliation') {
                    url = \`/networks/\${result.id}\`;
                  }
                  if (url) {
                    window.location.href = url;
                  }
                }
                return;
              }
            }

            // Close modal when clicking escape
            document.addEventListener('keydown', function(e) {
              if (e.key === 'Escape') {
                const modal = document.getElementById('quick-search-modal');
                if (modal && !modal.classList.contains('hidden')) {
                  closeQuickSearch();
                }
              }
            });
          `,
        }}
      />
    </>
  );
};
