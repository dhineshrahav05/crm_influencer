/**
 * Influencer Marketing CRM — Frontend Controller
 * Plain Vanilla JS (No build step required)
 */

// =============================================================================
// API Configuration (Configurable at top of file)
// =============================================================================
const API_BASE_URL =
  window.location.origin && !window.location.origin.startsWith('file://')
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api';

// =============================================================================
// Application State
// =============================================================================
const state = {
  influencers: [],
  filteredInfluencers: [],
  selectedInfluencer: null,
  deleteTargetUsername: null,
  editTags: [],
  filters: {
    search: '',
    tag: '',
    sort: 'createdAt',
    order: 'desc'
  },
  isLoading: false,
  searchDebounceTimer: null,
  selectedUsernames: new Set()
};

// =============================================================================
// DOM Elements Cache
// =============================================================================
const elements = {
  // Metric Counters
  totalInfluencersCount: document.getElementById('totalInfluencersCount'),
  totalFollowersCount: document.getElementById('totalFollowersCount'),
  mostUsedTag: document.getElementById('mostUsedTag'),
  mostUsedTagCount: document.getElementById('mostUsedTagCount'),
  verifiedCount: document.getElementById('verifiedCount'),
  verifiedPercent: document.getElementById('verifiedPercent'),
  serverStatusPill: document.getElementById('serverStatusPill'),

  // Controls & Filters
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  tagFilter: document.getElementById('tagFilter'),
  sortSelect: document.getElementById('sortSelect'),
  refreshBtn: document.getElementById('refreshBtn'),
  openAddModalBtn: document.getElementById('openAddModalBtn'),
  resultsCountText: document.getElementById('resultsCountText'),
  activeFiltersBar: document.getElementById('activeFiltersBar'),
  activeFilterChips: document.getElementById('activeFilterChips'),
  resetAllFiltersBtn: document.getElementById('resetAllFiltersBtn'),
  selectAllToolbarBtn: document.getElementById('selectAllToolbarBtn'),

  // Bulk Actions
  bulkActionBar: document.getElementById('bulkActionBar'),
  bulkCountText: document.getElementById('bulkCountText'),
  bulkClearBtn: document.getElementById('bulkClearBtn'),
  bulkSelectAllBtn: document.getElementById('bulkSelectAllBtn'),
  bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),

  // Table & States
  tableBody: document.getElementById('influencersTableBody'),
  loadingState: document.getElementById('loadingState'),
  emptyState: document.getElementById('emptyState'),
  emptyStateTitle: document.getElementById('emptyStateTitle'),
  emptyStateDesc: document.getElementById('emptyStateDesc'),
  emptyStateAddBtn: document.getElementById('emptyStateAddBtn'),

  // Edit Modal
  editModal: document.getElementById('editModal'),
  editForm: document.getElementById('editInfluencerForm'),
  editUsername: document.getElementById('editUsername'),
  editName: document.getElementById('editName'),
  editFollowers: document.getElementById('editFollowers'),
  editBio: document.getElementById('editBio'),
  editNotes: document.getElementById('editNotes'),
  editModalAvatar: document.getElementById('editModalAvatar'),
  editModalTitle: document.getElementById('editModalTitle'),
  editModalSubtitle: document.getElementById('editModalSubtitle'),
  editTagsContainer: document.getElementById('editTagsContainer'),
  tagInput: document.getElementById('tagInput'),
  closeEditModalBtn: document.getElementById('closeEditModalBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),

  // Delete Modal
  deleteModal: document.getElementById('deleteModal'),
  deleteTargetUsername: document.getElementById('deleteTargetUsername'),
  closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

  // Add Modal
  addModal: document.getElementById('addModal'),
  addForm: document.getElementById('addInfluencerForm'),
  closeAddModalBtn: document.getElementById('closeAddModalBtn'),
  cancelAddBtn: document.getElementById('cancelAddBtn'),

  // Toasts
  toastContainer: document.getElementById('toastContainer')
};

// =============================================================================
// Helper Functions & Formatters
// =============================================================================

