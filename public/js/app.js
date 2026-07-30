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
  page: 1,
  pageSize: 25,
  sortColumn: 'createdDate',
  sortDirection: 'desc'
};

let selectedImportFile = null;
let searchDebounceTimer = null;
let currentRemarkOptions = [];
let remarkOptionModalInstance = null;
let rawPendingDeleteRequests = [];
let rawMyDeleteRequests = [];

document.addEventListener('DOMContentLoaded', function () {
  recordModalInstance = new bootstrap.Modal(document.getElementById('recordModal'));
  viewRecordModalInstance = new bootstrap.Modal(document.getElementById('viewRecordModal'));
  confirmModalInstance = new bootstrap.Modal(document.getElementById('confirmModal'));
  userModalInstance = new bootstrap.Modal(document.getElementById('userModal'));
  resetPasswordModalInstance = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
  importDetailsModalInstance = new bootstrap.Modal(document.getElementById('importDetailsModal'));
  remarkOptionModalInstance = new bootstrap.Modal(document.getElementById('remarkOptionModal'));

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

function showLoginScreen() {
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
  navigateToView('dashboard');
}

async function handleLogout() {
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
    const el = document.getElementById('nav-item-delete-requests');
    if (el) el.classList.remove('d-none');
    fetchPendingDeleteRequestsCount();
  } else {
    const el = document.getElementById('nav-item-delete-requests');
    if (el) el.classList.add('d-none');
  }

  if (role === 'View') {
    const el = document.getElementById('nav-item-my-requests');
    if (el) el.classList.add('d-none');
  } else {
    const el = document.getElementById('nav-item-my-requests');
    if (el) el.classList.remove('d-none');
  }

  if (role === 'Admin') {
    document.getElementById('nav-users').classList.remove('d-none');
    const dropNav = document.getElementById('nav-item-dropdowns');
    if (dropNav) dropNav.classList.remove('d-none');
  } else {
    document.getElementById('nav-users').classList.add('d-none');
    const dropNav = document.getElementById('nav-item-dropdowns');
    if (dropNav) dropNav.classList.add('d-none');
  }
}

function navigateToView(viewName) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('d-none'));
  document.querySelectorAll('#sidebar .nav-link').forEach(el => el.classList.remove('active'));

  const titleMap = {
    'dashboard': 'Dashboard Overview',
    'records': 'Data Records & Operations',
    'import': 'Batch Excel / CSV Import',
    'delete-requests': 'Incoming Delete Requests',
    'my-requests': 'My Sent Delete Requests',
    'users': 'Admin User Management',
    'dropdowns': 'Dropdown Options Settings'
  };

  document.getElementById('page-title-display').innerText = titleMap[viewName] || 'Data Portal';

  const targetView = document.getElementById(viewName + '-view');
  const targetNav = document.getElementById('nav-' + viewName);

  if (targetView) targetView.classList.remove('d-none');
  if (targetNav) targetNav.classList.add('active');

  document.getElementById('sidebar').classList.remove('active');

  if (viewName === 'dashboard') {
    loadDashboardData();
  } else if (viewName === 'records') {
    triggerFetchRecords();
  } else if (viewName === 'delete-requests') {
    loadDeleteRequestsList();
  } else if (viewName === 'my-requests') {
    loadMyRequestsList();
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

async function loadDashboardData() {
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
        html += `
          <tr>
            <td class="fw-bold text-primary">${escapeHtml(rec.pid)}</td>
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

async function triggerFetchRecords() {
  searchState.startDate = document.getElementById('filter-start-date').value;
  searchState.endDate = document.getElementById('filter-end-date').value;

  const queryParams = new URLSearchParams({
    query: searchState.query,
    startDate: searchState.startDate,
    endDate: searchState.endDate,
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
      renderRecordsTable(data.data.records);
      renderPagination(data.data.totalRecords, data.data.page, data.data.pageSize);
    } else {
      showToast('danger', 'Fetch Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

function renderRecordsTable(records) {
  currentRecordsData = records || [];
  const tbody = document.getElementById('records-table-body');

  if (!records || records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>No matching records found.</td></tr>';
    return;
  }

  let html = '';
  records.forEach(rec => {
    const recJson = encodeURIComponent(JSON.stringify(rec));
    
    let actionButtons = `<button class="btn btn-sm btn-outline-info me-1" title="View Details" onclick="viewRecordDetails('${recJson}')"><i class="bi bi-eye"></i></button>`;

    if (rec.canEdit) {
      actionButtons += `<button class="btn btn-sm btn-outline-primary me-1" title="Edit Record" onclick="showEditRecordModal('${recJson}')"><i class="bi bi-pencil"></i></button>`;
    }
    if (rec.canDelete) {
      actionButtons += `<button class="btn btn-sm btn-outline-danger" title="Delete Record" onclick="confirmDeleteRecord(${rec.id}, '${escapeHtml(rec.pid)}')"><i class="bi bi-trash"></i></button>`;
    } else if (currentUserState && (currentUserState.role === 'Add' || currentUserState.role === 'Admin')) {
      if (rec.hasPendingDeleteRequest) {
        actionButtons += `<span class="badge bg-warning text-dark me-1" title="Delete Request Pending"><i class="bi bi-clock-history me-1"></i>Requested</span>`;
      } else {
        actionButtons += `<button class="btn btn-sm btn-outline-warning" title="Send Delete Request" onclick="sendDeleteRequest(${rec.id}, '${escapeHtml(rec.pid)}')"><i class="bi bi-send me-1"></i>Request Delete</button>`;
      }
    }

    html += `
      <tr>
        <td class="fw-bold text-primary">${escapeHtml(rec.pid)}</td>
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
  searchState.query = '';
  searchState.startDate = '';
  searchState.endDate = '';
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
    }
  } catch (err) {
    console.error('Error fetching remark options:', err);
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
  recordModalInstance.show();
}

