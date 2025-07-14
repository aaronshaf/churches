import type { FC } from 'hono/jsx';
import type { SupportedLanguage } from '../lib/i18n';

type QuickSearchProps = {
  userRole?: string;
  language?: SupportedLanguage;
  t?: (key: string, options?: object) => string;
};

export const QuickSearch: FC<QuickSearchProps> = ({ userRole, language = 'en', t = (key: string) => key }) => {
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
        data-testid="quick-search-modal"
      >
        <div class="flex items-start justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:pt-20 sm:block sm:p-0">
          {/* Background overlay */}
          <div
            class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            aria-hidden="true"
            onclick="closeQuickSearch()"
            data-testid="quick-search-overlay"
          ></div>

          {/* Modal panel */}
          <div
            class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-lg mx-auto sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full"
            data-testid="quick-search-panel"
          >
            <div class="bg-white">
              <div class="border-b border-gray-200 px-4 py-3">
                <div class="flex items-center">
                  <div class="flex-1 relative">
                    <input
                      type="text"
                      id="quick-search-input"
                      class="w-full pl-10 pr-4 py-2 border-0 focus:ring-0 focus:outline-none text-lg"
                      placeholder={t('search.placeholder')}
                      autocomplete="off"
                      oninput="performQuickSearch(this.value)"
                      onkeydown="handleQuickSearchKeydown(event)"
                      data-testid="quick-search-input"
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
                  <button
                    type="button"
                    class="ml-3 text-gray-400 hover:text-gray-500"
                    onclick="closeQuickSearch()"
                    data-testid="quick-search-close"
                  >
                    <span class="sr-only">Close</span>
                    <kbd class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      ESC
                    </kbd>
                  </button>
                </div>
              </div>
              <div id="quick-search-results" class="max-h-96 overflow-y-auto" data-testid="quick-search-results">
                <div class="px-4 py-6 text-center text-gray-500">
                  <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p class="mt-2 text-sm">{t('search.typeToSearch')}</p>
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
            let pendingSearchQuery = null; // Store query typed while data is loading
            let hoverTimeout = null; // Store hover timeout for prefetching
            let searchSpinnerTimeout = null; // Store search spinner timeout
            const userRole = '${userRole || ''}';
            const translations = {
              loading: ${JSON.stringify(t('search.loading'))},
              typeToSearch: ${JSON.stringify(t('search.typeToSearch'))},
              noResults: ${JSON.stringify(t('search.noResults'))},
              fuzzyResults: ${JSON.stringify(t('search.fuzzyResults', { defaultValue: 'Similar results:' }))}
            };
            
            // Cache keys
            const CACHE_KEY_CHURCHES = 'utahchurches_search_churches';
            const CACHE_KEY_COUNTIES = 'utahchurches_search_counties';
            const CACHE_KEY_AFFILIATIONS = 'utahchurches_search_affiliations';
            const CACHE_EXPIRY = 3600000; // 1 hour in milliseconds

            // Initialize quick search
            document.addEventListener('DOMContentLoaded', function() {
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

            // Helper function to get cached data
            function getCachedData(key) {
              try {
                const cached = localStorage.getItem(key);
                if (!cached) return null;
                
                const data = JSON.parse(cached);
                const now = Date.now();
                
                // Check if cache is expired
                if (data.expiry && now > data.expiry) {
                  localStorage.removeItem(key);
                  return null;
                }
                
                return data.value;
              } catch (error) {
                console.error('Error reading from cache:', error);
                return null;
              }
            }

            // Helper function to set cached data
            function setCachedData(key, value) {
              try {
                const data = {
                  value: value,
                  expiry: Date.now() + CACHE_EXPIRY
                };
                localStorage.setItem(key, JSON.stringify(data));
              } catch (error) {
                console.error('Error writing to cache:', error);
                // If localStorage is full, clear old cache
                if (error.name === 'QuotaExceededError') {
                  localStorage.removeItem(CACHE_KEY_CHURCHES);
                  localStorage.removeItem(CACHE_KEY_COUNTIES);
                  localStorage.removeItem(CACHE_KEY_AFFILIATIONS);
                }
              }
            }

            async function loadAllData() {
              if (dataLoaded) return;
              
              // Try to load from localStorage first
              const cachedChurches = getCachedData(CACHE_KEY_CHURCHES);
              const cachedCounties = getCachedData(CACHE_KEY_COUNTIES);
              const cachedAffiliations = getCachedData(CACHE_KEY_AFFILIATIONS);
              
              if (cachedChurches && cachedCounties && cachedAffiliations) {
                allChurches = cachedChurches;
                allCounties = cachedCounties;
                allAffiliations = cachedAffiliations;
                dataLoaded = true;
                
                // Re-run search if user has already typed something
                const input = document.getElementById('quick-search-input');
                const queryToRun = pendingSearchQuery || (input && input.value.trim());
                if (queryToRun) {
                  pendingSearchQuery = null;
                  performQuickSearch(queryToRun);
                }
                
                // Still fetch fresh data in background
                fetchFreshData();
                return;
              }
              
              // If no cache, fetch from API
              await fetchFreshData();
            }
            
            async function fetchFreshData() {
              try {
                const [churchesResponse, countiesResponse, affiliationsResponse] = await Promise.all([
                  fetch('/api/churches?limit=1000'),
                  fetch('/api/counties'),
                  fetch('/api/networks')
                ]);
                
                if (churchesResponse.ok) {
                  const data = await churchesResponse.json();
                  allChurches = data.churches || [];
                  setCachedData(CACHE_KEY_CHURCHES, allChurches);
                }
                
                if (countiesResponse.ok) {
                  const data = await countiesResponse.json();
                  allCounties = data || [];
                  setCachedData(CACHE_KEY_COUNTIES, allCounties);
                }
                
                if (affiliationsResponse.ok) {
                  const data = await affiliationsResponse.json();
                  allAffiliations = data || [];
                  setCachedData(CACHE_KEY_AFFILIATIONS, allAffiliations);
                }
                
                dataLoaded = true;
                
                // Re-run search if user has already typed something or if there's a pending query
                const input = document.getElementById('quick-search-input');
                const queryToRun = pendingSearchQuery || (input && input.value.trim());
                if (queryToRun) {
                  pendingSearchQuery = null; // Clear pending query
                  performQuickSearch(queryToRun);
                }
              } catch (error) {
                console.error('Failed to load data:', error);
              }
            }

            async function openQuickSearch() {
              const modal = document.getElementById('quick-search-modal');
              const input = document.getElementById('quick-search-input');
              
              if (modal && input) {
                modal.classList.remove('hidden');
                input.value = '';
                input.focus();
                resetQuickSearch();
                
                // Load data only when search is opened
                if (!dataLoaded) {
                  const resultsContainer = document.getElementById('quick-search-results');
                  
                  // Check if we have cached data for instant loading
                  const hasCachedData = getCachedData(CACHE_KEY_CHURCHES) && 
                                       getCachedData(CACHE_KEY_COUNTIES) && 
                                       getCachedData(CACHE_KEY_AFFILIATIONS);
                  
                  if (!hasCachedData) {
                    // Show loading state only if no cached data
                    let spinnerTimeout = setTimeout(() => {
                      if (resultsContainer && !dataLoaded) {
                        resultsContainer.innerHTML = \`
                          <div class="px-4 py-6 text-center">
                            <div class="flex justify-center space-x-1">
                              <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0ms;"></div>
                              <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 200ms;"></div>
                              <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 400ms;"></div>
                            </div>
                            <p class="mt-3 text-xs text-gray-500">Loading...</p>
                          </div>\`;
                      }
                    }, 1500);
                    
                    await loadAllData();
                    
                    clearTimeout(spinnerTimeout);
                    if (resultsContainer) {
                      resetQuickSearch();
                    }
                  } else {
                    // Load cached data instantly
                    loadAllData();
                  }
                }
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
              // Clear any pending search query
              pendingSearchQuery = null;
              // Clear any pending hover timeout
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
              }
              // Clear any pending search spinner timeout
              if (searchSpinnerTimeout) {
                clearTimeout(searchSpinnerTimeout);
                searchSpinnerTimeout = null;
              }
            }

            function resetQuickSearch() {
              quickSearchResults = [];
              selectedIndex = -1;
              const resultsContainer = document.getElementById('quick-search-results');
              if (resultsContainer) {
                resultsContainer.innerHTML = \`
                  <div class="px-4 py-6 text-center text-gray-500">
                    <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p class="mt-2 text-sm">\${translations.typeToSearch}</p>
                  </div>
                \`;
              }
            }

            // Levenshtein distance for fuzzy matching
            function levenshteinDistance(str1, str2) {
              const matrix = [];
              const len1 = str1.length;
              const len2 = str2.length;

              if (len1 === 0) return len2;
              if (len2 === 0) return len1;

              for (let i = 0; i <= len2; i++) {
                matrix[i] = [i];
              }

              for (let j = 0; j <= len1; j++) {
                matrix[0][j] = j;
              }

              for (let i = 1; i <= len2; i++) {
                for (let j = 1; j <= len1; j++) {
                  if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                  } else {
                    matrix[i][j] = Math.min(
                      matrix[i - 1][j - 1] + 1, // substitution
                      matrix[i][j - 1] + 1,     // insertion
                      matrix[i - 1][j] + 1      // deletion
                    );
                  }
                }
              }

              return matrix[len2][len1];
            }

            // Calculate similarity score (0-1, where 1 is identical)
            function calculateSimilarity(str1, str2) {
              const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
              const maxLength = Math.max(str1.length, str2.length);
              return maxLength === 0 ? 1 : 1 - (distance / maxLength);
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

              // If data isn't loaded yet, store the query and show loading state after delay
              if (!dataLoaded) {
                pendingSearchQuery = query; // Store the query to run after data loads
                
                // Clear any existing search spinner timeout
                if (searchSpinnerTimeout) {
                  clearTimeout(searchSpinnerTimeout);
                }
                
                // Show loading spinner only after 1.5 seconds
                searchSpinnerTimeout = setTimeout(() => {
                  if (!dataLoaded) {
                    const resultsContainer = document.getElementById('quick-search-results');
                    if (resultsContainer) {
                      resultsContainer.innerHTML = \`
                        <div class="px-4 py-6 text-center">
                          <div class="flex justify-center space-x-1">
                            <div class="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0ms;"></div>
                            <div class="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 150ms;"></div>
                            <div class="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 300ms;"></div>
                          </div>
                          <p class="mt-2 text-xs text-gray-500">Searching...</p>
                        </div>\`;
                    }
                  }
                }, 1500);
                
                // Start loading data if not already loading
                if (!dataLoaded) {
                  loadAllData().then(() => {
                    // Clear the search spinner timeout when data loads
                    clearTimeout(searchSpinnerTimeout);
                  });
                }
                return;
              }

              // Instant client-side filtering
              const searchQuery = query.toLowerCase();
              let results = [];
              let fuzzyResults = [];
              
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
                  // Extract website URL without protocol
                  const website = (church.website || '').toLowerCase();
                  const websiteClean = website.replace(/^https?:\\/\\//, '').replace(/^www\\./, '');
                  
                  // Check for direct substring matches
                  if (name.includes(searchQuery) || path.includes(searchQuery) || websiteClean.includes(searchQuery)) {
                    return true;
                  }
                  
                  // Check for acronym matches in multi-word searches
                  const queryWords = searchQuery.split(/\\s+/);
                  const nameWords = name.split(/\\s+/);
                  
                  // If query has multiple words, check if any word is an acronym match
                  for (const qWord of queryWords) {
                    if (qWord.length >= 2) {
                      // Check if this query word matches first letters of consecutive name words
                      for (let i = 0; i <= nameWords.length - qWord.length; i++) {
                        let acronymMatch = true;
                        for (let j = 0; j < qWord.length; j++) {
                          if (!nameWords[i + j] || nameWords[i + j][0] !== qWord[j]) {
                            acronymMatch = false;
                            break;
                          }
                        }
                        if (acronymMatch) {
                          // Check if other query words also match somewhere in the name
                          const otherWords = queryWords.filter(w => w !== qWord);
                          const matchesOtherWords = otherWords.every(otherWord => 
                            name.includes(otherWord) || websiteClean.includes(otherWord)
                          );
                          if (matchesOtherWords) {
                            return true;
                          }
                        }
                      }
                    }
                  }
                  
                  return false;
                })
                .map(church => ({ ...church, type: 'church', exactMatch: true }))
                .sort((a, b) => {
                  const aName = a.name.toLowerCase();
                  const bName = b.name.toLowerCase();
                  const aPath = (a.path || '').toLowerCase();
                  const bPath = (b.path || '').toLowerCase();
                  const aWebsite = (a.website || '').toLowerCase().replace(/^https?:\\/\\//, '').replace(/^www\\./, '');
                  const bWebsite = (b.website || '').toLowerCase().replace(/^https?:\\/\\//, '').replace(/^www\\./, '');
                  
                  // First, prioritize listed churches over unlisted
                  const aIsListed = a.status === 'Listed';
                  const bIsListed = b.status === 'Listed';
                  if (aIsListed && !bIsListed) return -1;
                  if (!aIsListed && bIsListed) return 1;
                  
                  // Then prioritize exact name matches
                  const aNameStartsWith = aName.startsWith(searchQuery);
                  const bNameStartsWith = bName.startsWith(searchQuery);
                  if (aNameStartsWith && !bNameStartsWith) return -1;
                  if (!aNameStartsWith && bNameStartsWith) return 1;
                  
                  // Then prioritize exact path matches
                  const aPathStartsWith = aPath.startsWith(searchQuery);
                  const bPathStartsWith = bPath.startsWith(searchQuery);
                  if (aPathStartsWith && !bPathStartsWith) return -1;
                  if (!aPathStartsWith && bPathStartsWith) return 1;
                  
                  // Then prioritize website matches
                  const aWebsiteStartsWith = aWebsite.startsWith(searchQuery);
                  const bWebsiteStartsWith = bWebsite.startsWith(searchQuery);
                  if (aWebsiteStartsWith && !bWebsiteStartsWith) return -1;
                  if (!aWebsiteStartsWith && bWebsiteStartsWith) return 1;
                  
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
                .map(county => ({ ...county, type: 'county', exactMatch: true }))
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
                  const path = (affiliation.path || '').toLowerCase();
                  // For affiliations, also search by ID since that's used in URLs
                  const idString = (affiliation.id || '').toString();
                  return name.includes(searchQuery) || path.includes(searchQuery) || idString.includes(searchQuery);
                })
                .map(affiliation => ({ ...affiliation, type: 'affiliation', exactMatch: true }))
                .sort((a, b) => {
                  const aName = a.name.toLowerCase();
                  const bName = b.name.toLowerCase();
                  const aPath = (a.path || '').toLowerCase();
                  const bPath = (b.path || '').toLowerCase();
                  
                  // First prioritize exact path matches
                  const aPathStartsWith = aPath.startsWith(searchQuery);
                  const bPathStartsWith = bPath.startsWith(searchQuery);
                  if (aPathStartsWith && !bPathStartsWith) return -1;
                  if (!aPathStartsWith && bPathStartsWith) return 1;
                  
                  // Then prioritize name matches
                  const aStartsWith = aName.startsWith(searchQuery);
                  const bStartsWith = bName.startsWith(searchQuery);
                  
                  if (aStartsWith && !bStartsWith) return -1;
                  if (!aStartsWith && bStartsWith) return 1;
                  
                  return a.name.localeCompare(b.name);
                });
              
              // Combine exact match results
              results = [
                ...churchResults.slice(0, 5),
                ...countyResults.slice(0, 3),
                ...affiliationResults.slice(0, 2)
              ].slice(0, 10);
              
              // If fewer than 10 exact matches, perform fuzzy search to fill out results
              if (results.length < 10 && searchQuery.length >= 3) {
                fuzzyResults = performFuzzySearch(searchQuery);
                // Filter out any fuzzy results that are already in exact results
                const exactIds = new Set(results.map(r => r.id));
                const uniqueFuzzyResults = fuzzyResults.filter(r => !exactIds.has(r.id));
                // Combine exact and fuzzy results, keeping exact matches first
                results = [...results, ...uniqueFuzzyResults].slice(0, 10);
              }
              
              quickSearchResults = results;
              
              // Set first result as selected by default if there are results
              selectedIndex = quickSearchResults.length > 0 ? 0 : -1;
              // Check if we have any fuzzy results in our final results
              const hasFuzzyResults = quickSearchResults.some(r => !r.exactMatch);
              displayQuickSearchResults(hasFuzzyResults);
              
              // Set up debounce timer to prefetch first result after 200ms
              if (quickSearchResults.length > 0) {
                searchDebounceTimer = setTimeout(() => {
                  prefetchResult(quickSearchResults[0]);
                }, 200);
              }
            }
            
            function performFuzzySearch(query) {
              const results = [];
              const threshold = 0.5; // Lowered threshold to get more fuzzy matches when needed
              
              // Fuzzy search churches
              const churchResults = allChurches
                .map(church => {
                  if (!church.name) return null;
                  
                  // Filter out heretical churches for non-admin/contributor users
                  if (userRole !== 'admin' && userRole !== 'contributor' && church.status === 'Heretical') {
                    return null;
                  }
                  
                  const name = church.name.toLowerCase();
                  const path = (church.path || '').toLowerCase();
                  // Extract website URL without protocol
                  const website = (church.website || '').toLowerCase();
                  const websiteClean = website.replace(/^https?:\\/\\//, '').replace(/^www\\./, '');
                  
                  // Calculate similarity scores
                  const nameSimilarity = calculateSimilarity(query, name);
                  const pathSimilarity = calculateSimilarity(query, path);
                  const websiteSimilarity = calculateSimilarity(query, websiteClean);
                  
                  // Also check for substring matches in different word order
                  const queryWords = query.split(/\\s+/);
                  const nameWords = name.split(/\\s+/);
                  const websiteWords = websiteClean.split(/[\\s\\.\\-\\_]+/); // Split on spaces, dots, dashes, underscores
                  let wordMatchScore = 0;
                  
                  queryWords.forEach(qWord => {
                    // Direct substring matches
                    nameWords.forEach(nWord => {
                      if (nWord.includes(qWord) || qWord.includes(nWord)) {
                        wordMatchScore += 0.5;
                      }
                    });
                    websiteWords.forEach(wWord => {
                      if (wWord.includes(qWord) || qWord.includes(wWord)) {
                        wordMatchScore += 0.3; // Slightly lower weight for website matches
                      }
                    });
                    
                    // Acronym matching - check if query word matches first letters of consecutive name words
                    if (qWord.length >= 2) {
                      for (let i = 0; i <= nameWords.length - qWord.length; i++) {
                        let acronymMatch = true;
                        for (let j = 0; j < qWord.length; j++) {
                          if (!nameWords[i + j] || nameWords[i + j][0] !== qWord[j]) {
                            acronymMatch = false;
                            break;
                          }
                        }
                        if (acronymMatch) {
                          wordMatchScore += 0.7; // Higher weight for acronym matches
                          break;
                        }
                      }
                    }
                  });
                  
                  const maxScore = Math.max(nameSimilarity, pathSimilarity, websiteSimilarity, wordMatchScore / queryWords.length);
                  
                  if (maxScore >= threshold) {
                    return { ...church, type: 'church', score: maxScore, exactMatch: false };
                  }
                  
                  return null;
                })
                .filter(result => result !== null)
                .sort((a, b) => {
                  // First, prioritize listed churches
                  const aIsListed = a.status === 'Listed';
                  const bIsListed = b.status === 'Listed';
                  if (aIsListed && !bIsListed) return -1;
                  if (!aIsListed && bIsListed) return 1;
                  
                  // Then sort by similarity score
                  return b.score - a.score;
                })
                .slice(0, 15); // Get more results to ensure we can fill to 10 total
              
              // Fuzzy search counties
              const countyResults = allCounties
                .map(county => {
                  if (!county.name) return null;
                  
                  const name = county.name.toLowerCase();
                  const path = (county.path || '').toLowerCase();
                  
                  const nameSimilarity = calculateSimilarity(query, name);
                  const pathSimilarity = calculateSimilarity(query, path);
                  const maxScore = Math.max(nameSimilarity, pathSimilarity);
                  
                  if (maxScore >= threshold) {
                    return { ...county, type: 'county', score: maxScore, exactMatch: false };
                  }
                  
                  return null;
                })
                .filter(result => result !== null)
                .sort((a, b) => b.score - a.score)
                .slice(0, 8); // Get more results to ensure we can fill to 10 total
              
              // Fuzzy search affiliations
              const affiliationResults = allAffiliations
                .map(affiliation => {
                  if (!affiliation.name) return null;
                  
                  const name = affiliation.name.toLowerCase();
                  const path = (affiliation.path || '').toLowerCase();
                  
                  const nameSimilarity = calculateSimilarity(query, name);
                  const pathSimilarity = calculateSimilarity(query, path);
                  const maxScore = Math.max(nameSimilarity, pathSimilarity);
                  
                  if (maxScore >= threshold) {
                    return { ...affiliation, type: 'affiliation', score: maxScore, exactMatch: false };
                  }
                  
                  return null;
                })
                .filter(result => result !== null)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5); // Get more results to ensure we can fill to 10 total
              
              // Return more than 10 so the main function can properly filter duplicates and slice to 10
              return [...churchResults, ...countyResults, ...affiliationResults];
            }

            function displayQuickSearchResults(hasFuzzyResults = false) {
              const resultsContainer = document.getElementById('quick-search-results');
              if (!resultsContainer) return;

              if (quickSearchResults.length === 0) {
                resultsContainer.innerHTML = \`
                  <div class="px-4 py-6 text-center text-gray-500">
                    <p class="text-sm">\${translations.noResults}</p>
                  </div>
                \`;
                return;
              }

              let html = '';
              let lastWasExact = true;
              
              quickSearchResults.forEach((result, index) => {
                // Add fuzzy results header when we transition from exact to fuzzy
                if (lastWasExact && !result.exactMatch && hasFuzzyResults) {
                  html += \`<div class="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b">\${translations.fuzzyResults}</div>\`;
                  lastWasExact = false;
                }

                html += renderSearchResult(result, index);
              });

              resultsContainer.innerHTML = html;
            }

            function renderSearchResult(result, index) {
                const isSelected = index === selectedIndex;
                let href, title, subtitle, typeLabel, typeColor;
                
                if (result.type === 'church') {
                  href = \`/churches/\${result.path}\`;
                  title = result.name;
                  subtitle = result.gatheringAddress || '';
                  // Only show status tags for admin and contributor users
                  if (userRole === 'admin' || userRole === 'contributor') {
                    typeLabel = result.status || 'Church';
                    if (result.status === 'Listed') {
                      typeColor = 'bg-green-50 text-green-700';
                    } else {
                      typeColor = 'bg-gray-100 text-gray-700';
                    }
                  } else {
                    typeLabel = 'Church';
                    typeColor = 'bg-green-50 text-green-700';
                  }
                } else if (result.type === 'county') {
                  href = \`/counties/\${result.path}\`;
                  title = result.name;
                  subtitle = result.description || 'View all churches';
                  typeLabel = 'County';
                  typeColor = 'bg-green-100 text-green-800';
                } else if (result.type === 'affiliation') {
                  href = \`/networks/\${result.path || result.id}\`;
                  title = result.name;
                  subtitle = result.publicNotes || 'Church network';
                  typeLabel = 'Network';
                  typeColor = 'bg-purple-100 text-purple-800';
                }
                
                return \`
                  <a
                    href="\${href}"
                    class="quick-search-result group block transition-colors duration-150 ease-in-out border-b border-gray-100 last:border-0 \${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}"
                    style="padding: 12px 16px 12px \${isSelected ? '12px' : '16px'}; border-left: \${isSelected ? '4px solid #3b82f6' : 'none'};"
                    data-index="\${index}"
                    onmouseenter="handleQuickSearchHover('\${href}')"
                    onmouseleave="clearQuickSearchHover()"
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
            }

            function updateSelectedResult() {
              // Re-render results to update selection state
              displayQuickSearchResults();
              
              // Prefetch the currently selected result
              if (selectedIndex >= 0 && quickSearchResults[selectedIndex]) {
                const result = quickSearchResults[selectedIndex];
                let url;
                if (result.type === 'church') {
                  url = \`/churches/\${result.path}\`;
                } else if (result.type === 'county') {
                  url = \`/counties/\${result.path}\`;
                } else if (result.type === 'affiliation') {
                  url = \`/networks/\${result.path || result.id}\`;
                }
                if (url) {
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
              }
            }

            // Hover-intent prefetching for search results
            function handleQuickSearchHover(url) {
              // Clear any existing timeout
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
              }
              
              // Set up hover-intent delay (200ms like navbar)
              hoverTimeout = setTimeout(() => {
                // Check if already prefetched
                if (document.querySelector(\`link[href="\${url}"][rel="prefetch"]\`)) {
                  return;
                }
                
                // Create prefetch link
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = url;
                document.head.appendChild(link);
              }, 200);
            }

            function clearQuickSearchHover() {
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
              }
            }

            function prefetchResult(result) {
              if (!result) return;
              
              let url;
              if (result.type === 'church') {
                url = \`/churches/\${result.path}\`;
              } else if (result.type === 'county') {
                url = \`/counties/\${result.path}\`;
              } else if (result.type === 'affiliation') {
                url = \`/networks/\${result.path || result.id}\`;
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
                    url = \`/networks/\${result.path || result.id}\`;
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
