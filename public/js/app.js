/* ==========================================================================
   Node.js Data Management Single Page Application Engine (Vanilla JS)
   ========================================================================== */

let currentUserState = null;
let currentRecordsData = [];
let recordModalInstance = null;
let viewRecordModalInstance = null;
let confirmModalInstance = null;
let userModalInstance = null;
let resetPasswordModalInstance = null;
let importDetailsModalInstance = null;

let lastImportResult = {
  type: '',
  duplicateItems: [],
  failedItems: []
};

let searchState = {
  query: '',
  startDate: '',
  endDate: '',
  remark: '',
  page: 1,
  pageSize: 25,
  sortColumn: 'createdDate',
  sortDirection: 'desc'
};

let selectedImportFile = null;
let searchDebounceTimer = null;
let currentRemarkOptions = [];
let remarkOptionModalInstance = null;
let sendDeleteRequestModalInstance = null;
let sendEditRequestModalInstance = null;
let sendListAddRequestModalInstance = null;
let viewEditComparisonModalInstance = null;
let updateRecordRemarkModalInstance = null;
let rawPendingDeleteRequests = [];
let rawPendingEditRequests = [];
let rawPendingListAddRequests = [];
let rawAllAdminRequests = [];
let rawMyRequests = [];
let rawUsersList = [];

document.addEventListener('DOMContentLoaded', function () {
  recordModalInstance = new bootstrap.Modal(document.getElementById('recordModal'));
  viewRecordModalInstance = new bootstrap.Modal(document.getElementById('viewRecordModal'));
  confirmModalInstance = new bootstrap.Modal(document.getElementById('confirmModal'));
  userModalInstance = new bootstrap.Modal(document.getElementById('userModal'));
  resetPasswordModalInstance = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
  importDetailsModalInstance = new bootstrap.Modal(document.getElementById('importDetailsModal'));
  remarkOptionModalInstance = new bootstrap.Modal(document.getElementById('remarkOptionModal'));
  sendDeleteRequestModalInstance = new bootstrap.Modal(document.getElementById('sendDeleteRequestModal'));
  sendEditRequestModalInstance = new bootstrap.Modal(document.getElementById('sendEditRequestModal'));
  sendListAddRequestModalInstance = new bootstrap.Modal(document.getElementById('sendListAddRequestModal'));
  viewEditComparisonModalInstance = new bootstrap.Modal(document.getElementById('viewEditComparisonModal'));
  updateRecordRemarkModalInstance = new bootstrap.Modal(document.getElementById('updateRecordRemarkModal'));

  const recRemarkEl = document.getElementById('modal-record-remark');
  if (recRemarkEl) recRemarkEl.addEventListener('change', handleRecordRemarkChange);

  const editRemarkEl = document.getElementById('send-edit-remark');
  if (editRemarkEl) editRemarkEl.addEventListener('change', handleSendEditRemarkChange);

  checkSessionOnLoad();
  setupDropzone();
  loadRemarkOptions();
});

/* Helper to format Aadhar No as 'XXXX XXXX XXXX' or '#N/A' */
function formatAadharDisplay(val) {
  if (!val || val.trim() === '' || val.trim() === '#N/A') {
    return '<span class="badge bg-light text-secondary border">#N/A</span>';
  }

  const cleanDigits = val.replace(/\D/g, '');
  if (cleanDigits.length >= 12) {
    const formatted = cleanDigits.replace(/^(\d{4})(\d{4})(\d{4})(.*)$/, '$1 $2 $3$4').trim();
    return `<span class="fw-semibold text-dark"><i class="bi bi-card-heading text-primary me-1"></i>${escapeHtml(formatted)}</span>`;
  }

  return escapeHtml(val);
}

/* Loader Controls */
function showLoader(message = 'Processing request...') {
  document.getElementById('loader-message').innerText = message;
  document.getElementById('loader-overlay').classList.remove('d-none');
}

function hideLoader() {
  document.getElementById('loader-overlay').classList.add('d-none');
}

/* Toast Notifications */
function showToast(type, title, message) {
  const toastContainer = document.getElementById('toast-container');
  const toastId = 'toast-' + Date.now();
  const bgClass = type === 'success' ? 'bg-success text-white' : type === 'danger' ? 'bg-danger text-white' : 'bg-info text-white';

  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <strong>${escapeHtml(title)}</strong>: ${escapeHtml(message)}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML('beforeend', toastHtml);
  const toastEl = document.getElementById(toastId);
  const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
  bsToast.show();

  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('bi-eye', 'bi-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('bi-eye-slash', 'bi-eye');
  }
}

/* Authentication & Session */

/* Auto Logout Inactivity Tracker (10 Minutes = 600,000 ms) */
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
let lastActivityTimestamp = Date.now();
let inactivityTimerId = null;
let activityListenersAttached = false;
let lastActivityResetCall = 0;

function resetInactivityTimer() {
  lastActivityTimestamp = Date.now();
  try {
    localStorage.setItem('informaction_last_activity', lastActivityTimestamp.toString());
  } catch (e) {}
}

function handleUserActivity() {
  const now = Date.now();
  if (now - lastActivityResetCall > 2000) {
    lastActivityResetCall = now;
    resetInactivityTimer();
  }
}

function attachActivityListeners() {
  if (activityListenersAttached) return;
  const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  events.forEach(evt => {
    window.addEventListener(evt, handleUserActivity, { passive: true });
  });
  activityListenersAttached = true;
}

function detachActivityListeners() {
  if (!activityListenersAttached) return;
  const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  events.forEach(evt => {
    window.removeEventListener(evt, handleUserActivity);
  });
  activityListenersAttached = false;
}

function startInactivityMonitor() {
  stopInactivityMonitor();
  resetInactivityTimer();
  attachActivityListeners();
  inactivityTimerId = setInterval(checkInactivity, 5000);
}

function stopInactivityMonitor() {
  if (inactivityTimerId) {
    clearInterval(inactivityTimerId);
    inactivityTimerId = null;
  }
  detachActivityListeners();
}

function checkInactivity() {
  if (!currentUserState) {
    stopInactivityMonitor();
    return;
  }

  let storedLastActivity = lastActivityTimestamp;
  try {
    const val = localStorage.getItem('informaction_last_activity');
    if (val) {
      storedLastActivity = Math.max(lastActivityTimestamp, parseInt(val, 10) || 0);
    }
  } catch (e) {}

  const idleTime = Date.now() - storedLastActivity;
  if (idleTime >= INACTIVITY_TIMEOUT_MS) {
    stopInactivityMonitor();
    performAutoLogoutDueToInactivity();
  }
}

async function performAutoLogoutDueToInactivity() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  currentUserState = null;
  document.getElementById('login-form').reset();
  showLoginScreen();
  showToast('warning', 'Session Expired', 'Aap 10 minute se inactive the, isliye auto-logout ho gaya hai (Logged out due to 10 min inactivity).');
}

function showLoginScreen() {
  stopInactivityMonitor();
  document.getElementById('app-shell').classList.add('d-none');
  document.getElementById('login-view').classList.remove('d-none');
}

async function checkSessionOnLoad() {
  showLoader('Verifying session...');
  try {
    const res = await fetch('/api/auth/session');
    const data = await res.json();
    hideLoader();

    if (data.success) {
      currentUserState = data.data;
      initializeAuthenticatedApp();
    } else {
      showLoginScreen();
    }
  } catch (err) {
    hideLoader();
    showLoginScreen();
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  const alertEl = document.getElementById('login-alert');
  const spinnerEl = document.getElementById('login-spinner');
  const btnSubmit = document.getElementById('btn-login-submit');

  alertEl.classList.add('d-none');
  spinnerEl.classList.remove('d-none');
  btnSubmit.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    spinnerEl.classList.add('d-none');
    btnSubmit.disabled = false;

    if (data.success) {
      currentUserState = data.data;
      initializeAuthenticatedApp();
    } else {
      document.getElementById('login-alert-text').innerText = data.message;
      alertEl.classList.remove('d-none');
    }
  } catch (err) {
    spinnerEl.classList.add('d-none');
    btnSubmit.disabled = false;
    document.getElementById('login-alert-text').innerText = 'Server connection error: ' + err.message;
    alertEl.classList.remove('d-none');
  }
}

function initializeAuthenticatedApp() {
  document.getElementById('login-view').classList.add('d-none');
  document.getElementById('app-shell').classList.remove('d-none');

  document.getElementById('header-user-display').innerText = currentUserState.username;
  document.getElementById('header-role-display').innerText = currentUserState.role + (currentUserState.fullAccess ? ' (Full)' : '');
  document.getElementById('header-avatar').innerText = currentUserState.username.charAt(0).toUpperCase();

  updateUIForRolePermissions();
  loadRemarkOptions();
  navigateToView('dashboard');
  startInactivityMonitor();
}

async function handleLogout() {
  stopInactivityMonitor();
  await fetch('/api/auth/logout', { method: 'POST' });
  currentUserState = null;
  document.getElementById('login-form').reset();
  showLoginScreen();
  showToast('info', 'Signed Out', 'You have been logged out successfully.');
}

function updateUIForRolePermissions() {
  const role = currentUserState.role;
  const canImport = role === 'Admin' || (role === 'Add' && (currentUserState.importPermission || currentUserState.fullAccess));
  const canAddRecords = role === 'Admin' || role === 'Add';
  const canAccessDeleteRequests = role === 'Admin' || currentUserState.deleteRequestPermission;

  if (canAddRecords) {
    document.getElementById('dash-btn-add-record').classList.remove('d-none');
    document.getElementById('btn-add-record-main').classList.remove('d-none');
  } else {
    document.getElementById('dash-btn-add-record').classList.add('d-none');
    document.getElementById('btn-add-record-main').classList.add('d-none');
  }

  if (canImport) {
    document.getElementById('nav-import').classList.remove('d-none');
  } else {
    document.getElementById('nav-import').classList.add('d-none');
  }

  if (canAccessDeleteRequests) {
    const allReqEl = document.getElementById('nav-item-all-requests');
    if (allReqEl) allReqEl.classList.remove('d-none');
    fetchAllPendingRequestsCounts();
  } else {
    const allReqEl = document.getElementById('nav-item-all-requests');
    if (allReqEl) allReqEl.classList.add('d-none');
  }

  if (role === 'View') {
    const el = document.getElementById('nav-item-my-requests');
    if (el) el.classList.add('d-none');
  } else {
    const el = document.getElementById('nav-item-my-requests');
    if (el) el.classList.remove('d-none');
  }

  const reactiveNavEl = document.getElementById('nav-item-reactive-list');
  const dashTotalUsersCard = document.getElementById('dash-card-total-users');

  if (role === 'Admin') {
    document.getElementById('nav-users').classList.remove('d-none');
    const dropNav = document.getElementById('nav-item-dropdowns');
    if (dropNav) dropNav.classList.remove('d-none');
    if (reactiveNavEl) reactiveNavEl.classList.add('d-none');
    if (dashTotalUsersCard) dashTotalUsersCard.classList.remove('d-none');
  } else {
    document.getElementById('nav-users').classList.add('d-none');
    const dropNav = document.getElementById('nav-item-dropdowns');
    if (dropNav) dropNav.classList.add('d-none');
    if (reactiveNavEl) reactiveNavEl.classList.remove('d-none');
    if (dashTotalUsersCard) dashTotalUsersCard.classList.add('d-none');
  }
}

function navigateToView(viewName) {
  if (viewName === 'reactive-list' && currentUserState && currentUserState.role === 'Admin') {
    viewName = 'dashboard';
  }

  document.querySelectorAll('.view-section').forEach(el => el.classList.add('d-none'));
  document.querySelectorAll('#sidebar .nav-link').forEach(el => el.classList.remove('active'));

  const titleMap = {
    'dashboard': 'Dashboard Overview',
    'records': 'Data Records & Operations',
    'import': 'Batch Excel / CSV Import',
    'all-requests': 'Requests Management Hub',
    'delete-requests': 'Requests Management Hub',
    'edit-requests': 'Requests Management Hub',
    'my-requests': 'My Sent Requests',
    'reactive-list': 'Reactive Dropdown Requests',
    'users': 'Admin User Management',
    'dropdowns': 'Dropdown Options Settings'
  };

  document.getElementById('page-title-display').innerText = titleMap[viewName] || 'Data Portal';

  const targetViewName = (viewName === 'delete-requests' || viewName === 'edit-requests') ? 'all-requests' : viewName;

  const targetView = document.getElementById(targetViewName + '-view');
  const targetNav = document.getElementById('nav-' + viewName);

  if (targetView) targetView.classList.remove('d-none');
  if (targetNav) targetNav.classList.add('active');

  document.getElementById('sidebar').classList.remove('active');

  if (viewName === 'dashboard') {
    loadDashboardData();
  } else if (viewName === 'records') {
    loadRemarkOptions();
    triggerFetchRecords();
  } else if (viewName === 'all-requests' || viewName === 'delete-requests' || viewName === 'edit-requests') {
    loadAllRequestsList();
  } else if (viewName === 'my-requests') {
    loadMyRequestsList();
  } else if (viewName === 'reactive-list') {
    loadReactiveList();
  } else if (viewName === 'users' && currentUserState.role === 'Admin') {
    loadUsersList();
  } else if (viewName === 'dropdowns' && currentUserState.role === 'Admin') {
    loadDropdownsView();
  }
}