/**
 * Formats a number with compact notation (e.g. 12400 -> "12.4K", 1500000 -> "1.5M")
 * Shows "-" if value is null, undefined, or empty.
 */
function formatNumber(num) {
  if (num === null || num === undefined || num === '') {
    return '-';
  }
  const n = Number(num);
  if (Number.isNaN(n)) return '-';
  if (n >= 1_000_000_000) {
    return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1_000) {
    return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return n.toLocaleString();
}

/**
 * Formats an ISO date string into a friendly localized date (e.g. "Oct 6, 2026")
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
}

/**
 * Escapes HTML to prevent XSS in table rendering
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Toast Notification Dispatcher
 * @param {'success'|'error'|'info'} type
 * @param {string} title
 * @param {string} message
 * @param {number} duration
 */
function showToast(type, title, message, duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg =
    type === 'success'
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
      : type === 'error'
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  const dismiss = () => {
    toast.classList.add('toast-exit');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  };

  closeBtn.addEventListener('click', dismiss);
  setTimeout(dismiss, duration);

  elements.toastContainer.appendChild(toast);
}

// =============================================================================
// API Service Calls
// =============================================================================

/**
 * Fetch all influencers with current query parameters
 */
async function fetchInfluencers() {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    if (state.filters.search) params.append('search', state.filters.search);
    if (state.filters.tag) params.append('tag', state.filters.tag);
    if (state.filters.sort) params.append('sort', state.filters.sort);
    if (state.filters.order) params.append('order', state.filters.order);

    const url = `${API_BASE_URL}/influencers?${params.toString()}`;
    const response = await fetch(url);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to fetch influencers');
    }

    state.influencers = result.data || [];
    state.selectedUsernames.clear();
    renderDashboard();
    updateTagFilterDropdown();
    updateMetrics();
  } catch (error) {
    console.error('Error fetching influencers:', error);
    showToast('error', 'Fetch Error', error.message || 'Could not connect to API server.');
    renderDashboard();
  } finally {
    setLoading(false);
  }
}

/**
 * Create a new influencer
 */
async function apiCreateInfluencer(payload) {
  const response = await fetch(`${API_BASE_URL}/influencers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    const detail = data.errors ? data.errors.map((e) => e.message).join('; ') : data.message;
    throw new Error(detail || 'Failed to create influencer');
  }
  return data;
}

/**
 * Update an existing influencer
 */
async function apiUpdateInfluencer(username, payload) {
  const response = await fetch(`${API_BASE_URL}/influencers/${encodeURIComponent(username)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    const detail = data.errors ? data.errors.map((e) => e.message).join('; ') : data.message;
    throw new Error(detail || 'Failed to update influencer');
  }
  return data;
}

/**
 * Delete an influencer
 */
async function apiDeleteInfluencer(username) {
  const response = await fetch(`${API_BASE_URL}/influencers/${encodeURIComponent(username)}`, {
    method: 'DELETE'
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to delete influencer');
  }
  return data;
}

/**
 * Check backend health
 */
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (res.ok) {
      elements.serverStatusPill.innerHTML = '<span class="pulse-dot"></span> Live API';
      elements.serverStatusPill.style.color = 'var(--success)';
    } else {
      elements.serverStatusPill.textContent = 'API Error';
      elements.serverStatusPill.style.color = 'var(--warning)';
    }
  } catch {
    elements.serverStatusPill.textContent = 'Offline';
    elements.serverStatusPill.style.color = 'var(--danger)';
  }
}

// =============================================================================
// UI Rendering & Dashboard Views
// =============================================================================

function setLoading(isLoading) {
  state.isLoading = isLoading;
  if (isLoading) {
    elements.loadingState.style.display = 'flex';
    elements.tableBody.innerHTML = '';
    elements.emptyState.style.display = 'none';
  } else {
    elements.loadingState.style.display = 'none';
  }
}

/**
 * Render table rows or empty state
 */
