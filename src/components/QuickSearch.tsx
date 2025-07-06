import type { FC } from 'hono/jsx';

type QuickSearchProps = {
  userRole?: string;
};

export const QuickSearch: FC<QuickSearchProps> = ({ userRole }) => {
  // Only show for admins and contributors
  if (!userRole || (userRole !== 'admin' && userRole !== 'contributor')) {
    return null;
  }

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
                      placeholder="Search for a church..."
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

            // Initialize quick search
            document.addEventListener('DOMContentLoaded', function() {
              // Preload church data
              loadChurchData();
              
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

            async function loadChurchData() {
              if (churchDataLoaded) return;
              
              try {
                const response = await fetch('/api/churches?limit=1000');
                if (response.ok) {
                  const data = await response.json();
                  allChurches = data.churches || [];
                  churchDataLoaded = true;
                }
              } catch (error) {
                console.error('Failed to load church data:', error);
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
              if (!query || query.length < 1) {
                resetQuickSearch();
                return;
              }

              // Instant client-side filtering
              const searchQuery = query.toLowerCase();
              quickSearchResults = allChurches
                .filter(church => church.name && church.name.toLowerCase().includes(searchQuery))
                .sort((a, b) => {
                  const aName = a.name.toLowerCase();
                  const bName = b.name.toLowerCase();
                  const aStartsWith = aName.startsWith(searchQuery);
                  const bStartsWith = bName.startsWith(searchQuery);
                  
                  // Prioritize exact matches and starts-with matches
                  if (aStartsWith && !bStartsWith) return -1;
                  if (!aStartsWith && bStartsWith) return 1;
                  
                  // Then sort alphabetically
                  return a.name.localeCompare(b.name);
                })
                .slice(0, 10); // Limit to 10 results
              
              selectedIndex = -1;
              displayQuickSearchResults();
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

              resultsContainer.innerHTML = quickSearchResults.map((church, index) => \`
                <a
                  href="/churches/\${church.path}"
                  class="quick-search-result group block px-4 py-3 transition-all duration-150 ease-in-out border-b border-gray-100 last:border-0 \${index === selectedIndex ? 'bg-blue-50 border-l-4 border-l-blue-500 text-blue-900' : 'hover:bg-gray-50 hover:border-l-4 hover:border-l-gray-300'}"
                  data-index="\${index}"
                  onmouseover="handleResultHover(\${index}, '\${church.path}')"
                  onmouseout="handleResultMouseOut()"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate \${index === selectedIndex ? 'text-blue-900' : 'text-gray-900 group-hover:text-gray-900'}">\${church.name}</p>
                      <p class="text-xs truncate \${index === selectedIndex ? 'text-blue-700' : 'text-gray-500 group-hover:text-gray-600'}">\${church.gatheringAddress || ''}</p>
                    </div>
                    <div class="flex items-center ml-3">
                      \${church.status ? \`<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium \${index === selectedIndex ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}">\${church.status}</span>\` : ''}
                      \${index === selectedIndex ? '<svg class="ml-2 h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>' : ''}
                    </div>
                  </div>
                </a>
              \`).join('');
            }

            function updateSelectedResult() {
              const results = document.querySelectorAll('.quick-search-result');
              results.forEach((result, index) => {
                if (index === selectedIndex) {
                  result.classList.remove('hover:bg-gray-50', 'hover:border-l-4', 'hover:border-l-gray-300');
                  result.classList.add('bg-blue-50', 'border-l-4', 'border-l-blue-500', 'text-blue-900');
                  
                  // Update text colors for selected state
                  const nameEl = result.querySelector('.text-gray-900, .text-blue-900');
                  const addressEl = result.querySelector('.text-gray-500, .text-blue-700');
                  const statusEl = result.querySelector('.bg-gray-100, .bg-blue-100');
                  
                  if (nameEl) {
                    nameEl.classList.remove('text-gray-900');
                    nameEl.classList.add('text-blue-900');
                  }
                  if (addressEl) {
                    addressEl.classList.remove('text-gray-500');
                    addressEl.classList.add('text-blue-700');
                  }
                  if (statusEl) {
                    statusEl.classList.remove('bg-gray-100', 'text-gray-700');
                    statusEl.classList.add('bg-blue-100', 'text-blue-800');
                  }
                  
                  // Prefetch the selected church page
                  if (quickSearchResults[selectedIndex]) {
                    prefetchChurch(quickSearchResults[selectedIndex].path);
                  }
                } else {
                  result.classList.remove('bg-blue-50', 'border-l-4', 'border-l-blue-500', 'text-blue-900');
                  result.classList.add('hover:bg-gray-50', 'hover:border-l-4', 'hover:border-l-gray-300');
                  
                  // Reset text colors
                  const nameEl = result.querySelector('.text-blue-900, .text-gray-900');
                  const addressEl = result.querySelector('.text-blue-700, .text-gray-500');
                  const statusEl = result.querySelector('.bg-blue-100, .bg-gray-100');
                  
                  if (nameEl) {
                    nameEl.classList.remove('text-blue-900');
                    nameEl.classList.add('text-gray-900');
                  }
                  if (addressEl) {
                    addressEl.classList.remove('text-blue-700');
                    addressEl.classList.add('text-gray-500');
                  }
                  if (statusEl) {
                    statusEl.classList.remove('bg-blue-100', 'text-blue-800');
                    statusEl.classList.add('bg-gray-100', 'text-gray-700');
                  }
                }
              });
            }

            function handleResultHover(index, churchPath) {
              selectedIndex = index;
              updateSelectedResult();
              prefetchChurch(churchPath);
            }

            function handleResultMouseOut() {
              // Keep the selection but don't change selectedIndex
              // This allows keyboard navigation to work properly after mouse interaction
            }

            function prefetchChurch(churchPath) {
              if (!churchPath) return;
              
              const url = \`/churches/\${churchPath}\`;
              
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
                if (selectedIndex < quickSearchResults.length - 1) {
                  selectedIndex++;
                  updateSelectedResult();
                }
                return;
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (selectedIndex > 0) {
                  selectedIndex--;
                  updateSelectedResult();
                }
                return;
              }

              if (event.key === 'Enter') {
                event.preventDefault();
                if (selectedIndex >= 0 && quickSearchResults[selectedIndex]) {
                  window.location.href = \`/churches/\${quickSearchResults[selectedIndex].path}\`;
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