function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('active');
}

/* Dashboard Module */

async function loadDashboardData(highlightPid = null) {
  showLoader('Refreshing dashboard...');
  try {
    const res = await fetch('/api/records/dashboard');
    const data = await res.json();
    hideLoader();

    if (data.success) {
      const stats = data.data;
      document.getElementById('dash-total-records').innerText = stats.totalRecords;
      document.getElementById('dash-today-records').innerText = stats.todayRecords;
      document.getElementById('dash-total-users').innerText = stats.totalUsers;
      document.getElementById('dash-today-imports').innerText = stats.todayImports;

      const tbody = document.getElementById('dash-recent-table-body');
      if (!stats.recentActivities || stats.recentActivities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No recent record activity.</td></tr>';
        return;
      }

      let html = '';
      stats.recentActivities.forEach(rec => {
        const recJson = encodeURIComponent(JSON.stringify(rec));
        const isHighlighted = (highlightPid && (String(rec.pid) === String(highlightPid) || String(rec.id) === String(highlightPid)));
        const highlightClass = isHighlighted ? 'highlight-new-row' : '';

        html += `
          <tr class="${highlightClass}">
            <td><a href="#" onclick="viewRecordByPid('${escapeHtml(rec.pid)}', '${recJson}'); return false;" class="pid-link" title="Click to view record details">${escapeHtml(rec.pid)}</a></td>
            <td>${escapeHtml(rec.name)}</td>
            <td>${escapeHtml(rec.father || '-')}</td>
            <td>${escapeHtml(rec.utNo || rec.ut_no || '-')}</td>
            <td>${rec.date || '-'}</td>
            <td><span class="badge bg-light text-dark border">${escapeHtml(rec.createdBy || rec.created_by)}</span></td>
            <td class="small text-muted">${rec.createdDate || rec.created_date} ${rec.createdTime || rec.created_time}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } else {
      showToast('danger', 'Dashboard Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

/* Records Table & CRUD */

function handleInstantSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchState.query = document.getElementById('search-query-input').value;
    searchState.page = 1;
    triggerFetchRecords();
  }, 300);
}

async function triggerFetchRecords(highlightPid = null) {
  if (!currentRemarkOptions || currentRemarkOptions.length === 0) {
    await loadRemarkOptions();
  }
  searchState.startDate = document.getElementById('filter-start-date').value;
  searchState.endDate = document.getElementById('filter-end-date').value;
  const filterRemarkEl = document.getElementById('filter-remark');
  searchState.remark = filterRemarkEl ? filterRemarkEl.value : '';

  const queryParams = new URLSearchParams({
    query: searchState.query,
    startDate: searchState.startDate,
    endDate: searchState.endDate,
    remark: searchState.remark,
    page: searchState.page,
    pageSize: searchState.pageSize,
    sortColumn: searchState.sortColumn,
    sortDirection: searchState.sortDirection
  });

  showLoader('Fetching records...');
  try {
    const res = await fetch(`/api/records?${queryParams.toString()}`);
    const data = await res.json();
    hideLoader();

    if (data.success) {
      renderRecordsTable(data.data.records, highlightPid);
      renderPagination(data.data.totalRecords, data.data.page, data.data.pageSize);
    } else {
      showToast('danger', 'Fetch Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

function renderRecordsTable(records, highlightPid = null) {
  currentRecordsData = records || [];
  const tbody = document.getElementById('records-table-body');

  if (!records || records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>No matching records found.</td></tr>';
    return;
  }

  let html = '';
  records.forEach(rec => {
    const recJson = encodeURIComponent(JSON.stringify(rec));
    const isHighlighted = (highlightPid && (String(rec.pid) === String(highlightPid) || String(rec.id) === String(highlightPid)));
    const highlightClass = isHighlighted ? 'highlight-new-row' : '';
    
    let menuItems = [];

    // Edit option
    if (rec.canEdit) {
      menuItems.push(`
        <li>
          <a class="dropdown-item text-primary d-flex align-items-center py-2" href="#" onclick="showEditRecordModal('${recJson}'); return false;">
            <i class="bi bi-pencil me-2 text-primary"></i><span>Edit Record</span>
          </a>
        </li>
      `);
    } else if (currentUserState && (currentUserState.role === 'Add' || currentUserState.role === 'Admin')) {
      if (rec.hasPendingEditRequest) {
        menuItems.push(`
          <li>
            <span class="dropdown-item disabled text-info d-flex align-items-center py-2">
              <i class="bi bi-clock-history me-2 text-info"></i><span>Requested Edit</span>
            </span>
          </li>
        `);
      } else {
        menuItems.push(`
          <li>
            <a class="dropdown-item text-info d-flex align-items-center py-2" href="#" onclick="openSendEditRequestModal('${recJson}'); return false;">
              <i class="bi bi-pencil-square me-2 text-info"></i><span>Request Edit</span>
            </a>
          </li>
        `);
      }
    }

    // Delete option
    if (rec.canDelete) {
      menuItems.push(`
        <li>
          <a class="dropdown-item text-danger d-flex align-items-center py-2" href="#" onclick="confirmDeleteRecord(${rec.id}, '${escapeHtml(rec.pid)}'); return false;">
            <i class="bi bi-trash me-2 text-danger"></i><span>Delete Record</span>
          </a>
        </li>
      `);
    } else if (currentUserState && (currentUserState.role === 'Add' || currentUserState.role === 'Admin')) {
      if (rec.hasPendingDeleteRequest) {
        menuItems.push(`
          <li>
            <span class="dropdown-item disabled text-warning d-flex align-items-center py-2">
              <i class="bi bi-clock-history me-2 text-warning"></i><span>Delete Requested</span>
            </span>
          </li>
        `);
      } else {
        menuItems.push(`
          <li>
            <a class="dropdown-item text-warning d-flex align-items-center py-2" href="#" onclick="openSendDeleteRequestModal(${rec.id}, '${escapeHtml(rec.pid)}'); return false;">
              <i class="bi bi-send me-2 text-warning"></i><span>Request Delete</span>
            </a>
          </li>
        `);
      }
    }

    let actionButtons = '';
    if (menuItems.length > 0) {
      actionButtons = `
        <div class="dropdown d-inline-block">
          <button class="btn btn-sm btn-light border border-secondary-subtle rounded-circle p-0 action-dots-btn shadow-xs" type="button" data-bs-toggle="dropdown" data-bs-boundary="viewport" aria-expanded="false" title="Actions" style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;">
            <i class="bi bi-three-dots-vertical fs-6 text-secondary"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow border-0 py-1" style="min-width: 170px; border-radius: 10px; font-size: 0.85rem; z-index: 1060;">
            ${menuItems.join('')}
          </ul>
        </div>
      `;
    } else {
      actionButtons = '<span class="text-muted small">-</span>';
    }

    html += `
      <tr class="${highlightClass}">
        <td><a href="#" onclick="viewRecordDetails('${recJson}'); return false;" class="pid-link" title="Click to view record details">${escapeHtml(rec.pid)}</a></td>
        <td class="fw-semibold">${escapeHtml(rec.name)}</td>
        <td>${escapeHtml(rec.father || '-')}</td>
        <td>${escapeHtml(rec.utNo || '-')}</td>
        <td>${formatAadharDisplay(rec.aadharNo)}</td>
        <td class="fw-semibold text-dark"><i class="bi bi-calendar-event me-1 text-primary opacity-75"></i>${escapeHtml(rec.date || '-')}</td>
        <td><span class="text-truncate d-inline-block" style="max-width: 130px;" title="${escapeHtml(rec.remark)}">${escapeHtml(rec.remark || '-')}</span></td>
        <td><span class="badge bg-light text-dark border">${escapeHtml(rec.createdBy)}</span></td>
        <td class="small text-muted">${rec.createdDate}</td>
        <td class="text-end no-print">${actionButtons}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function changeSortColumn(colName) {
  if (searchState.sortColumn === colName) {
    searchState.sortDirection = searchState.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    searchState.sortColumn = colName;
    searchState.sortDirection = 'asc';
  }
  triggerFetchRecords();
}

function changePageSize(size) {
  searchState.pageSize = size === 'All' ? 'All' : parseInt(size, 10);
  searchState.page = 1;
  triggerFetchRecords();
}

function renderPagination(total, page, pageSize) {
  document.getElementById('pagination-total-count').innerText = total;
  const foundCountEl = document.getElementById('records-found-count');
  if (foundCountEl) {
    foundCountEl.innerText = total;
  }
  const paginationList = document.getElementById('pagination-list');

  if (pageSize === 'All' || total <= pageSize) {
    paginationList.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(total / pageSize);
  let html = '';

  html += `<li class="page-item ${page === 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="goToPage(${page - 1}); return false;">Prev</a></li>`;

  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)) {
      html += `<li class="page-item ${p === page ? 'active' : ''}"><a class="page-link" href="#" onclick="goToPage(${p}); return false;">${p}</a></li>`;
    } else if (p === page - 3 || p === page + 3) {
      html += `<li class="page-item disabled"><a class="page-link" href="#">...</a></li>`;
    }
  }

  html += `<li class="page-item ${page === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="goToPage(${page + 1}); return false;">Next</a></li>`;

  paginationList.innerHTML = html;
}

function goToPage(p) {
  searchState.page = p;
  triggerFetchRecords();
}

function clearFilters() {
  document.getElementById('search-query-input').value = '';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  const filterRemarkEl = document.getElementById('filter-remark');
  if (filterRemarkEl) filterRemarkEl.value = '';
  searchState.query = '';
  searchState.startDate = '';
  searchState.endDate = '';
  searchState.remark = '';
  searchState.page = 1;
  triggerFetchRecords();
}

/* Dynamic Remark Dropdown Helpers */

async function loadRemarkOptions() {
  try {
    const res = await fetch('/api/records/remark-options');
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
      currentRemarkOptions = data.data;
      populateFilterRemarkDropdown();
    }
  } catch (err) {
    console.error('Error fetching remark options:', err);
  }
}

function populateFilterRemarkDropdown() {
  const selectEl = document.getElementById('filter-remark');
  if (!selectEl) return;
  const currentVal = selectEl.value;

  let html = '<option value="">All</option>';
  const cleanOptions = currentRemarkOptions.filter(opt => opt && opt.toString().trim().toLowerCase() !== 'remark options');

  cleanOptions.forEach(opt => {
    const isSelected = opt === currentVal ? 'selected' : '';
    html += `<option value="${escapeHtml(opt)}" ${isSelected}>${escapeHtml(opt)}</option>`;
  });

  selectEl.innerHTML = html;
  if (currentVal) {
    selectEl.value = currentVal;
  }
}

function populateRemarkDropdown(selectedValue = '') {
  const selectEl = document.getElementById('modal-record-remark');
  if (!selectEl) return;

  let html = '<option value="">-- Select Remark --</option>';
  const optionsList = [...currentRemarkOptions];
  
  if (selectedValue && !optionsList.includes(selectedValue)) {
    optionsList.unshift(selectedValue);
  }

  optionsList.forEach(opt => {
    const isSelected = opt === selectedValue ? 'selected' : '';
    html += `<option value="${escapeHtml(opt)}" ${isSelected}>${escapeHtml(opt)}</option>`;
  });

  selectEl.innerHTML = html;
  if (selectedValue) {
    selectEl.value = selectedValue;
  }
}

/* Foreigner Remark & Aadhar Disable Logic */

function handleRecordRemarkChange() {
  const remarkSelect = document.getElementById('modal-record-remark');
  const aadharInput = document.getElementById('modal-record-aadhar');
  if (!remarkSelect || !aadharInput) return;

  const selectedVal = (remarkSelect.value || '').trim().toLowerCase();
  if (selectedVal === 'foreigner') {
    aadharInput.value = '';
    aadharInput.disabled = true;
    aadharInput.placeholder = 'N/A (Foreigner selected)';
  } else {
    aadharInput.disabled = false;
    aadharInput.placeholder = 'Min 12 digits or leave blank for #N/A';
  }
}

function handleSendEditRemarkChange() {
  const remarkSelect = document.getElementById('send-edit-remark');
  const aadharInput = document.getElementById('send-edit-aadhar');
  if (!remarkSelect || !aadharInput) return;

  const selectedVal = (remarkSelect.value || '').trim().toLowerCase();
  if (selectedVal === 'foreigner') {
    aadharInput.value = '';
    aadharInput.disabled = true;
    aadharInput.placeholder = 'N/A (Foreigner selected)';
  } else {
    aadharInput.disabled = false;
    aadharInput.placeholder = '12 digit Aadhar number';
  }
}

/* Record Modals */

async function showAddRecordModal() {
  await loadRemarkOptions();
  document.getElementById('recordModalTitle').innerText = 'Add New Data Record';
  document.getElementById('recordForm').reset();
  document.getElementById('record-edit-mode').value = 'add';
  document.getElementById('record-id').value = '';
  document.getElementById('modal-record-pid').disabled = false;
  document.getElementById('modal-record-date').value = new Date().toISOString().split('T')[0];
  populateRemarkDropdown('');
  handleRecordRemarkChange();
  recordModalInstance.show();
}

async function showEditRecordModal(encodedRecJson) {
  await loadRemarkOptions();
  const rec = JSON.parse(decodeURIComponent(encodedRecJson));
  document.getElementById('recordModalTitle').innerText = 'Edit Record (' + rec.pid + ')';
  document.getElementById('record-edit-mode').value = 'edit';
  document.getElementById('record-id').value = rec.id;

  document.getElementById('modal-record-pid').value = rec.pid;
  document.getElementById('modal-record-name').value = rec.name;
  document.getElementById('modal-record-father').value = rec.father;
  document.getElementById('modal-record-ut').value = rec.utNo;
  document.getElementById('modal-record-aadhar').value = (rec.aadharNo === '#N/A' ? '' : rec.aadharNo);
  document.getElementById('modal-record-date').value = rec.date;

  populateRemarkDropdown(rec.remark || '');
  handleRecordRemarkChange();
  recordModalInstance.show();
}

async function handleRecordFormSubmit(event) {
  event.preventDefault();
  const mode = document.getElementById('record-edit-mode').value;
  const recordId = document.getElementById('record-id').value;

  const pid = document.getElementById('modal-record-pid').value.trim();
  const name = document.getElementById('modal-record-name').value.trim();
  const remark = document.getElementById('modal-record-remark').value.trim();
  let aadharInput = document.getElementById('modal-record-aadhar').value.trim();

  if (remark.toLowerCase() === 'foreigner') {
    aadharInput = '';
  }

  // Validate numeric PID
  if (!/^\d+$/.test(pid)) {
    showToast('danger', 'Validation Error', 'PID must contain numbers only.');
    return;
  }

  if (remark.toLowerCase() !== 'foreigner' && aadharInput !== '' && aadharInput !== '#N/A') {
    const cleanDigits = aadharInput.replace(/\D/g, '');
    if (cleanDigits.length < 12) {
      showToast('danger', 'Validation Error', 'Aadhar No must contain at least 12 digits.');
      return;
    }
  }

  const recordData = {
    pid: pid,
    name: name,
    father: document.getElementById('modal-record-father').value.trim(),
    utNo: document.getElementById('modal-record-ut').value.trim(),
    aadharNo: aadharInput,
    date: document.getElementById('modal-record-date').value,
    remark: document.getElementById('modal-record-remark').value.trim()
  };

  const endpoint = mode === 'add' ? '/api/records' : `/api/records/${recordId}`;
  const method = mode === 'add' ? 'POST' : 'PUT';

  showLoader(mode === 'add' ? 'Saving record...' : 'Updating record...');
  try {
    const res = await fetch(endpoint, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recordData)
    });
    const data = await res.json();
    hideLoader();

    if (data.success) {
      recordModalInstance.hide();
      showToast('success', 'Success', data.message);
      let highlightPid = null;
      if (mode === 'add') {
        // Reset search & date filters to ensure new record is visible immediately
        searchState.query = '';
        searchState.startDate = '';
        searchState.endDate = '';
        searchState.page = 1;
        searchState.sortColumn = 'createdDate';
        searchState.sortDirection = 'desc';

        const searchInput = document.getElementById('search-query-input');
        if (searchInput) searchInput.value = '';
        const startDateInput = document.getElementById('filter-start-date');
        if (startDateInput) startDateInput.value = '';
        const endDateInput = document.getElementById('filter-end-date');
        if (endDateInput) endDateInput.value = '';

        highlightPid = (data.record && data.record.pid) ? data.record.pid : pid;
      }

      // Refresh Dashboard stats & Recent Table without switching views
      loadDashboardData(highlightPid);
      // Refresh Records Table in background
      await triggerFetchRecords(highlightPid);
    } else {
      showToast('danger', 'Validation Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Server Error', err.message);
  }
}

function viewRecordDetails(recInput) {
  let rec = recInput;
  if (typeof recInput === 'string') {
    try {
      rec = JSON.parse(decodeURIComponent(recInput));
    } catch (e) {
      try {
        rec = JSON.parse(recInput);
      } catch (e2) {
        console.error('Invalid record JSON:', e2);
        return;
      }
    }
  }
  if (!rec) return;

  document.getElementById('view-pid').innerText = rec.pid || '-';
  document.getElementById('view-name').innerText = rec.name || '-';
  document.getElementById('view-father').innerText = rec.father || '-';
  document.getElementById('view-ut').innerText = rec.utNo || rec.ut_no || '-';
  document.getElementById('view-aadhar').innerHTML = formatAadharDisplay(rec.aadharNo || rec.aadhar_no || '');
  document.getElementById('view-date').innerText = rec.date || '-';
  document.getElementById('view-remark').innerText = rec.remark || '-';
  document.getElementById('view-created-by').innerText = rec.createdBy || rec.created_by || rec.requestedBy || '-';

  const createdDate = rec.createdDate || rec.created_date || rec.requestedDate || '';
  const createdTime = rec.createdTime || rec.created_time || rec.requestedTime || '';
  document.getElementById('view-created-at').innerText = (createdDate || createdTime) ? `${createdDate} ${createdTime}`.trim() : '-';

  const updatedDate = rec.updatedDate || rec.updated_date || '';
  const updatedTime = rec.updatedTime || rec.updated_time || '';
  document.getElementById('view-updated-at').innerText = (updatedDate || updatedTime) ? `${updatedDate} ${updatedTime}`.trim() : 'Never updated';

  viewRecordModalInstance.show();
}

async function viewRecordByPid(pid, fallbackInput = null) {
  if (!pid) return;

  let fallbackObj = fallbackInput;
  if (typeof fallbackInput === 'string') {
    try {
      fallbackObj = JSON.parse(decodeURIComponent(fallbackInput));
    } catch (e) {
      try { fallbackObj = JSON.parse(fallbackInput); } catch (e2) {}
    }
  }

  // 1. Check if PID exists in current loaded records array
  if (window.currentRecordsData && Array.isArray(window.currentRecordsData)) {
    const found = window.currentRecordsData.find(r => String(r.pid).toLowerCase() === String(pid).toLowerCase());
    if (found) {
      viewRecordDetails(found);
      return;
    }
  }

  // 2. Show fallback details immediately if available
  if (fallbackObj) {
    viewRecordDetails(fallbackObj);
  } else {
    showLoader('Fetching record details...');
  }

  // 3. Fetch latest full details from backend by PID
  try {
    const res = await fetch(`/api/records/by-pid/${encodeURIComponent(pid)}`);
    const data = await res.json();
    hideLoader();
    if (data.success && data.data) {
      viewRecordDetails(data.data);
    } else if (!fallbackObj) {
      showToast('warning', 'Notice', data.message || `Details for PID ${pid} could not be loaded.`);
    }
  } catch (err) {
    hideLoader();
    if (!fallbackObj) {
      showToast('danger', 'Error', err.message);
    }
  }
}

function confirmDeleteRecord(recordId, pid) {
  document.getElementById('confirmModalTitle').innerText = 'Delete Record?';
  document.getElementById('confirmModalMessage').innerText = `Are you sure you want to delete PID "${pid}"?`;

  document.getElementById('confirmModalExecuteBtn').onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Deleting record...');
    try {
      const res = await fetch(`/api/records/${recordId}`, { method: 'DELETE' });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('success', 'Deleted', data.message);
        triggerFetchRecords();
      } else {
        showToast('danger', 'Delete Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Server Error', err.message);
    }
  };

  confirmModalInstance.show();
}