function renderDashboard() {
  const list = state.influencers;
  elements.resultsCountText.textContent = `Showing ${list.length} creator${list.length === 1 ? '' : 's'}`;

  // Update active filter chips
  renderActiveFilterChips();

  if (list.length === 0) {
    elements.tableBody.innerHTML = '';
    elements.emptyState.style.display = 'flex';

    if (state.filters.search || state.filters.tag) {
      elements.emptyStateTitle.textContent = 'No matching creators found';
      elements.emptyStateDesc.textContent = 'Try adjusting or resetting your search and tag filters.';
      elements.emptyStateAddBtn.style.display = 'none';
    } else {
      elements.emptyStateTitle.textContent = 'No Influencers in CRM';
      elements.emptyStateDesc.textContent =
        'Capture Instagram profiles via your Chrome Extension or register one using the button above.';
      elements.emptyStateAddBtn.style.display = 'inline-flex';
    }
    return;
  }

  elements.emptyState.style.display = 'none';

  const rowsHtml = list
    .map((influencer) => {
      const username = escapeHtml(influencer.username);
      const name = escapeHtml(influencer.name || username);
      const profileUrl = influencer.profileUrl || `https://www.instagram.com/${influencer.username}/`;
      const followersFormatted = formatNumber(influencer.followers);
      const bioText = influencer.bio && influencer.bio.trim() ? escapeHtml(influencer.bio) : '<span class="notes-empty">Nil</span>';
      const notesText = influencer.notes ? escapeHtml(influencer.notes) : '<span class="notes-empty">-</span>';
      const dateFormatted = formatDate(influencer.createdAt);
      const initial = (name.charAt(0) || username.charAt(0) || 'U').toUpperCase();

      // Avatar HTML with graceful fallback
      const avatarHtml = influencer.profilePicUrl
        ? `<img class="avatar-img" src="${escapeHtml(influencer.profilePicUrl)}" alt="${username}" onerror="this.onerror=null; this.outerHTML='<div class=\\'avatar-fallback\\'>${initial}</div>';" />`
        : `<div class="avatar-fallback">${initial}</div>`;

      // Verified Badge SVG
      const verifiedSvg = influencer.isVerified
        ? `<svg class="verified-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" title="Verified Creator"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`
        : '';

      // Tags Chips HTML
      let tagsHtml = '<span class="notes-empty">-</span>';
      if (Array.isArray(influencer.tags) && influencer.tags.length > 0) {
        tagsHtml = influencer.tags
          .map(
            (tag) =>
              `<span class="tag-chip" data-tag="${escapeHtml(tag)}" title="Filter by #${escapeHtml(tag)}">#${escapeHtml(tag)}</span>`
          )
          .join('');
      }

      const isSelected = state.selectedUsernames.has(username);
      const selectedClass = isSelected ? 'selected' : '';
      const checkedAttr = isSelected ? 'checked' : '';

      return `
        <tr class="influencer-row ${selectedClass}" data-username="${username}">
          <td>
            <div class="card-select-wrap">
              <label class="checkbox-container">
                <input type="checkbox" class="creator-checkbox" value="${username}" ${checkedAttr} />
                <span class="checkbox-checkmark"></span>
              </label>
            </div>
          </td>
          <td>
            <div class="creator-cell">
              <div class="avatar-wrapper">${avatarHtml}</div>
              <div class="creator-info">
                <div class="creator-name-row">
                  <span class="creator-name">${name}</span>
                  ${verifiedSvg}
                </div>
              </div>
            </div>
          </td>
          <td>
            <a href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer" class="handle-link" title="Open Instagram Profile">
              <span>@${username}</span>
              <svg class="external-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </td>
          <td>
            <span class="followers-badge">${followersFormatted}</span>
          </td>
          <td class="col-bio">
            <div class="bio-text">${bioText}</div>
          </td>
          <td>
            <div class="tag-chips-wrap">${tagsHtml}</div>
          </td>
          <td>
            <div class="notes-text" title="Notes">${notesText}</div>
          </td>
          <td>
            <span class="date-cell">${dateFormatted}</span>
          </td>
          <td>
            <div class="action-buttons">
              <button class="btn-action btn-action-edit" data-action="edit" data-username="${username}" title="Edit Tags & Notes">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn-action btn-action-delete" data-action="delete" data-username="${username}" title="Delete Creator">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  elements.tableBody.innerHTML = rowsHtml;
  updateBulkActionUI();
}

function updateBulkActionUI() {
  const selectedCount = state.selectedUsernames.size;
  const totalCount = state.influencers.length;

  if (selectedCount > 0) {
    elements.bulkActionBar.style.display = 'flex';
    elements.bulkCountText.textContent = `${selectedCount} selected`;
  } else {
    elements.bulkActionBar.style.display = 'none';
  }

  const allSelected = totalCount > 0 && selectedCount === totalCount;
  if (elements.selectAllToolbarBtn) {
    elements.selectAllToolbarBtn.checked = allSelected;
  }
}

/**
 * Calculate KPI summary card values
 */
function updateMetrics() {
  const list = state.influencers;
  const totalCount = list.length;
  elements.totalInfluencersCount.textContent = totalCount.toLocaleString();

  // Combined Followers
  let totalFollowers = 0;
  let verifiedCount = 0;
  const tagCounts = {};

  list.forEach((item) => {
    if (typeof item.followers === 'number') {
      totalFollowers += item.followers;
    }
    if (item.isVerified) {
      verifiedCount++;
    }
    if (Array.isArray(item.tags)) {
      item.tags.forEach((t) => {
        const clean = t.trim().toLowerCase();
        if (clean) {
          tagCounts[clean] = (tagCounts[clean] || 0) + 1;
        }
      });
    }
  });

  elements.totalFollowersCount.textContent = formatNumber(totalFollowers);

  // Most-Used Tag
  let topTag = '-';
  let topTagCount = 0;
  Object.entries(tagCounts).forEach(([tag, count]) => {
    if (count > topTagCount) {
      topTag = `#${tag}`;
      topTagCount = count;
    }
  });

  elements.mostUsedTag.textContent = topTag;
  elements.mostUsedTag.title = topTag;
  elements.mostUsedTagCount.textContent = `${topTagCount} use${topTagCount === 1 ? '' : 's'}`;

  // Verified Stats
  elements.verifiedCount.textContent = verifiedCount.toLocaleString();
  const verifiedPct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;
  elements.verifiedPercent.textContent = `${verifiedPct}%`;
}

