/**
 * ATLAS-HR — Single Page Application Client Logic
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const state = {
    currentTab: 'dashboard',
    employees: [],
    leaveRequests: [],
    leaveFilter: 'all',
    payrollRuns: [],
    currentReviewId: null,
    editingEmployeeId: null,
  };

  const elements = {
    navItems: document.querySelectorAll('.nav-item'),
    tabSections: document.querySelectorAll('.tab-section'),
    leaveBadge: document.getElementById('leave-badge'),

    dashboardDate: document.getElementById('dashboard-date'),
    btnRefreshDashboard: document.getElementById('btn-refresh-dashboard'),
    statActiveEmployees: document.getElementById('stat-active-employees'),
    statPendingLeave: document.getElementById('stat-pending-leave'),
    statOutToday: document.getElementById('stat-out-today'),
    statEscalatedVal: document.getElementById('stat-escalated-val'),
    btnRunEscalate: document.getElementById('btn-run-escalate'),
    pendingApprovalsList: document.getElementById('pending-approvals-list'),
    outTodayList: document.getElementById('out-today-list'),
    latestPayrollSummary: document.getElementById('latest-payroll-summary'),

    toggleInactive: document.getElementById('toggle-inactive'),
    btnAddEmployee: document.getElementById('btn-add-employee'),
    employeeSearch: document.getElementById('employee-search'),
    employeesTableWrap: document.getElementById('employees-table-wrap'),

    orgChartWrap: document.getElementById('org-chart'),

    btnSubmitLeave: document.getElementById('btn-submit-leave'),
    leaveTabBtns: document.querySelectorAll('.leave-tab-btn'),
    pendingCountBadge: document.getElementById('pending-count-badge'),
    leaveListWrap: document.getElementById('leave-list'),

    btnGenPayroll: document.getElementById('btn-gen-payroll'),
    payrollRunsWrap: document.getElementById('payroll-runs-wrap'),

    modalEmployee: document.getElementById('modal-employee'),
    formEmployee: document.getElementById('form-employee'),
    closeModalEmployee: document.getElementById('close-modal-employee'),
    cancelModalEmployee: document.getElementById('cancel-modal-employee'),
    modalEmployeeTitle: document.getElementById('modal-employee-title'),
    submitEmployeeBtn: document.getElementById('submit-employee-btn'),
    empManagerSelect: document.getElementById('emp-manager'),

    modalLeave: document.getElementById('modal-leave'),
    formLeave: document.getElementById('form-leave'),
    closeModalLeave: document.getElementById('close-modal-leave'),
    cancelModalLeave: document.getElementById('cancel-modal-leave'),
    leaveEmployeeSelect: document.getElementById('leave-employee'),
    leaveTypeSelect: document.getElementById('leave-type'),
    leaveStartInput: document.getElementById('leave-start'),
    leaveEndInput: document.getElementById('leave-end'),
    daysPreview: document.getElementById('days-preview'),
    leaveBalancePreview: document.getElementById('leave-balance-preview'),

    modalPayroll: document.getElementById('modal-payroll'),
    formPayroll: document.getElementById('form-payroll'),
    closeModalPayroll: document.getElementById('close-modal-payroll'),
    cancelModalPayroll: document.getElementById('cancel-modal-payroll'),
    payrollMonthSelect: document.getElementById('payroll-month'),
    payrollYearInput: document.getElementById('payroll-year'),

    modalPayslips: document.getElementById('modal-payslips'),
    closeModalPayslips: document.getElementById('close-modal-payslips'),
    payslipsDetailBody: document.getElementById('payslips-detail-body'),

    modalReview: document.getElementById('modal-review'),
    closeModalReview: document.getElementById('close-modal-review'),
    reviewRequestSummary: document.getElementById('review-request-summary'),
    btnApproveConfirm: document.getElementById('btn-approve-confirm'),
    btnRejectConfirm: document.getElementById('btn-reject-confirm'),

    toastContainer: document.getElementById('toast-container'),
  };

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      padding: 12px 18px; margin-top: 8px; border-radius: 8px;
      background: ${type === 'danger' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
      color: #fff; font-weight: 500; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4000);
  }

  async function apiFetch(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'An error occurred');
      return data.data;
    } catch (err) {
      showToast(err.message, 'danger');
      throw err;
    }
  }

  function openModal(modal) { if (modal) modal.style.display = 'flex'; }
  function closeModal(modal) { if (modal) modal.style.display = 'none'; }
  function formatDate(dateStr) { if (!dateStr) return '—'; const d = new Date(dateStr); return isNaN(d) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

  elements.navItems.forEach((btn) => {
    btn.addEventListener('click', () => { switchTab(btn.getAttribute('data-tab')); });
  });

  function switchTab(tabName) {
    state.currentTab = tabName;
    elements.navItems.forEach((item) => { item.classList.toggle('active', item.getAttribute('data-tab') === tabName); });
    elements.tabSections.forEach((section) => { section.classList.toggle('active', section.id === `tab-${tabName}`); });
    loadTabData(tabName);
  }

  function loadTabData(tabName) {
    switch (tabName) {
      case 'dashboard': loadDashboardData(); break;
      case 'employees': loadEmployeesData(); break;
      case 'org': loadOrgTreeData(); break;
      case 'leave': loadLeaveData(); break;
      case 'payroll': loadPayrollData(); break;
    }
  }

  // Dashboard
  async function loadDashboardData() {
    if (elements.dashboardDate) {
      elements.dashboardDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    try {
      const stats = await apiFetch('/api/dashboard');
      if (elements.statActiveEmployees) elements.statActiveEmployees.textContent = stats.active_employees;
      if (elements.statPendingLeave) elements.statPendingLeave.textContent = stats.pending_leave;
      if (elements.statOutToday) elements.statOutToday.textContent = stats.out_today;
      if (elements.statEscalatedVal) elements.statEscalatedVal.textContent = stats.escalated_count || 0;
    } catch (e) { console.error(e); }
  }

  // Employees
  async function loadEmployeesData() {
    try {
      const includeInactive = elements.toggleInactive ? elements.toggleInactive.checked : false;
      state.employees = await apiFetch(`/api/employees${includeInactive ? '?include_inactive=true' : ''}`);
      renderEmployeesTable();
    } catch (e) { console.error(e); }
  }

  function renderEmployeesTable() {
    if (!elements.employeesTableWrap) return;
    const query = elements.employeeSearch ? elements.employeeSearch.value.toLowerCase().trim() : '';
    const filtered = state.employees.filter((emp) => emp.name.toLowerCase().includes(query) || emp.role.toLowerCase().includes(query) || emp.department.toLowerCase().includes(query));
    if (filtered.length === 0) { elements.employeesTableWrap.innerHTML = `<div class="empty-state">No employees found</div>`; return; }
    elements.employeesTableWrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Manager</th><th>Status</th></tr></thead>
        <tbody>
          ${filtered.map(emp => `<tr><td><strong>${emp.name}</strong><br><small style="color:var(--text-muted)">${emp.email}</small></td><td>${emp.role}</td><td>${emp.department}</td><td>${emp.manager_name || '—'}</td><td>${emp.status}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  // Org Chart
  async function loadOrgTreeData() {
    try {
      const data = await apiFetch('/api/employees/org-tree');
      renderOrgTree(data);
    } catch (e) { console.error(e); }
  }

  function renderOrgTree(employees) {
    if (!employees || employees.length === 0) {
      elements.orgChartWrap.innerHTML = `<div class="empty-state">No organization data available</div>`;
      return;
    }

    const map = {};
    const roots = [];

    employees.forEach((e) => (map[e.id] = { ...e, children: [] }));
    employees.forEach((e) => {
      if (e.manager_id && map[e.manager_id]) {
        map[e.manager_id].children.push(map[e.id]);
      } else {
        roots.push(map[e.id]);
      }
    });

    function getInitials(name) {
      if (!name) return '??';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function buildNodeHtml(node, isRoot = false) {
      const hasChildren = node.children && node.children.length > 0;
      const initials = getInitials(node.name);

      return `
        <div class="org-node-wrapper${isRoot ? ' is-root-wrapper' : ''}">
          <div class="org-node-card${isRoot ? ' is-root-card' : ''}">
            ${!isRoot ? `
              <div class="org-arrow-indicator" title="Reports to Manager">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 5v14M19 12l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            ` : ''}
            <div class="org-node-header">
              <div class="org-avatar">${initials}</div>
              <div class="org-node-meta">
                <div class="org-node-name">${node.name}</div>
                <div class="org-node-role">${node.role || ''}</div>
              </div>
            </div>
            ${node.department ? `<div class="org-node-dept">${node.department}</div>` : ''}
          </div>

          ${hasChildren ? `
            <div class="org-parent-stem">
              <div class="org-stem-arrow" title="Direct Reports">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <div class="org-children-wrapper">
              ${node.children.map((child) => buildNodeHtml(child, false)).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }

    elements.orgChartWrap.innerHTML = `
      <div class="org-tree-root">
        ${roots.map((root) => buildNodeHtml(root, true)).join('')}
      </div>
    `;
  }

  // Leave Management
  async function loadLeaveData() {
    try {
      const query = state.leaveFilter === 'all' ? '' : `?status=${state.leaveFilter}`;
      state.leaveRequests = await apiFetch(`/api/leave${query}`);
      renderLeaveList();
    } catch (e) { console.error(e); }
  }

  function renderLeaveList() {
    if (!elements.leaveListWrap) return;
    if (state.leaveRequests.length === 0) { elements.leaveListWrap.innerHTML = `<div class="empty-state">No leave requests found</div>`; return; }
    elements.leaveListWrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th></tr></thead>
        <tbody>
          ${state.leaveRequests.map(req => `
            <tr>
              <td><strong>${req.employee_name}</strong></td>
              <td>${req.leave_type}</td>
              <td>${formatDate(req.start_date)} - ${formatDate(req.end_date)}</td>
              <td>${req.working_days}</td>
              <td><span class="badge badge-${req.status}">${req.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Payroll Management
  async function loadPayrollData() {
    try {
      state.payrollRuns = await apiFetch('/api/payroll');
      renderPayrollRuns();
    } catch (e) { console.error(e); }
  }

  function renderPayrollRuns() {
    if (!elements.payrollRunsWrap) return;
    if (state.payrollRuns.length === 0) { elements.payrollRunsWrap.innerHTML = `<div class="empty-state">No payroll runs found</div>`; return; }
    elements.payrollRunsWrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Period</th><th>Status</th><th>Notes</th></tr></thead>
        <tbody>
          ${state.payrollRuns.map(run => `<tr><td><strong>${run.month}/${run.year}</strong></td><td>${run.status}</td><td>${run.notes || '—'}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  if (elements.btnAddEmployee) elements.btnAddEmployee.addEventListener('click', () => openModal(elements.modalEmployee));
  if (elements.btnSubmitLeave) elements.btnSubmitLeave.addEventListener('click', () => openModal(elements.modalLeave));
  if (elements.btnGenPayroll) elements.btnGenPayroll.addEventListener('click', () => openModal(elements.modalPayroll));
  if (elements.closeModalEmployee) elements.closeModalEmployee.addEventListener('click', () => closeModal(elements.modalEmployee));
  if (elements.closeModalLeave) elements.closeModalLeave.addEventListener('click', () => closeModal(elements.modalLeave));
  if (elements.closeModalPayroll) elements.closeModalPayroll.addEventListener('click', () => closeModal(elements.modalPayroll));
  if (elements.closeModalPayslips) elements.closeModalPayslips.addEventListener('click', () => closeModal(elements.modalPayslips));
  if (elements.closeModalReview) elements.closeModalReview.addEventListener('click', () => closeModal(elements.modalReview));
  if (elements.toggleInactive) elements.toggleInactive.addEventListener('change', loadEmployeesData);
  if (elements.employeeSearch) elements.employeeSearch.addEventListener('input', renderEmployeesTable);
});