/* Batch Excel / CSV Import Module */

function setupDropzone() {
  const dropzone = document.getElementById('import-dropzone');
  if (!dropzone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
  });

  dropzone.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleImportFile(files[0]);
    }
  });
}

function handleImportFileSelect(event) {
  const files = event.target.files;
  if (files.length > 0) {
    handleImportFile(files[0]);
  }
}

function handleImportFile(file) {
  selectedImportFile = file;
  document.getElementById('import-filename').innerText = file.name;
  document.getElementById('import-filesize').innerText = (file.size / 1024).toFixed(1) + ' KB';

  document.getElementById('selected-file-info').classList.remove('d-none');
  document.getElementById('btn-process-import').disabled = false;
}

function resetImportSelection() {
  selectedImportFile = null;
  document.getElementById('import-file-input').value = '';
  document.getElementById('selected-file-info').classList.add('d-none');
  document.getElementById('btn-process-import').disabled = true;
  document.getElementById('import-summary-card').classList.add('d-none');
}

function downloadSampleTemplate() {
  window.location.href = '/api/import/sample-template';
  showToast('success', 'Template Downloaded', 'Downloading sample Excel template with native Remark dropdown list.');
}

function processSelectedImportFile() {
  if (!selectedImportFile) return;

  showLoader('Reading Excel file...');
  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const rawRecords = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRecords || rawRecords.length === 0) {
        hideLoader();
        showToast('danger', 'Import Error', 'File is empty or contains no records.');
        return;
      }

      showLoader('Processing ' + rawRecords.length + ' records on server...');
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: rawRecords })
      });
      const resData = await res.json();
      hideLoader();

      if (resData.success) {
        renderImportSummary(resData.data);
        showToast('success', 'Import Completed', resData.message);
        clearImportFileSelectionOnly();
      } else {
        showToast('danger', 'Import Error', resData.message);
      }

    } catch (err) {
      hideLoader();
      showToast('danger', 'Parse Error', 'Failed to read file contents: ' + err.message);
    }
  };

  reader.readAsArrayBuffer(selectedImportFile);
}

function clearImportFileSelectionOnly() {
  selectedImportFile = null;
  const inputEl = document.getElementById('import-file-input');
  if (inputEl) inputEl.value = '';
  document.getElementById('selected-file-info').classList.add('d-none');
  document.getElementById('btn-process-import').disabled = true;
}

function renderImportSummary(summary) {
  document.getElementById('summary-total').innerText = summary.totalProcessed;
  document.getElementById('summary-imported').innerText = summary.importedCount;
  document.getElementById('summary-duplicates').innerText = summary.duplicateCount;
  document.getElementById('summary-failed').innerText = summary.failedCount;

  lastImportResult.duplicateItems = summary.duplicateItems || [];
  lastImportResult.failedItems = summary.failedItems || [];

  const dupSection = document.getElementById('summary-dup-section');
  if (summary.duplicatePids && summary.duplicatePids.length > 0) {
    document.getElementById('summary-dup-list').innerText = summary.duplicatePids.join(', ');
    dupSection.classList.remove('d-none');
  } else {
    dupSection.classList.add('d-none');
  }

  const failedSection = document.getElementById('summary-failed-section');
  if (summary.failedDetails && summary.failedDetails.length > 0) {
    document.getElementById('summary-failed-list').innerHTML = summary.failedDetails.join('<br>');
    failedSection.classList.remove('d-none');
  } else {
    failedSection.classList.add('d-none');
  }

  document.getElementById('import-summary-card').classList.remove('d-none');
}