/**
 * Populate Tag dropdown dynamically based on active tags
 */
function updateTagFilterDropdown() {
  const tagSet = new Set();
  state.influencers.forEach((inf) => {
    if (Array.isArray(inf.tags)) {
      inf.tags.forEach((t) => tagSet.add(t.trim().toLowerCase()));
    }
  });

  const currentSelection = state.filters.tag;
  const sortedTags = Array.from(tagSet).sort();

  let optionsHtml = '<option value="">All Tags</option>';
  sortedTags.forEach((tag) => {
    const isSelected = tag === currentSelection ? 'selected' : '';
    optionsHtml += `<option value="${escapeHtml(tag)}" ${isSelected}>#${escapeHtml(tag)}</option>`;
  });

  elements.tagFilter.innerHTML = optionsHtml;
}

/**
 * Render active filter chip indicators
 */
function renderActiveFilterChips() {
  const chips = [];

  if (state.filters.search) {
    chips.push(`
      <span class="filter-pill">
        Search: "${escapeHtml(state.filters.search)}"
        <span class="filter-pill-remove" data-clear="search">&times;</span>
      </span>
    `);
  }

  if (state.filters.tag) {
    chips.push(`
      <span class="filter-pill">
        Tag: #${escapeHtml(state.filters.tag)}
        <span class="filter-pill-remove" data-clear="tag">&times;</span>
      </span>
    `);
  }

  if (chips.length > 0) {
    elements.activeFilterChips.innerHTML = chips.join('');
    elements.activeFiltersBar.style.display = 'flex';
  } else {
    elements.activeFiltersBar.style.display = 'none';
  }
}

// =============================================================================
// Modal Dialogs Logic
// =============================================================================

/**
 * Open Edit Modal for a specific username
 */