async function handleRecordFormSubmit(event) {
  event.preventDefault();
  const mode = document.getElementById('record-edit-mode').value;
  const recordId = document.getElementById('record-id').value;

  const pid = document.getElementById('modal-record-pid').value.trim();
  const name = document.getElementById('modal-record-name').value.trim();
  const aadharInput = document.getElementById('modal-record-aadhar').value.trim();

  // Validate numeric PID
  if (!/^\d+$/.test(pid)) {
    showToast('danger', 'Validation Error', 'PID must contain numbers only.');
    return;
  }

  if (aadharInput !== '' && aadharInput !== '#N/A') {
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
      triggerFetchRecords();
    } else {
      showToast('danger', 'Validation Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Server Error', err.message);
  }
}

function viewRecordDetails(encodedRecJson) {
  const rec = JSON.parse(decodeURIComponent(encodedRecJson));
  document.getElementById('view-pid').innerText = rec.pid;
  document.getElementById('view-name').innerText = rec.name;
  document.getElementById('view-father').innerText = rec.father || '-';
  document.getElementById('view-ut').innerText = rec.utNo || '-';
  document.getElementById('view-aadhar').innerHTML = formatAadharDisplay(rec.aadharNo);
  document.getElementById('view-date').innerText = rec.date || '-';
  document.getElementById('view-remark').innerText = rec.remark || '-';
  document.getElementById('view-created-by').innerText = rec.createdBy;
  document.getElementById('view-created-at').innerText = rec.createdDate + ' ' + rec.createdTime;
  document.getElementById('view-updated-at').innerText = rec.updatedDate ? rec.updatedDate + ' ' + rec.updatedTime : 'Never updated';

  viewRecordModalInstance.show();
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

async function downloadSampleTemplate() {
  await loadRemarkOptions();
  const options = currentRemarkOptions.length > 0 ? currentRemarkOptions : ['Completed', 'Pending', 'In Progress', 'Verified', 'Rejected', 'Imported', 'Other'];

  const sampleData = [
    {
      "PID": "1001",
      "Name": "Sample User",
      "Father": "Father Name",
      "UT No": "UT-5001",
      "Aadhar No": "123456789012",
      "Date": new Date().toISOString().split('T')[0],
      "Remark": options[0] || "Completed"
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, {
    header: ["PID", "Name", "Father", "UT No", "Aadhar No", "Date", "Remark"]
  });

  // Create a second sheet 'Remark_Options' listing all dynamic dropdown options
  const optionsRows = options.map(opt => ({ "Remark Options": opt }));
  const optionsWorksheet = XLSX.utils.json_to_sheet(optionsRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Template");
  XLSX.utils.book_append_sheet(workbook, optionsWorksheet, "Remark_Options");

  XLSX.writeFile(workbook, "Data_Import_Template.xlsx");
  showToast('success', 'Template Downloaded', 'Sample Excel template downloaded with dropdown Remark Options tab.');
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
          <td class="fw-bold text-primary">${escapeHtml(item.pid)}</td>
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
      html += `
        <tr>
          <td class="fw-bold text-secondary">Row ${item.row}</td>
          <td class="fw-bold text-primary">${escapeHtml(item.pid || '-')}</td>
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
      endDate: searchState.endDate
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
      renderUsersTable(data.data);
    } else {
      showToast('danger', 'Users Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
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

async function sendDeleteRequest(recordId, pid) {
  document.getElementById('confirmModalTitle').innerText = 'Request Data Deletion?';
  document.getElementById('confirmModalMessage').innerText = `Send a delete request to Admin for record PID "${pid}"?`;
  const executeBtn = document.getElementById('confirmModalExecuteBtn');
  executeBtn.innerText = 'Yes, Send Request';
  executeBtn.className = 'btn btn-warning btn-sm px-3';

  executeBtn.onclick = async function () {
    confirmModalInstance.hide();
    showLoader('Sending delete request...');
    try {
      const res = await fetch('/api/delete-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId })
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
  };

  confirmModalInstance.show();
}

async function loadDeleteRequestsList() {
  showLoader('Loading delete requests...');
  try {
    const res = await fetch('/api/delete-requests/pending');
    const data = await res.json();
    hideLoader();

    if (data.success) {
      rawPendingDeleteRequests = data.data || [];
      const searchInput = document.getElementById('search-delete-requests-input');
      if (searchInput) searchInput.value = '';
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
  const inputEl = document.getElementById('search-delete-requests-input');
  const q = (inputEl ? inputEl.value : '').trim().toLowerCase();
  if (!q) {
    renderDeleteRequestsTable(rawPendingDeleteRequests);
    return;
  }

  const filtered = rawPendingDeleteRequests.filter(r => 
    (r.pid || '').toLowerCase().includes(q) || (r.utNo || '').toLowerCase().includes(q)
  );

  renderDeleteRequestsTable(filtered);
}

function renderDeleteRequestsTable(requests) {
  const tbody = document.getElementById('delete-requests-table-body');
  if (!requests || requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted"><i class="bi bi-check-circle fs-3 d-block mb-2 text-success opacity-50"></i>No pending delete requests.</td></tr>';
    return;
  }

  let html = '';
  requests.forEach(req => {
    html += `
      <tr>
        <td class="fw-bold text-primary">${escapeHtml(req.pid)}</td>
        <td class="fw-semibold">${escapeHtml(req.name)}</td>
        <td>${escapeHtml(req.father || '-')}</td>
        <td>${escapeHtml(req.utNo || '-')}</td>
        <td><span class="badge bg-light text-dark border">${escapeHtml(req.requestedBy)}</span></td>
        <td class="small text-muted">${escapeHtml(req.requestedDate)} ${escapeHtml(req.requestedTime)}</td>
        <td><span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>Pending</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-danger me-1" title="Approve and Delete Data" onclick="approveDeleteRequest(${req.id}, '${escapeHtml(req.pid)}')">
            <i class="bi bi-check-circle me-1"></i>Delete Data
          </button>
          <button class="btn btn-sm btn-outline-secondary" title="Cancel Request" onclick="rejectDeleteRequest(${req.id}, '${escapeHtml(req.pid)}')">
            <i class="bi bi-x-circle me-1"></i>Cancel Request
          </button>
        </td>
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

async function loadMyRequestsList() {
  showLoader('Loading your requests...');
  try {
    const res = await fetch('/api/delete-requests/my-requests');
    const data = await res.json();
    hideLoader();

    if (data.success) {
      rawMyDeleteRequests = data.data || [];
      const searchInput = document.getElementById('search-my-requests-input');
      if (searchInput) searchInput.value = '';
      filterMyRequestsTable();
    } else {
      showToast('danger', 'Error', data.message);
    }
  } catch (err) {
    hideLoader();
    showToast('danger', 'Error', err.message);
  }
}

function filterMyRequestsTable() {
  const inputEl = document.getElementById('search-my-requests-input');
  const q = (inputEl ? inputEl.value : '').trim().toLowerCase();
  if (!q) {
    renderMyRequestsTable(rawMyDeleteRequests);
    return;
  }

  const filtered = rawMyDeleteRequests.filter(r => 
    (r.pid || '').toLowerCase().includes(q) || (r.utNo || '').toLowerCase().includes(q)
  );

  renderMyRequestsTable(filtered);
}

function renderMyRequestsTable(requests) {
  const tbody = document.getElementById('my-requests-table-body');
  if (!requests || requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>You have not sent any delete requests.</td></tr>';
    return;
  }

  let html = '';
  requests.forEach(req => {
    const statusBadge = req.status === 'Approved' ? 'bg-success' : req.status === 'Rejected' ? 'bg-secondary' : 'bg-warning text-dark';
    
    let actionCol = '-';
    if (req.status === 'Pending') {
      actionCol = `<button class="btn btn-sm btn-outline-danger" title="Cancel Request" onclick="cancelMyDeleteRequest(${req.id}, '${escapeHtml(req.pid)}')"><i class="bi bi-trash me-1"></i>Cancel Request</button>`;
    }

    html += `
      <tr>
        <td class="fw-bold text-primary">${escapeHtml(req.pid)}</td>
        <td class="fw-semibold">${escapeHtml(req.name)}</td>
        <td>${escapeHtml(req.father || '-')}</td>
        <td>${escapeHtml(req.utNo || '-')}</td>
        <td class="small text-muted">${escapeHtml(req.requestedDate)} ${escapeHtml(req.requestedTime)}</td>
        <td><span class="badge ${statusBadge}">${escapeHtml(req.status)}</span></td>
        <td>${escapeHtml(req.actionBy || '-')}</td>
        <td class="text-end">${actionCol}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
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