function showDuplicateItemsModal() {
  const items = lastImportResult.duplicateItems || [];
  lastImportResult.type = 'duplicates';

  document.getElementById('importDetailsModalTitle').innerHTML = '<i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>Skipped Duplicate Records';
  document.getElementById('importDetailsModalSubtitle').innerText = `Total ${items.length} duplicate records were skipped during import`;

  const tbody = document.getElementById('import-details-table-body');
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No skipped duplicate records to display.</td></tr>';
  } else {
    let html = '';
    items.forEach(item => {
      html += `
        <tr>
          <td class="fw-bold text-secondary">Row ${item.row}</td>
          <td><a href="#" onclick="viewRecordByPid('${escapeHtml(item.pid)}'); return false;" class="pid-link" title="Click to view record details">${escapeHtml(item.pid)}</a></td>
          <td>${escapeHtml(item.name || '-')}</td>
          <td><span class="badge bg-warning text-dark">${escapeHtml(item.reason)}</span></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  importDetailsModalInstance.show();
}

function showFailedItemsModal() {
  const items = lastImportResult.failedItems || [];
  lastImportResult.type = 'failed';

  document.getElementById('importDetailsModalTitle').innerHTML = '<i class="bi bi-x-circle-fill text-danger me-2"></i>Failed Import Rows';
  document.getElementById('importDetailsModalSubtitle').innerText = `Total ${items.length} rows failed validation during import`;

  const tbody = document.getElementById('import-details-table-body');
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No failed rows to display.</td></tr>';
  } else {
    let html = '';
    items.forEach(item => {
      const pidDisplay = item.pid ? `<a href="#" onclick="viewRecordByPid('${escapeHtml(item.pid)}'); return false;" class="pid-link" title="Click to view record details">${escapeHtml(item.pid)}</a>` : '-';
      html += `
        <tr>
          <td class="fw-bold text-secondary">Row ${item.row}</td>
          <td>${pidDisplay}</td>
          <td>${escapeHtml(item.name || '-')}</td>
          <td><span class="badge bg-danger text-white">${escapeHtml(item.reason)}</span></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  importDetailsModalInstance.show();
}

function downloadImportIssueReport() {
  const type = lastImportResult.type;
  const items = type === 'duplicates' ? lastImportResult.duplicateItems : lastImportResult.failedItems;
  
  if (!items || items.length === 0) {
    showToast('info', 'No Data', 'No records available to export.');
    return;
  }

  const exportRows = items.map(item => ({
    "Excel Row": item.row,
    "PID": item.pid,
    "Name": item.name,
    "Reason / Error": item.reason
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  const sheetName = type === 'duplicates' ? 'Skipped_Duplicates' : 'Failed_Rows';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  XLSX.writeFile(workbook, `Import_${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('success', 'Report Exported', `${sheetName} report downloaded as Excel.`);
}

/* Exports */

async function exportDataToExcel() {
  showLoader('Generating Excel file...');
  try {
    const queryParams = new URLSearchParams({
      query: searchState.query,
      startDate: searchState.startDate,
      endDate: searchState.endDate,
      remark: searchState.remark
    });

    const res = await fetch(`/api/export?${queryParams.toString()}`);
    const data = await res.json();
    hideLoader();

    if (data.success) {
      const exportData = data.data;
      const sheetRows = [exportData.headers, ...exportData.rows];
      
      const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Records");
      
      XLSX.writeFile(workbook, `Data_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('success', 'Export Ready', 'Search results exported to Excel.');
    } else {
      showToast('danger', 'Export Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

function exportDataToPDF() {
  printCurrentTable();
}

function printCurrentTable() {
  window.print();
}

/* User Management (Admin Only) */

async function loadUsersList() {
  showLoader('Loading users...');
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    hideLoader();

    if (data.success) {
      rawUsersList = data.data || [];
      filterUsersTable();
    } else {
      showToast('danger', 'Users Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

function filterUsersTable() {
  const searchInput = document.getElementById('search-users-input');
  const q = (searchInput ? searchInput.value : '').trim().toLowerCase();

  const statusSelect = document.getElementById('filter-users-status');
  const targetStatus = statusSelect ? statusSelect.value : 'All';

  let filtered = [...rawUsersList];

  if (targetStatus !== 'All') {
    filtered = filtered.filter(u => (u.status || 'Active').toLowerCase() === targetStatus.toLowerCase());
  }

  if (q) {
    filtered = filtered.filter(u => 
      (u.username || '').toLowerCase().includes(q)
    );
  }

  renderUsersTable(filtered);
}

function renderUsersTable(usersList) {
  const tbody = document.getElementById('users-table-body');
  if (!usersList || usersList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No users found.</td></tr>';
    return;
  }

  let html = '';
  usersList.forEach(u => {
    const uJson = encodeURIComponent(JSON.stringify(u));
    const roleBadge = u.role === 'Admin' ? 'bg-danger' : u.role === 'Add' ? 'bg-primary' : 'bg-secondary';
    const statusBadge = u.status === 'Active' ? 'bg-success' : 'bg-secondary';

    html += `
      <tr>
        <td class="fw-bold text-dark"><i class="bi bi-person-circle text-secondary me-2"></i>${escapeHtml(u.username)}</td>
        <td><span class="badge ${roleBadge}">${escapeHtml(u.role)}</span></td>
        <td>
          <div class="form-check form-switch mb-0">
            <input class="form-check-input" type="checkbox" ${u.importPermission ? 'checked' : ''} onchange="toggleImportPermissionServer(${u.id}, this.checked)">
            <span class="small ${u.importPermission ? 'text-success fw-semibold' : 'text-muted'}">${u.importPermission ? 'Enabled' : 'Disabled'}</span>
          </div>
        </td>
        <td>
          <div class="form-check form-switch mb-0">
            <input class="form-check-input" type="checkbox" ${u.fullAccess ? 'checked' : ''} onchange="toggleFullAccessServer(${u.id}, this.checked)">
            <span class="small ${u.fullAccess ? 'text-primary fw-semibold' : 'text-muted'}">${u.fullAccess ? 'Granted' : 'Standard'}</span>
          </div>
        </td>
        <td>
          <div class="form-check form-switch mb-0">
            <input class="form-check-input" type="checkbox" ${u.deleteRequestPermission ? 'checked' : ''} onchange="toggleDeleteRequestPermissionServer(${u.id}, this.checked)">
            <span class="small ${u.deleteRequestPermission ? 'text-warning fw-semibold' : 'text-muted'}">${u.deleteRequestPermission ? 'Granted' : 'None'}</span>
          </div>
        </td>
        <td>
          <div class="form-check form-switch mb-0">
            <input class="form-check-input" type="checkbox" ${u.status === 'Active' ? 'checked' : ''} onchange="toggleUserStatusServer(${u.id}, this.checked)">
            <span class="badge ${statusBadge}">${escapeHtml(u.status)}</span>
          </div>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-warning me-1" title="Reset Password" onclick="showResetPasswordModal(${u.id}, '${escapeHtml(u.username)}')"><i class="bi bi-key"></i></button>
          <button class="btn btn-sm btn-outline-primary me-1" title="Edit User" onclick="showEditUserModal('${uJson}')"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" title="Delete User" onclick="confirmDeleteUser(${u.id}, '${escapeHtml(u.username)}')"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function showAddUserModal() {
  document.getElementById('userModalTitle').innerText = 'Add New User';
  document.getElementById('userForm').reset();
  document.getElementById('user-edit-mode').value = 'add';
  document.getElementById('user-id').value = '';
  document.getElementById('modal-user-username').disabled = false;
  document.getElementById('modal-user-password-container').classList.remove('d-none');
  document.getElementById('modal-user-password').required = true;
  document.getElementById('modal-user-deleterequest').checked = false;
  userModalInstance.show();
}

function showEditUserModal(encodedUserJson) {
  const u = JSON.parse(decodeURIComponent(encodedUserJson));
  document.getElementById('userModalTitle').innerText = 'Edit User (' + u.username + ')';
  document.getElementById('user-edit-mode').value = 'edit';
  document.getElementById('user-id').value = u.id;

  document.getElementById('modal-user-username').value = u.username;
  document.getElementById('modal-user-username').disabled = true;
  document.getElementById('modal-user-password').value = '';
  document.getElementById('modal-user-password-container').classList.add('d-none');
  document.getElementById('modal-user-password').required = false;

  document.getElementById('modal-user-role').value = u.role;
  document.getElementById('modal-user-import').checked = u.importPermission;
  document.getElementById('modal-user-fullaccess').checked = u.fullAccess;
  document.getElementById('modal-user-deleterequest').checked = !!u.deleteRequestPermission;
  document.getElementById('modal-user-status').value = u.status;

  userModalInstance.show();
}

function handleRoleSelectChange(val) {
  if (val === 'Admin') {
    document.getElementById('modal-user-import').checked = true;
    document.getElementById('modal-user-fullaccess').checked = true;
  }
}

async function handleUserFormSubmit(event) {
  event.preventDefault();
  const mode = document.getElementById('user-edit-mode').value;
  const userId = document.getElementById('user-id').value;

  const userData = {
    newUsername: document.getElementById('modal-user-username').value.trim(),
    password: document.getElementById('modal-user-password').value,
    role: document.getElementById('modal-user-role').value,
    importPermission: document.getElementById('modal-user-import').checked,
    fullAccess: document.getElementById('modal-user-fullaccess').checked,
    deleteRequestPermission: document.getElementById('modal-user-deleterequest').checked,
    status: document.getElementById('modal-user-status').value
  };

  const endpoint = mode === 'add' ? '/api/users' : `/api/users/${userId}`;
  const method = mode === 'add' ? 'POST' : 'PUT';

  showLoader(mode === 'add' ? 'Creating user account...' : 'Updating user account...');
  try {
    const res = await fetch(endpoint, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    hideLoader();

    if (data.success) {
      userModalInstance.hide();
      showToast('success', 'User Saved', data.message);
      loadUsersList();
    } else {
      showToast('danger', 'User Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Server Error', err.message);
  }
}

async function toggleImportPermissionServer(userId, enabled) {
  try {
    const res = await fetch(`/api/users/${userId}/import-permission`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast('success', 'Permission Updated', data.message);
    } else {
      showToast('danger', 'Error', data.message);
      loadUsersList();
    }
  } catch (err) {
    showToast('danger', 'Error', err.message);
  }
}

async function toggleFullAccessServer(userId, enabled) {
  try {
    const res = await fetch(`/api/users/${userId}/full-access`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast('success', 'Access Updated', data.message);
    } else {
      showToast('danger', 'Error', data.message);
      loadUsersList();
    }
  } catch (err) {
    showToast('danger', 'Error', err.message);
  }
}

async function toggleDeleteRequestPermissionServer(userId, enabled) {
  try {
    const res = await fetch(`/api/users/${userId}/delete-request-permission`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast('success', 'Permission Updated', data.message);
    } else {
      showToast('danger', 'Error', data.message);
      loadUsersList();
    }
  } catch (err) {
    showToast('danger', 'Error', err.message);
  }
}

/* Delete Requests Module */

async function fetchPendingDeleteRequestsCount() {
  try {
    const res = await fetch('/api/delete-requests/pending');
    const data = await res.json();
    if (data.success) {
      const count = data.data ? data.data.length : 0;
      const badge = document.getElementById('nav-delete-requests-badge');
      if (badge) {
        badge.innerText = count;
        if (count > 0) badge.classList.remove('d-none');
        else badge.classList.add('d-none');
      }
    }
  } catch (err) {}
}

function openSendDeleteRequestModal(recordId, pid) {
  const rec = currentRecordsData.find(r => r.id === parseInt(recordId, 10) || r.pid === String(pid));
  document.getElementById('send-delete-record-id').value = recordId;
  document.getElementById('send-delete-pid').innerText = pid;
  document.getElementById('send-delete-name').innerText = rec ? rec.name : '-';
  document.getElementById('send-delete-ut').innerText = rec ? (rec.utNo || '-') : '-';
  document.getElementById('send-delete-aadhar').innerText = rec ? (rec.aadharNo || '#N/A') : '#N/A';
  document.getElementById('send-delete-reason').value = '';
  sendDeleteRequestModalInstance.show();
}

async function handleSendDeleteRequestSubmit(event) {
  event.preventDefault();
  const recordId = document.getElementById('send-delete-record-id').value;
  const reason = document.getElementById('send-delete-reason').value.trim();

  sendDeleteRequestModalInstance.hide();
  showLoader('Sending delete request...');
  try {
    const res = await fetch('/api/delete-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, reason })
    });
    const data = await res.json();
    hideLoader();

    if (data.success) {
      showToast('success', 'Request Sent', data.message);
      triggerFetchRecords();
    } else {
      showToast('danger', 'Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

async function loadDeleteRequestsList() {
  showLoader('Loading delete requests...');
  try {
    const res = await fetch('/api/delete-requests/all');
    const data = await res.json();
    hideLoader();

    if (data.success) {
      rawPendingDeleteRequests = data.data || [];
      filterDeleteRequestsTable();
      fetchPendingDeleteRequestsCount();
    } else {
      showToast('danger', 'Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

function filterDeleteRequestsTable() {
  const searchInput = document.getElementById('search-delete-requests-input');
  const q = (searchInput ? searchInput.value : '').trim().toLowerCase();

  const statusSelect = document.getElementById('filter-delete-requests-status');
  const targetStatus = statusSelect ? statusSelect.value : 'Pending';

  let filtered = [...rawPendingDeleteRequests];

  if (targetStatus !== 'All') {
    filtered = filtered.filter(r => (r.status || 'Pending').toLowerCase() === targetStatus.toLowerCase());
  }

  if (q) {
    filtered = filtered.filter(r => 
      (r.pid || '').toLowerCase().includes(q) || (r.utNo || '').toLowerCase().includes(q)
    );
  }

  renderDeleteRequestsTable(filtered);
}

function renderDeleteRequestsTable(requests) {
  const tbody = document.getElementById('delete-requests-table-body');
  if (!requests || requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>No delete requests match the criteria.</td></tr>';
    return;
  }

  let html = '';
  requests.forEach(req => {
    const reqJson = encodeURIComponent(JSON.stringify(req));
    const statusBadge = req.status === 'Approved' ? '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Approved</span>' : req.status === 'Rejected' ? '<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Rejected</span>' : '<span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>Pending</span>';

    let actionCol = '';
    if (req.status === 'Pending') {
      actionCol = `
        <button class="btn btn-sm btn-danger me-1" title="Approve and Delete Data" onclick="approveDeleteRequest(${req.id}, '${escapeHtml(req.pid)}')">
          <i class="bi bi-check-circle me-1"></i>Delete Data
        </button>
        <button class="btn btn-sm btn-outline-secondary" title="Reject Request" onclick="rejectDeleteRequest(${req.id}, '${escapeHtml(req.pid)}')">
          <i class="bi bi-x-circle me-1"></i>Reject
        </button>
      `;
    } else {
      actionCol = `<span class="small text-muted"><i class="bi bi-person-check me-1"></i>${escapeHtml(req.status)} by <strong>${escapeHtml(req.actionBy || 'Admin')}</strong></span>`;
    }

    html += `
      <tr>
        <td><a href="#" onclick="viewRecordByPid('${escapeHtml(req.pid)}', '${reqJson}'); return false;" class="pid-link" title="Click to view record details">${escapeHtml(req.pid)}</a></td>
        <td class="fw-semibold">${escapeHtml(req.name)}</td>
        <td>${escapeHtml(req.father || '-')}</td>
        <td>${escapeHtml(req.utNo || '-')}</td>
        <td><span class="badge bg-light text-dark border">${escapeHtml(req.requestedBy)}</span></td>
        <td><span class="small text-dark fw-semibold text-truncate d-inline-block" style="max-width: 150px;" title="${escapeHtml(req.reason)}">${escapeHtml(req.reason || '-')}</span></td>
        <td class="small text-muted">${escapeHtml(req.requestedDate)} ${escapeHtml(req.requestedTime)}</td>
        <td>${statusBadge}</td>
        <td class="text-end">${actionCol}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

async function approveDeleteRequest(requestId, pid) {
  document.getElementById('confirmModalTitle').innerText = 'Approve & Delete Data?';
  document.getElementById('confirmModalMessage').innerText = `Are you sure you want to approve delete request and PERMANENTLY delete record PID "${pid}"?`;
  const executeBtn = document.getElementById('confirmModalExecuteBtn');
  executeBtn.innerText = 'Yes, Delete Record';
  executeBtn.className = 'btn btn-danger btn-sm px-3';

  executeBtn.onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Deleting record and resolving request...');
    try {
      const res = await fetch(`/api/delete-requests/${requestId}/approve`, { method: 'POST' });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('success', 'Approved & Deleted', data.message);
        loadDeleteRequestsList();
      } else {
        showToast('danger', 'Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Error', err.message);
    }
  };

  confirmModalInstance.show();
}

async function rejectDeleteRequest(requestId, pid) {
  document.getElementById('confirmModalTitle').innerText = 'Reject Delete Request?';
  document.getElementById('confirmModalMessage').innerText = `Reject delete request for record PID "${pid}"? Record will NOT be deleted.`;
  const executeBtn = document.getElementById('confirmModalExecuteBtn');
  executeBtn.innerText = 'Yes, Reject Request';
  executeBtn.className = 'btn btn-secondary btn-sm px-3';

  executeBtn.onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Rejecting request...');
    try {
      const res = await fetch(`/api/delete-requests/${requestId}/reject`, { method: 'POST' });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('info', 'Request Rejected', data.message);
        loadDeleteRequestsList();
      } else {
        showToast('danger', 'Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Error', err.message);
    }
  };

  confirmModalInstance.show();
}

async function fetchPendingDeleteRequestsCount() {
  try {
    const res = await fetch('/api/delete-requests/pending');
    const data = await res.json();
    if (data.success) {
      const count = (data.data || []).length;
      const badge = document.getElementById('nav-delete-requests-badge');
      if (badge) {
        badge.innerText = count;
        if (count > 0) badge.classList.remove('d-none');
        else badge.classList.add('d-none');
      }
    }
  } catch (e) {}
}

async function fetchPendingEditRequestsCount() {
  try {
    const res = await fetch('/api/edit-requests/pending');
    const data = await res.json();
    if (data.success) {
      const count = (data.data || []).length;
      const badge = document.getElementById('nav-edit-requests-badge');
      if (badge) {
        badge.innerText = count;
        if (count > 0) badge.classList.remove('d-none');
        else badge.classList.add('d-none');
      }
    }
  } catch (e) {}
}

function openSendEditRequestModal(encodedRecJson) {
  const rec = JSON.parse(decodeURIComponent(encodedRecJson));
  document.getElementById('send-edit-record-id').value = rec.id || rec.rowIndex;
  document.getElementById('send-edit-pid').innerText = rec.pid;
  document.getElementById('send-edit-name').value = rec.name;
  document.getElementById('send-edit-father').value = rec.father || '';
  document.getElementById('send-edit-ut').value = rec.utNo || rec.ut_no || '';
  document.getElementById('send-edit-aadhar').value = rec.aadharNo || rec.aadhar_no || '';
  document.getElementById('send-edit-date').value = rec.date || '';
  document.getElementById('send-edit-reason').value = '';

  const remarkSelect = document.getElementById('send-edit-remark');
  remarkSelect.innerHTML = '<option value="">Select Remark</option>';
  currentRemarkOptions.forEach(opt => {
    const selected = opt.toLowerCase() === (rec.remark || '').toLowerCase() ? 'selected' : '';
    remarkSelect.innerHTML += `<option value="${escapeHtml(opt)}" ${selected}>${escapeHtml(opt)}</option>`;
  });

  sendEditRequestModalInstance.show();
  handleSendEditRemarkChange();
}

async function handleSendEditRequestSubmit(event) {
  event.preventDefault();
  const recordId = document.getElementById('send-edit-record-id').value;
  const name = document.getElementById('send-edit-name').value.trim();
  const father = document.getElementById('send-edit-father').value.trim();
  const utNo = document.getElementById('send-edit-ut').value.trim();
  let aadharNo = document.getElementById('send-edit-aadhar').value.trim();
  const date = document.getElementById('send-edit-date').value;
  const remark = document.getElementById('send-edit-remark').value;
  const reason = document.getElementById('send-edit-reason').value.trim();

  if ((remark || '').toLowerCase() === 'foreigner') {
    aadharNo = '';
  }

  if (!reason) {
    showToast('danger', 'Validation Error', 'Please provide a reason for requesting edit.');
    return;
  }

  sendEditRequestModalInstance.hide();
  showLoader('Submitting edit request...');
  try {
    const res = await fetch('/api/edit-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordId,
        proposedData: { name, father, utNo, aadharNo, date, remark },
        reason
      })
    });
    const data = await res.json();
    hideLoader();

    if (data.success) {
      showToast('success', 'Request Sent', data.message);
      triggerFetchRecords();
    } else {
      showToast('danger', 'Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Server Error', err.message);
  }
}

async function loadEditRequestsList() {
  showLoader('Loading edit requests...');
  try {
    const res = await fetch('/api/edit-requests/all');
    const data = await res.json();
    hideLoader();

    if (data.success) {
      rawPendingEditRequests = data.data || [];
      const searchInput = document.getElementById('search-edit-requests-input');
      if (searchInput) searchInput.value = '';
      const statusSelect = document.getElementById('filter-edit-requests-status');
      if (statusSelect) statusSelect.value = 'Pending';
      filterEditRequestsTable();
      fetchPendingEditRequestsCount();
    } else {
      showToast('danger', 'Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

function filterEditRequestsTable() {
  const inputEl = document.getElementById('search-edit-requests-input');
  const statusEl = document.getElementById('filter-edit-requests-status');
  const q = (inputEl ? inputEl.value : '').trim().toLowerCase();
  const statusFilter = statusEl ? statusEl.value : 'Pending';

  let filtered = [...rawPendingEditRequests];

  if (statusFilter !== 'All') {
    filtered = filtered.filter(r => (r.status || 'Pending').toLowerCase() === statusFilter.toLowerCase());
  }

  if (q) {
    filtered = filtered.filter(r => 
      (r.pid || '').toLowerCase().includes(q) || (r.utNo || '').toLowerCase().includes(q)
    );
  }

  renderEditRequestsTable(filtered);
}

function renderEditRequestsTable(requests) {
  const tbody = document.getElementById('edit-requests-table-body');
  if (!requests || requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>No edit requests match the criteria.</td></tr>';
    return;
  }

  let html = '';
  requests.forEach(req => {
    const reqJson = encodeURIComponent(JSON.stringify(req));
    const statusBadge = req.status === 'Approved' ? '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Approved</span>' : req.status === 'Rejected' ? '<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Rejected</span>' : '<span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>Pending</span>';

    let actionCol = '';
    if (req.status === 'Pending') {
      actionCol = `
        <button class="btn btn-sm btn-info text-dark me-1" title="Review Proposed Changes" onclick="viewEditRequestComparison('${reqJson}')">
          <i class="bi bi-eye me-1"></i>Review Changes
        </button>
        <button class="btn btn-sm btn-success me-1" title="Approve and Update Data" onclick="approveEditRequest(${req.id}, '${escapeHtml(req.pid)}')">
          <i class="bi bi-check-circle me-1"></i>Approve
        </button>
        <button class="btn btn-sm btn-outline-secondary" title="Reject Request" onclick="rejectDeleteRequest(${req.id}, '${escapeHtml(req.pid)}')">
          <i class="bi bi-x-circle me-1"></i>Reject
        </button>
      `;
    } else {
      actionCol = `
        <button class="btn btn-sm btn-outline-info me-1" title="View Comparison" onclick="viewEditRequestComparison('${reqJson}')"><i class="bi bi-eye me-1"></i>View</button>
        <span class="small text-muted"><i class="bi bi-person-check me-1"></i>${escapeHtml(req.status)} by <strong>${escapeHtml(req.actionBy || 'Admin')}</strong></span>
      `;
    }

    const prop = req.proposedData || {};
    const changesSummary = `Name: ${escapeHtml(prop.name || req.name)} | UT: ${escapeHtml(prop.utNo || req.utNo || '-')}`;

    html += `
      <tr>
        <td><a href="#" onclick="viewRecordByPid('${escapeHtml(req.pid)}', '${reqJson}'); return false;" class="pid-link" title="Click to view record details">${escapeHtml(req.pid)}</a></td>
        <td class="fw-semibold">${escapeHtml(req.name)}</td>
        <td><span class="small text-muted text-truncate d-inline-block" style="max-width: 180px;" title="${changesSummary}">${changesSummary}</span></td>
        <td><span class="badge bg-light text-dark border">${escapeHtml(req.requestedBy)}</span></td>
        <td><span class="small text-dark fw-semibold text-truncate d-inline-block" style="max-width: 140px;" title="${escapeHtml(req.reason)}">${escapeHtml(req.reason || '-')}</span></td>
        <td class="small text-muted">${escapeHtml(req.requestedDate)} ${escapeHtml(req.requestedTime)}</td>
        <td>${statusBadge}</td>
        <td class="text-end">${actionCol}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function viewEditRequestComparison(encodedReqJson) {
  const req = JSON.parse(decodeURIComponent(encodedReqJson));
  const prop = req.proposedData || {};

  document.getElementById('comp-requested-by').innerText = req.requestedBy;
  document.getElementById('comp-requested-date').innerText = (req.requestedDate || '') + ' ' + (req.requestedTime || '');
  document.getElementById('comp-reason').innerText = req.reason || 'No reason provided';

  const fields = [
    { key: 'pid', label: 'PID', orig: req.pid, proposed: prop.pid || req.pid },
    { key: 'name', label: 'Name', orig: req.name, proposed: prop.name || req.name },
    { key: 'father', label: 'Father Name', orig: req.father || '-', proposed: prop.father || '-' },
    { key: 'utNo', label: 'UT No', orig: req.utNo || '-', proposed: prop.utNo || '-' },
    { key: 'aadharNo', label: 'Aadhar No', orig: req.aadharNo || '-', proposed: prop.aadharNo || '-' },
    { key: 'date', label: 'Record Date', orig: req.date || '-', proposed: prop.date || '-' },
    { key: 'remark', label: 'Remark', orig: req.remark || '-', proposed: prop.remark || '-' }
  ];

  let tbodyHtml = '';
  fields.forEach(f => {
    const isChanged = String(f.orig).trim() !== String(f.proposed).trim();
    const highlightClass = isChanged ? 'bg-warning bg-opacity-10 fw-bold text-dark' : '';
    const badge = isChanged ? '<span class="badge bg-warning text-dark ms-2">Changed</span>' : '';

    tbodyHtml += `
      <tr class="${highlightClass}">
        <td class="fw-semibold">${f.label}</td>
        <td class="text-secondary">${escapeHtml(f.orig)}</td>
        <td class="text-dark">${escapeHtml(f.proposed)} ${badge}</td>
      </tr>
    `;
  });

  document.getElementById('comp-table-body').innerHTML = tbodyHtml;

  const footer = document.getElementById('comp-modal-footer');
  if (req.status === 'Pending') {
    footer.innerHTML = `
      <button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>
      <button type="button" class="btn btn-outline-secondary" onclick="viewEditComparisonModalInstance.hide(); rejectEditRequest(${req.id}, '${escapeHtml(req.pid)}')"><i class="bi bi-x-circle me-1"></i>Reject</button>
      <button type="button" class="btn btn-success fw-semibold" onclick="viewEditComparisonModalInstance.hide(); approveEditRequest(${req.id}, '${escapeHtml(req.pid)}')"><i class="bi bi-check-circle me-1"></i>Approve & Update Data</button>
    `;
  } else {
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
    `;
  }

  viewEditComparisonModalInstance.show();
}

async function approveEditRequest(requestId, pid) {
  document.getElementById('confirmModalTitle').innerText = 'Approve & Update Data?';
  document.getElementById('confirmModalMessage').innerText = `Are you sure you want to approve edit request and update record PID "${pid}"?`;
  const executeBtn = document.getElementById('confirmModalExecuteBtn');
  executeBtn.innerText = 'Yes, Update Record';
  executeBtn.className = 'btn btn-success btn-sm px-3';

  executeBtn.onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Updating record and resolving request...');
    try {
      const res = await fetch(`/api/edit-requests/${requestId}/approve`, { method: 'POST' });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('success', 'Approved & Updated', data.message);
        loadEditRequestsList();
        fetchPendingEditRequestsCount();
      } else {
        showToast('danger', 'Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Error', err.message);
    }
  };

  confirmModalInstance.show();
}

async function rejectEditRequest(requestId, pid) {
  document.getElementById('confirmModalTitle').innerText = 'Reject Edit Request?';
  document.getElementById('confirmModalMessage').innerText = `Reject edit request for record PID "${pid}"? Record will NOT be updated.`;
  const executeBtn = document.getElementById('confirmModalExecuteBtn');
  executeBtn.innerText = 'Yes, Reject Request';
  executeBtn.className = 'btn btn-secondary btn-sm px-3';

  executeBtn.onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Rejecting request...');
    try {
      const res = await fetch(`/api/edit-requests/${requestId}/reject`, { method: 'POST' });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('info', 'Request Rejected', data.message);
        loadEditRequestsList();
        fetchPendingEditRequestsCount();
      } else {
        showToast('danger', 'Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Error', err.message);
    }
  };

  confirmModalInstance.show();
}

function openSendListAddRequestModal() {
  document.getElementById('sendListAddRequestForm').reset();
  sendListAddRequestModalInstance.show();
}

async function handleSendListAddRequestSubmit(event) {
  event.preventDefault();
  const optionValue = document.getElementById('send-list-add-option').value.trim();
  const reason = document.getElementById('send-list-add-reason').value.trim();

  if (!optionValue) {
    showToast('danger', 'Validation Error', 'Option name is required.');
    return;
  }

  sendListAddRequestModalInstance.hide();
  showLoader('Submitting list add request...');
  try {
    const res = await fetch('/api/list-add-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionValue, reason })
    });
    const data = await res.json();
    hideLoader();

    if (data.success) {
      showToast('success', 'Request Sent', data.message);
      loadMyRequestsList();
      loadReactiveList();
      loadRemarkOptions();
    } else {
      showToast('danger', 'Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Server Error', err.message);
  }
}

async function cancelMyListAddRequest(requestId, optionValue) {
  document.getElementById('confirmModalTitle').innerText = 'Cancel List Add Request?';
  document.getElementById('confirmModalMessage').innerText = `Withdraw your request to add option "${optionValue}"?`;
  const executeBtn = document.getElementById('confirmModalExecuteBtn');
  executeBtn.innerText = 'Yes, Withdraw Request';
  executeBtn.className = 'btn btn-danger btn-sm px-3';

  executeBtn.onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Canceling request...');
    try {
      const res = await fetch(`/api/list-add-requests/${requestId}/cancel`, { method: 'DELETE' });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('success', 'Request Canceled', data.message);
        loadMyRequestsList();
      } else {
        showToast('danger', 'Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Error', err.message);
    }
  };

  confirmModalInstance.show();
}

async function loadMyRequestsList() {
  showLoader('Loading your requests...');
  try {
    const [delRes, editRes, listAddRes] = await Promise.all([
      fetch('/api/delete-requests/my-requests').then(r => r.json()),
      fetch('/api/edit-requests/my-requests').then(r => r.json()),
      fetch('/api/list-add-requests/my-requests').then(r => r.json())
    ]);
    hideLoader();

    const delList = (delRes.success ? delRes.data || [] : []).map(r => ({ ...r, requestType: 'Delete' }));
    const editList = (editRes.success ? editRes.data || [] : []).map(r => ({ ...r, requestType: 'Edit' }));
    const listAddList = (listAddRes.success ? listAddRes.data || [] : []).map(r => ({ ...r, requestType: 'List Add' }));

    rawMyRequests = [...delList, ...editList, ...listAddList];
    rawMyRequests.sort((a, b) => {
      const dtA = (a.requestedDate || '') + ' ' + (a.requestedTime || '');
      const dtB = (b.requestedDate || '') + ' ' + (b.requestedTime || '');
      return dtB.localeCompare(dtA);
    });

    const searchInput = document.getElementById('search-my-requests-input');
    if (searchInput) searchInput.value = '';
    const typeFilterSelect = document.getElementById('filter-my-requests-type');
    if (typeFilterSelect) typeFilterSelect.value = 'All';
    const statusFilterSelect = document.getElementById('filter-my-requests-status');
    if (statusFilterSelect) statusFilterSelect.value = 'All';

    filterMyRequestsTable();
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

function filterMyRequestsTable() {
  const inputEl = document.getElementById('search-my-requests-input');
  const typeEl = document.getElementById('filter-my-requests-type');
  const statusEl = document.getElementById('filter-my-requests-status');

  const q = (inputEl ? inputEl.value : '').trim().toLowerCase();
  const typeFilter = typeEl ? typeEl.value : 'All';
  const statusFilter = statusEl ? statusEl.value : 'All';

  let filtered = [...rawMyRequests];

  if (typeFilter !== 'All') {
    filtered = filtered.filter(r => r.requestType === typeFilter);
  }

  if (statusFilter !== 'All') {
    filtered = filtered.filter(r => (r.status || '').toLowerCase() === statusFilter.toLowerCase());
  }

  if (q) {
    filtered = filtered.filter(r => 
      (r.pid || '').toLowerCase().includes(q) || 
      (r.utNo || '').toLowerCase().includes(q) ||
      (r.optionValue || '').toLowerCase().includes(q) ||
      (r.name || '').toLowerCase().includes(q)
    );
  }

  renderMyRequestsTable(filtered);
}

function renderMyRequestsTable(requests) {
  const tbody = document.getElementById('my-requests-table-body');
  if (!requests || requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>You have not sent any requests matching criteria.</td></tr>';
    return;
  }

  let html = '';
  requests.forEach(req => {
    const reqJson = encodeURIComponent(JSON.stringify(req));
    const statusBadge = req.status === 'Approved' ? 'bg-success' : req.status === 'Rejected' ? 'bg-secondary' : 'bg-warning text-dark';
    
    let typeBadge = '';
    let pidDisplay = '-';
    let nameDisplay = '-';

    if (req.requestType === 'Delete') {
      typeBadge = '<span class="badge bg-danger"><i class="bi bi-trash-fill me-1"></i>Delete</span>';
      pidDisplay = `<a href="#" onclick="viewRecordByPid('${escapeHtml(req.pid)}', '${reqJson}'); return false;" class="pid-link" title="Click to view record details">${escapeHtml(req.pid)}</a>`;
      nameDisplay = escapeHtml(req.name);
    } else if (req.requestType === 'Edit') {
      typeBadge = '<span class="badge bg-info text-dark"><i class="bi bi-pencil-square me-1"></i>Edit</span>';
      pidDisplay = `<a href="#" onclick="viewRecordByPid('${escapeHtml(req.pid)}', '${reqJson}'); return false;" class="pid-link" title="Click to view record details">${escapeHtml(req.pid)}</a>`;
      nameDisplay = escapeHtml(req.name);
    } else if (req.requestType === 'List Add') {
      typeBadge = '<span class="badge bg-success"><i class="bi bi-plus-circle me-1"></i>List Add</span>';
      pidDisplay = '<span class="text-muted small">N/A</span>';
      nameDisplay = `<span class="fw-semibold text-primary"><i class="bi bi-tag-fill me-1"></i>${escapeHtml(req.optionValue)}</span>`;
    }

    let actionCol = '-';
    if (req.status === 'Pending') {
      if (req.requestType === 'Delete') {
        actionCol = `<button class="btn btn-sm btn-outline-danger" title="Cancel Request" onclick="cancelMyDeleteRequest(${req.id}, '${escapeHtml(req.pid)}')"><i class="bi bi-trash me-1"></i>Cancel</button>`;
      } else if (req.requestType === 'Edit') {
        actionCol = `<button class="btn btn-sm btn-outline-danger" title="Cancel Request" onclick="cancelMyEditRequest(${req.id}, '${escapeHtml(req.pid)}')"><i class="bi bi-trash me-1"></i>Cancel</button>`;
      } else if (req.requestType === 'List Add') {
        actionCol = `<button class="btn btn-sm btn-outline-danger" title="Cancel Request" onclick="cancelMyListAddRequest(${req.id}, '${escapeHtml(req.optionValue)}')"><i class="bi bi-trash me-1"></i>Cancel</button>`;
      }
    }

    html += `
      <tr>
        <td>${typeBadge}</td>
        <td>${pidDisplay}</td>
        <td class="fw-semibold">${nameDisplay}</td>
        <td>${escapeHtml(req.father || '-')}</td>
        <td>${escapeHtml(req.utNo || '-')}</td>
        <td><span class="small text-dark fw-semibold text-truncate d-inline-block" style="max-width: 150px;" title="${escapeHtml(req.reason)}">${escapeHtml(req.reason || '-')}</span></td>
        <td class="small text-muted">${escapeHtml(req.requestedDate)} ${escapeHtml(req.requestedTime)}</td>
        <td><span class="badge ${statusBadge}">${escapeHtml(req.status)}</span></td>
        <td>${escapeHtml(req.actionBy || '-')}</td>
        <td class="text-end">${actionCol}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/* ==========================================================================
   Admin Unified Requests Management Hub (Edit, Delete, List Add in 1 Page)
   ========================================================================== */

async function fetchAllPendingRequestsCounts() {
  try {
    const [delRes, editRes, listAddRes] = await Promise.all([
      fetch('/api/delete-requests/pending').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/edit-requests/pending').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/list-add-requests/pending').then(r => r.json()).catch(() => ({ data: [] }))
    ]);

    const delCount = (delRes.success && delRes.data ? delRes.data : []).length;
    const editCount = (editRes.success && editRes.data ? editRes.data : []).length;
    const listAddCount = (listAddRes.success && listAddRes.data ? listAddRes.data : []).length;
    const totalCount = delCount + editCount + listAddCount;

    const allBadge = document.getElementById('nav-all-requests-badge');
    if (allBadge) {
      allBadge.innerText = totalCount;
      if (totalCount > 0) allBadge.classList.remove('d-none');
      else allBadge.classList.add('d-none');
    }

    const delBadge = document.getElementById('nav-delete-requests-badge');
    if (delBadge) {
      delBadge.innerText = delCount;
      if (delCount > 0) delBadge.classList.remove('d-none');
      else delBadge.classList.add('d-none');
    }

    const editBadge = document.getElementById('nav-edit-requests-badge');
    if (editBadge) {
      editBadge.innerText = editCount;
      if (editCount > 0) editBadge.classList.remove('d-none');
      else editBadge.classList.add('d-none');
    }

    const elTotal = document.getElementById('admin-total-pending');
    if (elTotal) elTotal.innerText = totalCount;
    const elEdit = document.getElementById('admin-pending-edit');
    if (elEdit) elEdit.innerText = editCount;
    const elDel = document.getElementById('admin-pending-delete');
    if (elDel) elDel.innerText = delCount;
    const elList = document.getElementById('admin-pending-listadd');
    if (elList) elList.innerText = listAddCount;

  } catch (e) {}
}

async function loadAllRequestsList() {
  showLoader('Loading all incoming requests...');
  try {
    const [delRes, editRes, listAddRes] = await Promise.all([
      fetch('/api/delete-requests/all').then(r => r.json()),
      fetch('/api/edit-requests/all').then(r => r.json()),
      fetch('/api/list-add-requests/all').then(r => r.json())
    ]);
    hideLoader();

    const delList = (delRes.success ? delRes.data || [] : []).map(r => ({ ...r, requestType: 'Delete' }));
    const editList = (editRes.success ? editRes.data || [] : []).map(r => ({ ...r, requestType: 'Edit' }));
    const listAddList = (listAddRes.success ? listAddRes.data || [] : []).map(r => ({ ...r, requestType: 'List Add' }));

    rawAllAdminRequests = [...delList, ...editList, ...listAddList];
    rawAllAdminRequests.sort((a, b) => {
      const dtA = (a.requestedDate || '') + ' ' + (a.requestedTime || '');
      const dtB = (b.requestedDate || '') + ' ' + (b.requestedTime || '');
      return dtB.localeCompare(dtA);
    });

    fetchAllPendingRequestsCounts();

    const searchInput = document.getElementById('search-all-requests-input');
    if (searchInput) searchInput.value = '';
    const typeFilterSelect = document.getElementById('filter-all-requests-type');
    if (typeFilterSelect) typeFilterSelect.value = 'All';
    const statusFilterSelect = document.getElementById('filter-all-requests-status');
    if (statusFilterSelect) statusFilterSelect.value = 'Pending';

    filterAllRequestsTable();
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

function filterAllRequestsTable() {
  const inputEl = document.getElementById('search-all-requests-input');
  const typeEl = document.getElementById('filter-all-requests-type');
  const statusEl = document.getElementById('filter-all-requests-status');

  const q = (inputEl ? inputEl.value : '').trim().toLowerCase();
  const typeFilter = typeEl ? typeEl.value : 'All';
  const statusFilter = statusEl ? statusEl.value : 'Pending';

  let filtered = [...rawAllAdminRequests];

  if (typeFilter !== 'All') {
    filtered = filtered.filter(r => r.requestType === typeFilter);
  }

  if (statusFilter !== 'All') {
    filtered = filtered.filter(r => (r.status || 'Pending').toLowerCase() === statusFilter.toLowerCase());
  }

  if (q) {
    filtered = filtered.filter(r => 
      (r.pid || '').toLowerCase().includes(q) || 
      (r.utNo || '').toLowerCase().includes(q) ||
      (r.optionValue || '').toLowerCase().includes(q) ||
      (r.name || '').toLowerCase().includes(q) ||
      (r.requestedBy || '').toLowerCase().includes(q)
    );
  }

  renderAllRequestsTable(filtered);
}

function renderAllRequestsTable(requests) {
  const tbody = document.getElementById('all-requests-table-body');
  if (!requests || requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>No requests match the current filters.</td></tr>';
    return;
  }

  let html = '';
  requests.forEach(req => {
    const reqJson = encodeURIComponent(JSON.stringify(req));
    const statusBadge = req.status === 'Approved' ? '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Approved</span>' : req.status === 'Rejected' ? '<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Rejected</span>' : '<span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>Pending</span>';

    let typeBadge = '';
    let targetDisplay = '-';
    let nameDisplay = '-';
    let actionCol = '';

    if (req.requestType === 'Delete') {
      typeBadge = '<span class="badge bg-danger"><i class="bi bi-trash-fill me-1"></i>Delete</span>';
      targetDisplay = `<a href="#" onclick="viewRecordByPid('${escapeHtml(req.pid)}', '${reqJson}'); return false;" class="pid-link" title="Click to view record details">${escapeHtml(req.pid)}</a>`;
      nameDisplay = escapeHtml(req.name);

      if (req.status === 'Pending') {
        actionCol = `
          <button class="btn btn-sm btn-danger me-1" title="Approve and Delete Data" onclick="approveDeleteRequest(${req.id}, '${escapeHtml(req.pid)}')">
            <i class="bi bi-check-circle me-1"></i>Delete Data
          </button>
          <button class="btn btn-sm btn-outline-secondary" title="Reject Request" onclick="rejectDeleteRequest(${req.id}, '${escapeHtml(req.pid)}')">
            <i class="bi bi-x-circle me-1"></i>Reject
          </button>
        `;
      } else {
        actionCol = `<span class="small text-muted"><i class="bi bi-person-check me-1"></i>${escapeHtml(req.status)} by <strong>${escapeHtml(req.actionBy || 'Admin')}</strong></span>`;
      }
    } else if (req.requestType === 'Edit') {
      typeBadge = '<span class="badge bg-info text-dark"><i class="bi bi-pencil-square me-1"></i>Edit</span>';
      targetDisplay = `<a href="#" onclick="viewRecordByPid('${escapeHtml(req.pid)}', '${reqJson}'); return false;" class="pid-link" title="Click to view record details">${escapeHtml(req.pid)}</a>`;
      nameDisplay = escapeHtml(req.name);

      if (req.status === 'Pending') {
        actionCol = `
          <button class="btn btn-sm btn-info text-dark me-1" title="Review Proposed Changes" onclick="viewEditRequestComparison('${reqJson}')">
            <i class="bi bi-eye me-1"></i>Review
          </button>
          <button class="btn btn-sm btn-success me-1" title="Approve and Update Data" onclick="approveEditRequest(${req.id}, '${escapeHtml(req.pid)}')">
            <i class="bi bi-check-circle me-1"></i>Approve
          </button>
          <button class="btn btn-sm btn-outline-secondary" title="Reject Request" onclick="rejectEditRequest(${req.id}, '${escapeHtml(req.pid)}')">
            <i class="bi bi-x-circle me-1"></i>Reject
          </button>
        `;
      } else {
        actionCol = `
          <button class="btn btn-sm btn-outline-info me-1" title="View Comparison" onclick="viewEditRequestComparison('${reqJson}')"><i class="bi bi-eye me-1"></i>View</button>
          <span class="small text-muted"><i class="bi bi-person-check me-1"></i>${escapeHtml(req.status)} by <strong>${escapeHtml(req.actionBy || 'Admin')}</strong></span>
        `;
      }
    } else if (req.requestType === 'List Add') {
      typeBadge = '<span class="badge bg-success"><i class="bi bi-plus-circle me-1"></i>List Add</span>';
      targetDisplay = '<span class="text-muted small">Dropdown List</span>';
      nameDisplay = `<span class="fw-semibold text-primary"><i class="bi bi-tag-fill me-1"></i>${escapeHtml(req.optionValue)}</span>`;

      if (req.status === 'Pending') {
        actionCol = `
          <button class="btn btn-sm btn-success me-1" title="Approve & Add Option" onclick="approveListAddRequest(${req.id}, '${escapeHtml(req.optionValue)}')">
            <i class="bi bi-check-circle me-1"></i>Add Option
          </button>
          <button class="btn btn-sm btn-outline-secondary" title="Reject Request" onclick="rejectListAddRequest(${req.id}, '${escapeHtml(req.optionValue)}')">
            <i class="bi bi-x-circle me-1"></i>Reject
          </button>
        `;
      } else {
        actionCol = `<span class="small text-muted"><i class="bi bi-person-check me-1"></i>${escapeHtml(req.status)} by <strong>${escapeHtml(req.actionBy || 'Admin')}</strong></span>`;
      }
    }

    html += `
      <tr>
        <td>${typeBadge}</td>
        <td>${targetDisplay}</td>
        <td class="fw-semibold">${nameDisplay}</td>
        <td><span class="badge bg-light text-dark border">${escapeHtml(req.requestedBy)}</span></td>
        <td><span class="small text-dark fw-semibold text-truncate d-inline-block" style="max-width: 160px;" title="${escapeHtml(req.reason)}">${escapeHtml(req.reason || '-')}</span></td>
        <td class="small text-muted">${escapeHtml(req.requestedDate)} ${escapeHtml(req.requestedTime)}</td>
        <td>${statusBadge}</td>
        <td class="text-end">${actionCol}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

async function approveListAddRequest(requestId, optionValue) {
  document.getElementById('confirmModalTitle').innerText = 'Approve & Add Dropdown Option?';
  document.getElementById('confirmModalMessage').innerText = `Are you sure you want to approve request and add option "${optionValue}" to Remark dropdown list?`;
  const executeBtn = document.getElementById('confirmModalExecuteBtn');
  executeBtn.innerText = 'Yes, Add Option';
  executeBtn.className = 'btn btn-success btn-sm px-3';

  executeBtn.onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Adding option to dropdown list...');
    try {
      const res = await fetch(`/api/list-add-requests/${requestId}/approve`, { method: 'POST' });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('success', 'Approved & Option Added', data.message);
        loadAllRequestsList();
        loadReactiveList();
        loadRemarkOptions();
      } else {
        showToast('danger', 'Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Error', err.message);
    }
  };

  confirmModalInstance.show();
}

async function rejectListAddRequest(requestId, optionValue) {
  document.getElementById('confirmModalTitle').innerText = 'Reject List Add Request?';
  document.getElementById('confirmModalMessage').innerText = `Reject list add request for option "${optionValue}"? Option will NOT be added to dropdown list.`;
  const executeBtn = document.getElementById('confirmModalExecuteBtn');
  executeBtn.innerText = 'Yes, Reject Request';
  executeBtn.className = 'btn btn-secondary btn-sm px-3';

  executeBtn.onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Rejecting request...');
    try {
      const res = await fetch(`/api/list-add-requests/${requestId}/reject`, { method: 'POST' });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('info', 'Request Rejected', data.message);
        loadAllRequestsList();
        loadReactiveList();
      } else {
        showToast('danger', 'Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Error', err.message);
    }
  };

  confirmModalInstance.show();
}

async function loadReactiveList() {
  showLoader('Loading reactive dropdown data...');
  try {
    const res = await fetch('/api/list-add-requests/reactive');
    const data = await res.json();
    hideLoader();

    if (!data.success) {
      showToast('danger', 'Error', data.message);
      return;
    }

    const requests = data.requests || data.data || [];
    const affectedRecords = data.affectedRecords || [];

    // Update badges
    const navBadgeEl = document.getElementById('nav-reactive-list-badge');
    if (navBadgeEl) {
      const totalCount = requests.length + affectedRecords.length;
      navBadgeEl.innerText = totalCount;
      if (totalCount > 0) navBadgeEl.classList.remove('d-none');
      else navBadgeEl.classList.add('d-none');
    }

    const recBadgeEl = document.getElementById('reactive-records-count-badge');
    if (recBadgeEl) recBadgeEl.innerText = affectedRecords.length;

    const reqBadgeEl = document.getElementById('reactive-requests-count-badge');
    if (reqBadgeEl) reqBadgeEl.innerText = requests.length;

    // 1. Render Affected Records Table (Records with Unapproved Remarks)
    const recTbody = document.getElementById('reactive-records-table-body');
    if (recTbody) {
      if (affectedRecords.length === 0) {
        recTbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted"><i class="bi bi-check-circle-fill text-success fs-3 d-block mb-2"></i>No records with unapproved remarks! All records have valid approved remarks.</td></tr>';
      } else {
        let recHtml = '';
        affectedRecords.forEach((rec, idx) => {
          recHtml += `
            <tr>
              <td class="fw-semibold text-muted">${idx + 1}</td>
              <td><span class="fw-bold text-primary">${escapeHtml(rec.pid)}</span></td>
              <td><span class="fw-semibold text-dark">${escapeHtml(rec.name)}</span></td>
              <td>${escapeHtml(rec.father || '-')}</td>
              <td>
                <span class="badge bg-danger bg-opacity-10 text-danger border border-danger fw-semibold"><i class="bi bi-exclamation-triangle me-1"></i>${escapeHtml(rec.remark)}</span>
                <small class="text-muted d-block opacity-75 mt-0.5">Unapproved by Admin</small>
              </td>
              <td><span class="badge bg-light text-dark border">${escapeHtml(rec.requestedBy || '-')}</span></td>
              <td><span class="badge bg-warning text-dark"><i class="bi bi-arrow-counterclockwise me-1"></i>${escapeHtml(rec.optionStatus || 'Pending')}</span></td>
              <td class="text-end">
                <button class="btn btn-sm btn-warning text-dark fw-semibold rounded-2 shadow-sm" onclick="showUpdateRecordRemarkModal(${rec.id}, '${escapeHtml(rec.pid)}', '${escapeHtml(rec.name)}', '${escapeHtml(rec.remark)}')">
                  <i class="bi bi-pencil-square me-1"></i>Update Remark
                </button>
              </td>
            </tr>
          `;
        });
        recTbody.innerHTML = recHtml;
      }
    }

    // 2. Render Dropdown Requests Table
    const reqTbody = document.getElementById('reactive-list-table-body');
    if (reqTbody) {
      if (requests.length === 0) {
        reqTbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted"><i class="bi bi-check-circle-fill text-success fs-3 d-block mb-2"></i>No pending or reactive dropdown requests. All requests are approved!</td></tr>';
      } else {
        const canApprove = currentUserState && (currentUserState.role === 'Admin' || currentUserState.deleteRequestPermission);

        let reqHtml = '';
        requests.forEach((req, idx) => {
          const tempBadge = req.isTempActive
            ? `<span class="badge bg-success bg-opacity-10 text-success border border-success"><i class="bi bi-clock-history me-1"></i>Temp Active (${req.hoursLeft}h left)</span>`
            : `<span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary">Temp Expired</span>`;

          const statusBadge = req.status === 'Rejected'
            ? `<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Rejected</span>`
            : `<span class="badge bg-warning text-dark"><i class="bi bi-arrow-counterclockwise me-1"></i>Reactive / Pending</span>`;

          let actionButtons = '-';
          if (canApprove) {
            actionButtons = `
              <button class="btn btn-sm btn-success fw-semibold rounded-2 me-1 shadow-sm" onclick="approveListAddRequest(${req.id}, '${escapeHtml(req.optionValue)}')">
                <i class="bi bi-check-lg me-1"></i>Approve & Add Permanent
              </button>
              <button class="btn btn-sm btn-outline-secondary rounded-2" onclick="rejectListAddRequest(${req.id}, '${escapeHtml(req.optionValue)}')">
                <i class="bi bi-x-lg me-1"></i>Reject
              </button>
            `;
          } else if (String(req.requestedBy || '').toLowerCase() === String(currentUserState.username || '').toLowerCase()) {
            actionButtons = `
              <button class="btn btn-sm btn-outline-danger rounded-2" onclick="cancelMyListAddRequest(${req.id}, '${escapeHtml(req.optionValue)}')">
                <i class="bi bi-trash me-1"></i>Withdraw
              </button>
            `;
          }

          reqHtml += `
            <tr>
              <td class="fw-semibold text-muted">${idx + 1}</td>
              <td><span class="fw-bold text-dark"><i class="bi bi-tag-fill text-primary me-1"></i>${escapeHtml(req.optionValue)}</span></td>
              <td><span class="fst-italic text-secondary">${escapeHtml(req.reason || '-')}</span></td>
              <td><span class="badge bg-light text-dark border">${escapeHtml(req.requestedBy)}</span></td>
              <td class="small text-muted">${escapeHtml(req.requestedDate)} ${escapeHtml(req.requestedTime || '')}</td>
              <td>${tempBadge}</td>
              <td>${statusBadge}</td>
              <td class="text-end">${actionButtons}</td>
            </tr>
          `;
        });
        reqTbody.innerHTML = reqHtml;
      }
    }

  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', 'Failed to load reactive list data: ' + err.message);
  }
}

function showUpdateRecordRemarkModal(recordId, pid, name, oldRemark) {
  document.getElementById('update-remark-record-id').value = recordId;
  document.getElementById('update-remark-pid').innerText = pid;
  document.getElementById('update-remark-name').innerText = name;
  document.getElementById('update-remark-old').innerText = oldRemark;

  const selectEl = document.getElementById('update-remark-select');
  if (selectEl) {
    let html = '<option value="">-- Select Approved Remark --</option>';
    // Only show valid approved remark options
    currentRemarkOptions.forEach(opt => {
      if (opt && opt.toLowerCase() !== oldRemark.toLowerCase() && opt.toLowerCase() !== 'remark options') {
        html += `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`;
      }
    });
    selectEl.innerHTML = html;
  }

  updateRecordRemarkModalInstance.show();
}

async function handleUpdateRecordRemarkSubmit(event) {
  event.preventDefault();
  const recordId = document.getElementById('update-remark-record-id').value;
  const newRemark = document.getElementById('update-remark-select').value.trim();

  if (!newRemark) {
    showToast('danger', 'Validation Error', 'Please select an approved remark from the list.');
    return;
  }

  updateRecordRemarkModalInstance.hide();
  showLoader('Updating record remark...');

  try {
    const res = await fetch(`/api/records/${recordId}/remark`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remark: newRemark })
    });
    const data = await res.json();
    hideLoader();

    if (data.success) {
      showToast('success', 'Remark Updated', data.message);
      loadReactiveList();
      if (document.getElementById('records-view') && !document.getElementById('records-view').classList.contains('d-none')) {
        triggerFetchRecords();
      }
    } else {
      showToast('danger', 'Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Server Error', err.message);
  }
}


async function cancelMyEditRequest(requestId, pid) {
  document.getElementById('confirmModalTitle').innerText = 'Cancel Your Edit Request?';
  document.getElementById('confirmModalMessage').innerText = `Withdraw your edit request for record PID "${pid}"?`;
  const executeBtn = document.getElementById('confirmModalExecuteBtn');
  executeBtn.innerText = 'Yes, Withdraw Request';
  executeBtn.className = 'btn btn-danger btn-sm px-3';

  executeBtn.onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Canceling request...');
    try {
      const res = await fetch(`/api/edit-requests/${requestId}/cancel`, { method: 'DELETE' });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('success', 'Request Canceled', data.message);
        loadMyRequestsList();
      } else {
        showToast('danger', 'Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Error', err.message);
    }
  };

  confirmModalInstance.show();
}

async function cancelMyDeleteRequest(requestId, pid) {
  document.getElementById('confirmModalTitle').innerText = 'Cancel Your Delete Request?';
  document.getElementById('confirmModalMessage').innerText = `Withdraw your delete request for record PID "${pid}"?`;
  const executeBtn = document.getElementById('confirmModalExecuteBtn');
  executeBtn.innerText = 'Yes, Withdraw Request';
  executeBtn.className = 'btn btn-danger btn-sm px-3';

  executeBtn.onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Canceling request...');
    try {
      const res = await fetch(`/api/delete-requests/${requestId}/cancel`, { method: 'DELETE' });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('success', 'Request Canceled', data.message);
        loadMyRequestsList();
      } else {
        showToast('danger', 'Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Error', err.message);
    }
  };

  confirmModalInstance.show();
}

async function toggleUserStatusServer(userId, enabled) {
  const statusStr = enabled ? 'Active' : 'Inactive';
  try {
    const res = await fetch(`/api/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusStr })
    });
    const data = await res.json();
    if (data.success) {
      showToast('info', 'Status Updated', data.message);
    } else {
      showToast('danger', 'Error', data.message);
      loadUsersList();
    }
  } catch (err) {
    showToast('danger', 'Error', err.message);
  }
}

function showResetPasswordModal(userId, username) {
  document.getElementById('reset-user-id').value = userId;
  document.getElementById('reset-user-name').innerText = username;
  document.getElementById('reset-new-password').value = '';
  resetPasswordModalInstance.show();
}

async function handleResetPasswordSubmit(event) {
  event.preventDefault();
  const userId = document.getElementById('reset-user-id').value;
  const newPassword = document.getElementById('reset-new-password').value;

  showLoader('Resetting password...');
  try {
    const res = await fetch(`/api/users/${userId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });
    const data = await res.json();
    hideLoader();

    if (data.success) {
      resetPasswordModalInstance.hide();
      showToast('success', 'Password Changed', data.message);
    } else {
      showToast('danger', 'Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Server Error', err.message);
  }
}

function confirmDeleteUser(userId, username) {
  document.getElementById('confirmModalTitle').innerText = 'Delete User Account?';
  document.getElementById('confirmModalMessage').innerText = `Are you sure you want to delete user "${username}"?`;

  document.getElementById('confirmModalExecuteBtn').onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Deleting user...');
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('success', 'User Deleted', data.message);
        loadUsersList();
      } else {
        showToast('danger', 'Delete Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Server Error', err.message);
    }
  };

  confirmModalInstance.show();
}

/* Dropdown Options Management Module (Admin Only) */

async function loadDropdownsView() {
  showLoader('Loading remark options...');
  try {
    const res = await fetch('/api/records/remark-options');
    const data = await res.json();
    hideLoader();

    if (data.success) {
      currentRemarkOptions = data.data || [];
      renderDropdownsTable(currentRemarkOptions);
    } else {
      showToast('danger', 'Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

function renderDropdownsTable(options) {
  const tbody = document.getElementById('dropdowns-table-body');
  if (!options || options.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No remark dropdown options found. Click "Add New Remark Option" to create one.</td></tr>';
    return;
  }

  let html = '';
  options.forEach((opt, idx) => {
    html += `
      <tr>
        <td class="fw-bold text-secondary">${idx + 1}</td>
        <td class="fw-semibold text-dark"><i class="bi bi-tag-fill text-primary me-2"></i>${escapeHtml(opt)}</td>
        <td><span class="badge bg-success-subtle-custom text-success border border-success"><i class="bi bi-file-earmark-spreadsheet me-1"></i>Synced (Google Sheet 'DropdownOptions')</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-1" title="Edit Option" onclick="showEditRemarkOptionModal('${escapeHtml(opt)}')"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" title="Delete Option" onclick="confirmDeleteRemarkOption('${escapeHtml(opt)}')"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function showAddRemarkOptionModal() {
  document.getElementById('remarkOptionModalTitle').innerText = 'Add Remark Option';
  document.getElementById('remarkOptionForm').reset();
  document.getElementById('remark-option-mode').value = 'add';
  document.getElementById('remark-option-old-value').value = '';
  remarkOptionModalInstance.show();
}

function showEditRemarkOptionModal(val) {
  document.getElementById('remarkOptionModalTitle').innerText = 'Edit Remark Option';
  document.getElementById('remark-option-mode').value = 'edit';
  document.getElementById('remark-option-old-value').value = val;
  document.getElementById('modal-remark-option-name').value = val;
  remarkOptionModalInstance.show();
}

async function handleRemarkOptionFormSubmit(event) {
  event.preventDefault();
  const mode = document.getElementById('remark-option-mode').value;
  const oldValue = document.getElementById('remark-option-old-value').value;
  const newValue = document.getElementById('modal-remark-option-name').value.trim();

  if (!newValue) {
    showToast('danger', 'Validation Error', 'Option name cannot be empty.');
    return;
  }

  const endpoint = '/api/records/remark-options';
  const method = mode === 'add' ? 'POST' : 'PUT';
  const payload = mode === 'add' ? { optionValue: newValue } : { oldValue: oldValue, newValue: newValue };

  showLoader(mode === 'add' ? 'Adding remark option...' : 'Updating remark option...');
  try {
    const res = await fetch(endpoint, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    hideLoader();

    if (data.success) {
      remarkOptionModalInstance.hide();
      showToast('success', 'Option Saved', data.message);
      loadDropdownsView();
      loadRemarkOptions();
    } else {
      showToast('danger', 'Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Server Error', err.message);
  }
}

function confirmDeleteRemarkOption(val) {
  document.getElementById('confirmModalTitle').innerText = 'Delete Remark Option?';
  document.getElementById('confirmModalMessage').innerText = `Are you sure you want to remove option "${val}" from Google Sheet 'DropdownOptions'?`;
  const executeBtn = document.getElementById('confirmModalExecuteBtn');
  executeBtn.innerText = 'Yes, Delete Option';
  executeBtn.className = 'btn btn-danger btn-sm px-3';

  executeBtn.onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Deleting remark option...');
    try {
      const res = await fetch('/api/records/remark-options', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionValue: val })
      });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showToast('success', 'Option Deleted', data.message);
        loadDropdownsView();
        loadRemarkOptions();
      } else {
        showToast('danger', 'Error', data.message);
      }
    } catch (err) {
      hideLoader();
      showToast('danger', 'Server Error', err.message);
    }
  };

  confirmModalInstance.show();
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