function openEditModal(username) {
  const influencer = state.influencers.find((i) => i.username === username);
  if (!influencer) return;

  state.selectedInfluencer = influencer;
  state.editTags = Array.isArray(influencer.tags) ? [...influencer.tags] : [];

  elements.editUsername.value = influencer.username;
  elements.editName.value = influencer.name || '';
  elements.editFollowers.value = influencer.followers !== null ? influencer.followers : '';
  elements.editBio.value = influencer.bio || '';
  elements.editNotes.value = influencer.notes || '';

  elements.editModalTitle.textContent = `Edit ${influencer.name || influencer.username}`;
  elements.editModalSubtitle.textContent = `@${influencer.username}`;

  const initial = (influencer.name || influencer.username || 'U').charAt(0).toUpperCase();
  elements.editModalAvatar.innerHTML = influencer.profilePicUrl
    ? `<img src="${escapeHtml(influencer.profilePicUrl)}" alt="${escapeHtml(influencer.username)}" onerror="this.outerHTML='<span>${initial}</span>'" />`
    : `<span>${initial}</span>`;

  renderEditTagChips();
  elements.editModal.style.display = 'flex';
  elements.tagInput.focus();
}

function closeEditModal() {
  elements.editModal.style.display = 'none';
  state.selectedInfluencer = null;
  state.editTags = [];
}

/**
 * Render tag chips in the edit modal input container
 */
function renderEditTagChips() {
  const chipsHtml = state.editTags
    .map(
      (tag, index) => `
      <span class="chip-editable">
        #${escapeHtml(tag)}
        <span class="chip-remove" data-index="${index}">&times;</span>
      </span>
    `
    )
    .join('');

  // Keep the inline input at the end of the container
  const inputEl = elements.tagInput;
  elements.editTagsContainer.innerHTML = chipsHtml;
  elements.editTagsContainer.appendChild(inputEl);
}

/**
 * Add a new tag to the edit modal list
 */
