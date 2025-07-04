// Church filters client-side functionality
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('search');
  const countySelect = document.getElementById('county');
  const affiliationSelect = document.getElementById('affiliation');
  const statusSelect = document.getElementById('status');
  const filterForm = document.getElementById('church-filters-form');
  const clearFiltersSection = document.getElementById('clear-filters-section');
  const tableBody = document.querySelector('tbody');
  
  if (!filterForm || !tableBody) return;

  // Store all church rows for filtering
  const allRows = Array.from(tableBody.querySelectorAll('tr'));
  
  // Add data attributes to rows for filtering
  allRows.forEach(row => {
    const churchName = row.querySelector('td:first-child a')?.textContent?.toLowerCase() || '';
    const address = row.querySelector('td:nth-child(4)')?.textContent?.toLowerCase() || '';
    const status = row.querySelector('td:nth-child(2) span')?.textContent || '';
    const county = row.querySelector('td:nth-child(3)')?.textContent || '';
    
    row.dataset.searchText = `${churchName} ${address}`;
    row.dataset.status = status;
    row.dataset.county = county;
  });

  // Function to filter rows
  function filterRows() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCounty = countySelect.value;
    const selectedAffiliation = affiliationSelect.value;
    const selectedStatus = statusSelect.value;
    
    let visibleCount = 0;
    
    allRows.forEach(row => {
      let visible = true;
      
      // Search filter
      if (searchTerm && !row.dataset.searchText.includes(searchTerm)) {
        visible = false;
      }
      
      // County filter
      if (selectedCounty && row.dataset.county !== countySelect.options[countySelect.selectedIndex].text) {
        visible = false;
      }
      
      // Status filter
      if (selectedStatus && row.dataset.status !== selectedStatus) {
        visible = false;
      }
      
      // Show/hide row
      row.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });
    
    // Show/hide "no results" message
    let noResultsRow = tableBody.querySelector('.no-results');
    if (visibleCount === 0) {
      if (!noResultsRow) {
        noResultsRow = document.createElement('tr');
        noResultsRow.className = 'no-results';
        noResultsRow.innerHTML = '<td colspan="5" class="text-center py-12 text-sm text-gray-500">No churches found matching your criteria.</td>';
        tableBody.appendChild(noResultsRow);
      }
      noResultsRow.style.display = '';
    } else if (noResultsRow) {
      noResultsRow.style.display = 'none';
    }
    
    // Update URL without page reload
    updateURL();
    
    // Update clear filters visibility
    updateClearFiltersVisibility();
  }

  // Function to update URL
  function updateURL() {
    const params = new URLSearchParams();
    
    if (searchInput.value) params.append('search', searchInput.value);
    if (countySelect.value) params.append('county', countySelect.value);
    if (affiliationSelect.value) params.append('affiliation', affiliationSelect.value);
    if (statusSelect.value) params.append('status', statusSelect.value);
    
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }

  // Function to update clear filters visibility
  function updateClearFiltersVisibility() {
    const hasFilters = searchInput.value || countySelect.value || affiliationSelect.value || statusSelect.value;
    if (clearFiltersSection) {
      clearFiltersSection.style.display = hasFilters ? 'block' : 'none';
    }
  }

  // Debounce function for search input
  let searchTimeout;
  function debounceSearch(func, delay) {
    return function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(func, delay);
    };
  }

  // Add event listeners for instant filtering
  searchInput.addEventListener('input', debounceSearch(filterRows, 300));
  countySelect.addEventListener('change', filterRows);
  affiliationSelect.addEventListener('change', filterRows);
  statusSelect.addEventListener('change', filterRows);

  // Prevent form submission
  filterForm.addEventListener('submit', function(e) {
    e.preventDefault();
  });
  
  // Note: Affiliation filtering requires server-side logic due to many-to-many relationship
  // For now, affiliation filter will trigger a page reload
  affiliationSelect.addEventListener('change', function() {
    if (this.value) {
      filterForm.submit();
    } else {
      filterRows();
    }
  });
});