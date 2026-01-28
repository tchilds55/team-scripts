// Search functionality
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const searchStats = document.getElementById('searchStats');
const noResults = document.getElementById('noResults');
const weekReports = document.querySelectorAll('.week-report');

function performSearch() {
  const searchTerm = searchInput.value.toLowerCase().trim();

  // Show/hide clear button
  clearSearch.style.display = searchTerm ? 'block' : 'none';

  if (!searchTerm) {
    // Reset everything if search is empty
    document.querySelectorAll('.pr-item').forEach(item => {
      item.classList.remove('hidden');
    });
    weekReports.forEach(report => {
      report.classList.remove('no-results');
    });
    noResults.classList.remove('visible');
    searchStats.textContent = '';
    return;
  }

  let totalVisible = 0;
  let totalPRs = 0;

  // Search through all week reports
  weekReports.forEach(report => {
    const prItems = report.querySelectorAll('.pr-item');
    let visibleInWeek = 0;

    prItems.forEach(item => {
      totalPRs++;
      const title = item.querySelector('.pr-link')?.textContent.toLowerCase() || '';
      const meta = item.querySelector('.pr-meta')?.textContent.toLowerCase() || '';

      // Check if search term matches title, author, or repo
      if (title.includes(searchTerm) || meta.includes(searchTerm)) {
        item.classList.remove('hidden');
        visibleInWeek++;
        totalVisible++;
      } else {
        item.classList.add('hidden');
      }
    });

    // Dim week reports with no matching results
    if (visibleInWeek === 0) {
      report.classList.add('no-results');
    } else {
      report.classList.remove('no-results');
    }
  });

  // Show no results message if nothing found
  if (totalVisible === 0) {
    noResults.classList.add('visible');
    searchStats.textContent = '';
  } else {
    noResults.classList.remove('visible');
    searchStats.textContent = `Showing ${totalVisible} of ${totalPRs} PRs`;
  }
}

// Event listeners
searchInput.addEventListener('input', performSearch);

clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  performSearch();
  searchInput.focus();
});

// Allow Escape key to clear search
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchInput.value = '';
    performSearch();
  }
});