function addEditTag(rawTag) {
  const clean = rawTag.trim().toLowerCase().replace(/^#/, '');
  if (clean && !state.editTags.includes(clean)) {
    state.editTags.push(clean);
    renderEditTagChips();
  }
  elements.tagInput.value = '';
}

/**
 * Open Delete Modal
 */
function openDeleteModal(username) {
  state.deleteTargetUsername = username;
  elements.deleteTargetUsername.textContent = `@${username}`;
  elements.deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
  elements.deleteModal.style.display = 'none';
  state.deleteTargetUsername = null;
}

/**
 * Open Add Modal
 */
function openAddModal() {
  elements.addForm.reset();
  elements.addModal.style.display = 'flex';
  document.getElementById('addUsername').focus();
}

function closeAddModal() {
  elements.addModal.style.display = 'none';
}

// =============================================================================
// Event Handlers & Interactions
// =============================================================================

function setupEventListeners() {
  // Search with debounce
  elements.searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    elements.clearSearchBtn.style.display = val ? 'block' : 'none';

    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(() => {
      state.filters.search = val.trim();
      fetchInfluencers();
    }, 300);
  });

  elements.clearSearchBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.clearSearchBtn.style.display = 'none';
    state.filters.search = '';
    fetchInfluencers();
  });

  // Tag filter dropdown
  elements.tagFilter.addEventListener('change', (e) => {
    state.filters.tag = e.target.value;
    fetchInfluencers();
  });

  // Sort dropdown
  elements.sortSelect.addEventListener('change', (e) => {
    const [sort, order] = e.target.value.split('-');
    state.filters.sort = sort;
    state.filters.order = order;
    fetchInfluencers();
  });

  // Refresh button
  elements.refreshBtn.addEventListener('click', () => {
    elements.refreshBtn.classList.add('rotating');
    fetchInfluencers().finally(() => {
      setTimeout(() => elements.refreshBtn.classList.remove('rotating'), 500);
      showToast('info', 'Refreshed', 'Influencer dataset reloaded.');
    });
  });

  // Active filter chip remove & reset
  elements.activeFiltersBar.addEventListener('click', (e) => {
    const clearType = e.target.getAttribute('data-clear');
    if (clearType === 'search') {
      elements.searchInput.value = '';
      elements.clearSearchBtn.style.display = 'none';
      state.filters.search = '';
      fetchInfluencers();
    } else if (clearType === 'tag') {
      elements.tagFilter.value = '';
      state.filters.tag = '';
      fetchInfluencers();
    }
  });

  elements.resetAllFiltersBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.clearSearchBtn.style.display = 'none';
    elements.tagFilter.value = '';
    state.filters.search = '';
    state.filters.tag = '';
    fetchInfluencers();
  });

  // Table dynamic clicks (Edit, Delete, Tag Chip filter, Checkbox)
  elements.tableBody.addEventListener('click', (e) => {
    // Checkbox toggle
    if (e.target.matches('.creator-checkbox')) {
      const checkbox = e.target;
      const username = checkbox.value;
      if (checkbox.checked) {
        state.selectedUsernames.add(username);
      } else {
        state.selectedUsernames.delete(username);
      }
      const card = checkbox.closest('.influencer-card');
      if (card) {
        card.classList.toggle('selected', checkbox.checked);
      }
      updateBulkActionUI();
      // Don't return, let bubbling happen if needed, but it's a checkbox so fine.
    }

    // Check if clicked an action button
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const action = actionBtn.getAttribute('data-action');
      const username = actionBtn.getAttribute('data-username');
      if (action === 'edit') {
        openEditModal(username);
      } else if (action === 'delete') {
        openDeleteModal(username);
      }
      return;
    }

    // Check if clicked a tag chip to quick-filter
    const tagChip = e.target.closest('.tag-chip');
    if (tagChip) {
      const tag = tagChip.getAttribute('data-tag');
      if (tag) {
        state.filters.tag = tag;
        elements.tagFilter.value = tag;
        fetchInfluencers();
      }
    }
  });

  // Edit Modal Tag Input Keydown
  elements.tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEditTag(elements.tagInput.value);
    } else if (e.key === 'Backspace' && elements.tagInput.value === '' && state.editTags.length > 0) {
      state.editTags.pop();
      renderEditTagChips();
    }
  });

  // Edit Modal Tag Chip Removal
  elements.editTagsContainer.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.chip-remove');
    if (removeBtn) {
      const index = Number(removeBtn.getAttribute('data-index'));
      state.editTags.splice(index, 1);
      renderEditTagChips();
    }
  });

  // Submit Edit Form
  elements.editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (elements.tagInput.value.trim()) {
      addEditTag(elements.tagInput.value);
    }

    const username = elements.editUsername.value;
    const saveBtn = document.getElementById('saveEditBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const payload = {
        name: elements.editName.value.trim(),
        followers: elements.editFollowers.value ? Number(elements.editFollowers.value) : null,
        bio: elements.editBio.value.trim(),
        notes: elements.editNotes.value.trim(),
        tags: state.editTags
      };

      await apiUpdateInfluencer(username, payload);
      showToast('success', 'Updated Successfully', `@${username} record updated in CRM.`);
      closeEditModal();
      fetchInfluencers();
    } catch (err) {
      showToast('error', 'Update Failed', err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });

  // Modal Closers
  elements.closeEditModalBtn.addEventListener('click', closeEditModal);
  elements.cancelEditBtn.addEventListener('click', closeEditModal);

  // Confirm Delete
  elements.confirmDeleteBtn.addEventListener('click', async () => {
    if (!state.deleteTargetUsername) return;
    const username = state.deleteTargetUsername;
    elements.confirmDeleteBtn.disabled = true;
    elements.confirmDeleteBtn.textContent = 'Deleting...';

    try {
      await apiDeleteInfluencer(username);
      showToast('success', 'Deleted', `@${username} removed from CRM.`);
      closeDeleteModal();
      fetchInfluencers();
    } catch (err) {
      showToast('error', 'Delete Failed', err.message);
    } finally {
      elements.confirmDeleteBtn.disabled = false;
      elements.confirmDeleteBtn.textContent = 'Delete Influencer';
    }
  });

  elements.closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
  elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);

  // Bulk Actions
  const handleSelectAll = (e) => {
    const isChecked = e.target.checked !== undefined ? e.target.checked : true;
    if (isChecked) {
      state.influencers.forEach(inf => state.selectedUsernames.add(inf.username));
    } else {
      state.selectedUsernames.clear();
    }
    renderDashboard();
  };

  if (elements.selectAllToolbarBtn) {
    elements.selectAllToolbarBtn.addEventListener('change', handleSelectAll);
  }
  if (elements.bulkSelectAllBtn) {
    elements.bulkSelectAllBtn.addEventListener('click', () => {
      if (elements.selectAllToolbarBtn) elements.selectAllToolbarBtn.checked = true;
      handleSelectAll({ target: { checked: true } });
    });
  }
  if (elements.bulkClearBtn) {
    elements.bulkClearBtn.addEventListener('click', () => {
      if (elements.selectAllToolbarBtn) elements.selectAllToolbarBtn.checked = false;
      handleSelectAll({ target: { checked: false } });
    });
  }
  if (elements.bulkDeleteBtn) {
    elements.bulkDeleteBtn.addEventListener('click', async () => {
      if (state.selectedUsernames.size === 0) return;
      
      const confirmMsg = `Delete ${state.selectedUsernames.size} influencers? This can't be undone.`;
      if (!confirm(confirmMsg)) return;

      elements.bulkDeleteBtn.disabled = true;
      elements.bulkDeleteBtn.textContent = 'Deleting...';

      const usernames = Array.from(state.selectedUsernames);
      let successCount = 0;
      let failCount = 0;

      await Promise.allSettled(
        usernames.map(async (username) => {
          try {
            await apiDeleteInfluencer(username);
            successCount++;
          } catch (err) {
            failCount++;
          }
        })
      );

      elements.bulkDeleteBtn.disabled = false;
      elements.bulkDeleteBtn.textContent = 'Delete Selected';

      if (failCount === 0) {
        showToast('success', 'Bulk Delete', `Successfully deleted ${successCount} influencers.`);
      } else {
        showToast('warning', 'Bulk Delete', `Deleted ${successCount}, but failed to delete ${failCount}.`);
      }

      state.selectedUsernames.clear();
      fetchInfluencers();
    });
  }
  elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);

  // Add Modal Triggers
  elements.openAddModalBtn.addEventListener('click', openAddModal);
  elements.emptyStateAddBtn.addEventListener('click', openAddModal);
  elements.closeAddModalBtn.addEventListener('click', closeAddModal);
  elements.cancelAddBtn.addEventListener('click', closeAddModal);

  // Submit Add Form
  elements.addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('saveAddBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Adding...';

    try {
      const rawUsername = document.getElementById('addUsername').value.trim();
      const payload = {
        username: rawUsername.replace(/^@/, ''),
        name: document.getElementById('addName').value.trim(),
        profileUrl: document.getElementById('addProfileUrl').value.trim(),
        followers: document.getElementById('addFollowers').value ? Number(document.getElementById('addFollowers').value) : null,
        following: document.getElementById('addFollowing').value ? Number(document.getElementById('addFollowing').value) : null,
        postsCount: document.getElementById('addPosts').value ? Number(document.getElementById('addPosts').value) : null,
        profilePicUrl: document.getElementById('addProfilePic').value.trim(),
        isVerified: document.getElementById('addIsVerified').checked,
        bio: document.getElementById('addBio').value.trim(),
        tags: document.getElementById('addTags').value.trim(),
        notes: document.getElementById('addNotes').value.trim()
      };

      await apiCreateInfluencer(payload);
      showToast('success', 'Influencer Added', `@${payload.username} registered successfully.`);
      closeAddModal();
      fetchInfluencers();
    } catch (err) {
      showToast('error', 'Registration Failed', err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add to CRM';
    }
  });

  // Close modals when clicking backdrop
  window.addEventListener('click', (e) => {
    if (e.target === elements.editModal) closeEditModal();
    if (e.target === elements.deleteModal) closeDeleteModal();
    if (e.target === elements.addModal) closeAddModal();
  });

  // ESC key modal closer
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeDeleteModal();
      closeAddModal();
    }
  });
}

// =============================================================================
// Initialization
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkHealth();
  fetchInfluencers();
});
