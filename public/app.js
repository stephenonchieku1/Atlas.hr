/**
 * ATLAS-HR — Single Page Application Client Logic
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // ── APP STATE ─────────────────────────────────────────────────────────────
  const state = {
    currentTab: 'dashboard',
    employees: [],
    leaveRequests: [],
    leaveFilter: 'all',
    payrollRuns: [],
    currentReviewId: null,
    editingEmployeeId: null,
  };

  // ── DOM ELEMENTS ──────────────────────────────────────────────────────────
  const elements = {
    navItems: document.querySelectorAll('.nav-item'),
    tabSections: document.querySelectorAll('.tab-section'),
    leaveBadge: document.getElementById('leave-badge'),

    // Dashboard
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

    // Employees
    toggleInactive: document.getElementById('toggle-inactive'),
    btnAddEmployee: document.getElementById('btn-add-employee'),
    employeeSearch: document.getElementById('employee-search'),
    employeesTableWrap: document.getElementById('employees-table-wrap'),

    // Org Chart
    orgChartWrap: document.getElementById('org-chart'),

    // Leave
    btnSubmitLeave: document.getElementById('btn-submit-leave'),
    leaveTabBtns: document.querySelectorAll('.leave-tab-btn'),
    pendingCountBadge: document.getElementById('pending-count-badge'),
    leaveListWrap: document.getElementById('leave-list'),

    // Payroll
    btnGenPayroll: document.getElementById('btn-gen-payroll'),
    payrollRunsWrap: document.getElementById('payroll-runs-wrap'),

    // Modals
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

  // ── HELPER FUNCTIONS ──────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      padding: 12px 18px; margin-top: 8px; border-radius: 8px;
      background: ${type === 'danger' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
      color: #fff; font-weight: 500; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: opacity 0.3s ease;
    `;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  async function apiFetch(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'An error occurred processing request');
      return data.data;
    } catch (err) {
      showToast(err.message, 'danger');
      throw err;
    }
  }

  function openModal(modal) { if (modal) modal.style.display = 'flex'; }
  function closeModal(modal) { if (modal) modal.style.display = 'none'; }
  function formatCurrency(amount) { return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0); }
  function formatDate(dateStr) { if (!dateStr) return '—'; const d = new Date(dateStr); return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

  function countWorkingDays(startStr, endStr) {
    if (!startStr || !endStr) return 0;
    let count = 0;
    const cur = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(cur.getTime()) || isNaN(end.getTime()) || end < cur) return 0;
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  // ── NAVIGATION & TAB SWITCHING ────────────────────────────────────────────
  elements.navItems.forEach((btn) => {
    btn.addEventListener('click', () => { switchTab(btn.getAttribute('data-tab')); });
  });

  function switchTab(tabName) {
    state.currentTab = tabName;
    elements.navItems.forEach((item) => {
      const isTarget = item.getAttribute('data-tab') === tabName;
      item.classList.toggle('active', isTarget);
      if (isTarget) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });

    elements.tabSections.forEach((section) => {
      section.classList.toggle('active', section.id === `tab-${tabName}`);
    });

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

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  async function loadDashboardData() {
    if (elements.dashboardDate) {
      elements.dashboardDate.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }

    try {
      const data = await apiFetch('/api/dashboard');
      const stats = data.stats || {};

      if (elements.statActiveEmployees) elements.statActiveEmployees.textContent = stats.active_employees ?? '0';
      if (elements.statPendingLeave) elements.statPendingLeave.textContent = stats.pending_leave ?? '0';
      if (elements.statOutToday) elements.statOutToday.textContent = stats.out_today ?? '0';
      if (elements.statEscalatedVal) elements.statEscalatedVal.textContent = stats.escalated ?? '0';

      // Sidebar badge
      if (elements.leaveBadge) {
        if (stats.pending_leave > 0) {
          elements.leaveBadge.style.display = 'inline-block';
          elements.leaveBadge.textContent = stats.pending_leave;
        } else {
          elements.leaveBadge.style.display = 'none';
        }
      }

      // Pending Approvals List
      if (elements.pendingApprovalsList) {
        const pending = data.pending_approvals || [];
        if (pending.length === 0) {
          elements.pendingApprovalsList.innerHTML = `<div class="empty-state">No pending approvals</div>`;
        } else {
          elements.pendingApprovalsList.innerHTML = pending.map((req) => `
            <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid rgba(255,255,255,0.05);">
              <div>
                <strong>${req.employee_name}</strong> <span class="badge badge-info">${req.leave_type}</span>
                <div style="font-size:0.85rem; color:#94a3b8; margin-top:2px;">
                  ${formatDate(req.start_date)} to ${formatDate(req.end_date)} (${req.days_requested} days)
                </div>
              </div>
              <button class="btn btn-sm btn-outline btn-review-req" data-id="${req.id}">Review</button>
            </div>
          `).join('');

          elements.pendingApprovalsList.querySelectorAll('.btn-review-req').forEach((btn) => {
            btn.addEventListener('click', () => openReviewModal(btn.getAttribute('data-id')));
          });
        }
      }

      // Who's Out Today List
      if (elements.outTodayList) {
        const out = data.out_today || [];
        if (out.length === 0) {
          elements.outTodayList.innerHTML = `<div class="empty-state">Everyone is present today</div>`;
        } else {
          elements.outTodayList.innerHTML = out.map((item) => `
            <div class="list-item" style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.05);">
              <strong>${item.employee_name}</strong> (${item.department})
              <div style="font-size:0.85rem; color:#94a3b8;">${item.leave_type} leave until ${formatDate(item.end_date)}</div>
            </div>
          `).join('');
        }
      }

      // Latest Payroll Summary
      if (elements.latestPayrollSummary) {
        const pr = data.latest_payroll;
        if (!pr) {
          elements.latestPayrollSummary.innerHTML = `<div class="empty-state">No payroll runs recorded</div>`;
        } else {
          elements.latestPayrollSummary.innerHTML = `
            <div style="padding:16px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <h3 style="margin:0 0 4px 0;">Period: ${pr.period_month}/${pr.period_year}</h3>
                <p style="color:#94a3b8; font-size:0.9rem; margin:0;">Status: <span class="badge ${pr.status === 'finalized' ? 'badge-success' : 'badge-warning'}">${pr.status}</span> | Generated by ${pr.generated_by_name || 'System'}</p>
              </div>
              <button class="btn btn-sm btn-outline" id="btn-view-latest-payroll" data-id="${pr.id}">View Payslips</button>
            </div>
          `;
          document.getElementById('btn-view-latest-payroll')?.addEventListener('click', (e) => {
            viewPayslips(e.currentTarget.getAttribute('data-id'));
          });
        }
      }

    } catch (e) {
      console.error('Failed loading dashboard data:', e);
    }
  }

  if (elements.btnRefreshDashboard) {
    elements.btnRefreshDashboard.addEventListener('click', () => {
      loadDashboardData();
      showToast('Dashboard refreshed', 'info');
    });
  }

  if (elements.btnRunEscalate) {
    elements.btnRunEscalate.addEventListener('click', async () => {
      try {
        const res = await apiFetch('/api/leave/escalate');
        showToast(res.message, 'success');
        loadDashboardData();
      } catch (e) { console.error(e); }
    });
  }

  // ── EMPLOYEES ─────────────────────────────────────────────────────────────
  async function loadEmployeesData() {
    try {
      const includeInactive = elements.toggleInactive ? elements.toggleInactive.checked : false;
      state.employees = await apiFetch(`/api/employees?includeInactive=${includeInactive}`);
      renderEmployeesTable();
      populateManagerDropdowns();
    } catch (e) { console.error(e); }
  }

  function renderEmployeesTable() {
    if (!elements.employeesTableWrap) return;
    const query = elements.employeeSearch ? elements.employeeSearch.value.toLowerCase().trim() : '';
    const filtered = state.employees.filter((emp) =>
      emp.name.toLowerCase().includes(query) ||
      emp.role.toLowerCase().includes(query) ||
      emp.department.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      elements.employeesTableWrap.innerHTML = `<div class="empty-state">No employees found</div>`;
      return;
    }

    elements.employeesTableWrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role & Dept</th>
            <th>Employment</th>
            <th>Manager</th>
            <th>Salary</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((e) => `
            <tr>
              <td>
                <strong>${e.name}</strong>
                <div style="font-size:0.8rem; color:#94a3b8;">${e.email}</div>
              </td>
              <td>${e.role}<br><span style="font-size:0.8rem; color:#94a3b8;">${e.department}</span></td>
              <td><span class="badge">${e.employment_type}</span></td>
              <td>${e.manager_name || '—'}</td>
              <td>$${formatCurrency(e.salary)}</td>
              <td><span class="badge ${e.status === 'active' ? 'badge-success' : 'badge-danger'}">${e.status}</span></td>
              <td>
                <button class="btn btn-sm btn-ghost btn-edit-emp" data-id="${e.id}">Edit</button>
                ${e.status === 'active'
                  ? `<button class="btn btn-sm btn-danger btn-toggle-emp" data-id="${e.id}" data-action="deactivate">Deactivate</button>`
                  : `<button class="btn btn-sm btn-success btn-toggle-emp" data-id="${e.id}" data-action="reactivate">Reactivate</button>`
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    elements.employeesTableWrap.querySelectorAll('.btn-edit-emp').forEach((btn) => {
      btn.addEventListener('click', () => editEmployee(btn.getAttribute('data-id')));
    });

    elements.employeesTableWrap.querySelectorAll('.btn-toggle-emp').forEach((btn) => {
      btn.addEventListener('click', () => toggleEmployeeStatus(btn.getAttribute('data-id'), btn.getAttribute('data-action')));
    });
  }

  if (elements.employeeSearch) elements.employeeSearch.addEventListener('input', renderEmployeesTable);
  if (elements.toggleInactive) elements.toggleInactive.addEventListener('change', loadEmployeesData);

  function populateManagerDropdowns() {
    const activeEmps = state.employees.filter((e) => e.status === 'active');
    if (elements.empManagerSelect) {
      elements.empManagerSelect.innerHTML = `<option value="">— None (top level) —</option>` +
        activeEmps.map((e) => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');
    }
    if (elements.leaveEmployeeSelect) {
      elements.leaveEmployeeSelect.innerHTML = activeEmps.map((e) => `<option value="${e.id}">${e.name} — ${e.department}</option>`).join('');
    }
  }

  if (elements.btnAddEmployee) {
    elements.btnAddEmployee.addEventListener('click', () => {
      state.editingEmployeeId = null;
      if (elements.modalEmployeeTitle) elements.modalEmployeeTitle.textContent = 'Add Employee';
      if (elements.submitEmployeeBtn) elements.submitEmployeeBtn.textContent = 'Add Employee';
      if (elements.formEmployee) elements.formEmployee.reset();
      openModal(elements.modalEmployee);
    });
  }

  function editEmployee(id) {
    const emp = state.employees.find((e) => e.id === Number(id));
    if (!emp || !elements.formEmployee) return;
    state.editingEmployeeId = emp.id;
    if (elements.modalEmployeeTitle) elements.modalEmployeeTitle.textContent = 'Edit Employee';
    if (elements.submitEmployeeBtn) elements.submitEmployeeBtn.textContent = 'Save Changes';

    elements.formEmployee.elements['name'].value = emp.name;
    elements.formEmployee.elements['email'].value = emp.email;
    elements.formEmployee.elements['role'].value = emp.role;
    elements.formEmployee.elements['department'].value = emp.department;
    elements.formEmployee.elements['manager_id'].value = emp.manager_id || '';
    elements.formEmployee.elements['start_date'].value = emp.start_date;
    elements.formEmployee.elements['salary'].value = emp.salary;
    elements.formEmployee.elements['employment_type'].value = emp.employment_type;

    openModal(elements.modalEmployee);
  }

  if (elements.formEmployee) {
    elements.formEmployee.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(elements.formEmployee);
      const payload = Object.fromEntries(formData.entries());

      try {
        if (state.editingEmployeeId) {
          await apiFetch(`/api/employees/${state.editingEmployeeId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
          showToast('Employee updated successfully', 'success');
        } else {
          await apiFetch('/api/employees', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          showToast('Employee created successfully', 'success');
        }
        closeModal(elements.modalEmployee);
        loadEmployeesData();
      } catch (err) { console.error(err); }
    });
  }

  async function toggleEmployeeStatus(id, action) {
    try {
      await apiFetch(`/api/employees/${id}/${action}`, { method: 'PATCH' });
      showToast(`Employee ${action}d successfully`, 'success');
      loadEmployeesData();
    } catch (e) { console.error(e); }
  }

  // ── ORG CHART ─────────────────────────────────────────────────────────────
  async function loadOrgTreeData() {
    try {
      const data = await apiFetch('/api/employees/org-tree');
      renderOrgTree(data);
    } catch (e) { console.error(e); }
  }

  function renderOrgTree(employees) {
    if (!elements.orgChartWrap) return;
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

    function buildNodeHtml(node) {
      return `
        <div class="org-node" style="margin:8px 0 8px 24px; border-left:2px solid rgba(255,255,255,0.1); padding-left:12px;">
          <div style="background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:8px; display:inline-block; min-width:220px;">
            <strong>${node.name}</strong>
            <div style="font-size:0.8rem; color:#38bdf8;">${node.role}</div>
            <div style="font-size:0.75rem; color:#94a3b8;">${node.department}</div>
          </div>
          ${node.children.length > 0 ? `<div class="org-children">${node.children.map(buildNodeHtml).join('')}</div>` : ''}
        </div>
      `;
    }

    elements.orgChartWrap.innerHTML = `<div class="org-tree-root">${roots.map(buildNodeHtml).join('')}</div>`;
  }

  // ── LEAVE MANAGEMENT ──────────────────────────────────────────────────────
  async function loadLeaveData() {
    try {
      const query = state.leaveFilter === 'all' ? '' : `?status=${state.leaveFilter}`;
      state.leaveRequests = await apiFetch(`/api/leave${query}`);

      const pendingRes = await apiFetch('/api/leave/pending');
      if (elements.pendingCountBadge) elements.pendingCountBadge.textContent = pendingRes.length || 0;

      renderLeaveList();
    } catch (e) { console.error(e); }
  }

  function renderLeaveList() {
    if (!elements.leaveListWrap) return;
    if (!state.leaveRequests || state.leaveRequests.length === 0) {
      elements.leaveListWrap.innerHTML = `<div class="empty-state">No leave requests found</div>`;
      return;
    }

    elements.leaveListWrap.innerHTML = state.leaveRequests.map((r) => {
      let badgeClass = 'badge-info';
      if (r.status === 'approved') badgeClass = 'badge-success';
      if (r.status === 'rejected') badgeClass = 'badge-danger';
      if (r.status === 'cancelled') badgeClass = 'badge-secondary';

      return `
        <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; padding:14px; border-bottom:1px solid rgba(255,255,255,0.05);">
          <div>
            <strong>${r.employee_name}</strong>
            <span class="badge ${badgeClass}">${r.status}</span>
            <span class="badge">${r.leave_type}</span>
            ${r.escalated ? `<span class="badge badge-danger">ESCALATED</span>` : ''}
            <div style="font-size:0.85rem; color:#94a3b8; margin-top:4px;">
              Period: ${formatDate(r.start_date)} to ${formatDate(r.end_date)} (${r.days_requested} working day${r.days_requested > 1 ? 's' : ''})
              ${r.reason ? `<br><em>Reason: ${r.reason}</em>` : ''}
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            ${r.status === 'pending'
              ? `<button class="btn btn-sm btn-primary btn-review-leave" data-id="${r.id}">Review</button>`
              : ''
            }
            ${['pending', 'approved'].includes(r.status)
              ? `<button class="btn btn-sm btn-outline btn-cancel-leave" data-id="${r.id}">Cancel</button>`
              : ''
            }
          </div>
        </div>
      `;
    }).join('');

    elements.leaveListWrap.querySelectorAll('.btn-review-leave').forEach((btn) => {
      btn.addEventListener('click', () => openReviewModal(btn.getAttribute('data-id')));
    });

    elements.leaveListWrap.querySelectorAll('.btn-cancel-leave').forEach((btn) => {
      btn.addEventListener('click', () => cancelLeaveRequest(btn.getAttribute('data-id')));
    });
  }

  elements.leaveTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      elements.leaveTabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.leaveFilter = btn.getAttribute('data-leave-filter');
      loadLeaveData();
    });
  });

  if (elements.btnSubmitLeave) {
    elements.btnSubmitLeave.addEventListener('click', () => {
      if (elements.formLeave) elements.formLeave.reset();
      if (elements.daysPreview) elements.daysPreview.textContent = '—';
      if (elements.leaveBalancePreview) elements.leaveBalancePreview.style.display = 'none';
      openModal(elements.modalLeave);
      updateLeaveBalancePreview();
    });
  }

  async function updateLeaveBalancePreview() {
    if (!elements.leaveEmployeeSelect || !elements.leaveBalancePreview) return;
    const empId = elements.leaveEmployeeSelect.value;
    if (!empId) return;
    try {
      const balances = await apiFetch(`/api/leave/balances/${empId}`);
      if (balances && balances.length > 0) {
        elements.leaveBalancePreview.style.display = 'block';
        elements.leaveBalancePreview.innerHTML = `
          <div style="font-size:0.85rem; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; margin-bottom:12px;">
            <strong>Leave Balances (Current Year):</strong><br>
            ${balances.map((b) =>
              `${b.leave_type}: ${b.total_days - b.used_days - b.pending_days} available (${b.used_days} used, ${b.pending_days} pending)`
            ).join(' | ')}
          </div>
        `;
      }
    } catch (e) { console.error(e); }
  }

  if (elements.leaveEmployeeSelect) elements.leaveEmployeeSelect.addEventListener('change', updateLeaveBalancePreview);

  function updateDaysPreview() {
    if (!elements.leaveStartInput || !elements.leaveEndInput || !elements.daysPreview) return;
    const start = elements.leaveStartInput.value;
    const end = elements.leaveEndInput.value;
    const count = countWorkingDays(start, end);
    elements.daysPreview.textContent = count > 0 ? `${count} working day(s)` : 'Invalid range';
  }

  if (elements.leaveStartInput) elements.leaveStartInput.addEventListener('change', updateDaysPreview);
  if (elements.leaveEndInput) elements.leaveEndInput.addEventListener('change', updateDaysPreview);

  if (elements.formLeave) {
    elements.formLeave.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(elements.formLeave);
      const payload = Object.fromEntries(formData.entries());

      try {
        await apiFetch('/api/leave', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Leave request submitted successfully', 'success');
        closeModal(elements.modalLeave);
        loadLeaveData();
      } catch (err) { console.error(err); }
    });
  }

  async function cancelLeaveRequest(id) {
    try {
      await apiFetch(`/api/leave/${id}/cancel`, { method: 'PATCH' });
      showToast('Leave request cancelled', 'success');
      loadLeaveData();
    } catch (e) { console.error(e); }
  }

  // ── REVIEW MODAL ──────────────────────────────────────────────────────────
  async function openReviewModal(id) {
    state.currentReviewId = Number(id);
    try {
      const req = await apiFetch(`/api/leave/${id}`);
      if (elements.reviewRequestSummary) {
        elements.reviewRequestSummary.innerHTML = `
          <div style="margin-bottom:16px;">
            <p><strong>Employee:</strong> ${req.employee_name} (${req.department})</p>
            <p><strong>Leave Type:</strong> ${req.leave_type}</p>
            <p><strong>Dates:</strong> ${formatDate(req.start_date)} to ${formatDate(req.end_date)}</p>
            <p><strong>Days Requested:</strong> ${req.days_requested}</p>
            ${req.reason ? `<p><strong>Reason:</strong> ${req.reason}</p>` : ''}
          </div>
        `;
      }
      openModal(elements.modalReview);
    } catch (e) { console.error(e); }
  }

  if (elements.btnApproveConfirm) {
    elements.btnApproveConfirm.addEventListener('click', async () => {
      if (!state.currentReviewId) return;
      try {
        await apiFetch(`/api/leave/${state.currentReviewId}/approve`, {
          method: 'PATCH',
          body: JSON.stringify({ reviewer_id: 1 }), // Default reviewer: Alice Mwangi (CEO)
        });
        showToast('Leave request approved', 'success');
        closeModal(elements.modalReview);
        loadTabData(state.currentTab);
      } catch (e) { console.error(e); }
    });
  }

  if (elements.btnRejectConfirm) {
    elements.btnRejectConfirm.addEventListener('click', async () => {
      if (!state.currentReviewId) return;
      const reason = prompt('Enter rejection reason (optional):');
      try {
        await apiFetch(`/api/leave/${state.currentReviewId}/reject`, {
          method: 'PATCH',
          body: JSON.stringify({ reviewer_id: 1, reason }),
        });
        showToast('Leave request rejected', 'success');
        closeModal(elements.modalReview);
        loadTabData(state.currentTab);
      } catch (e) { console.error(e); }
    });
  }

  // ── PAYROLL ───────────────────────────────────────────────────────────────
  async function loadPayrollData() {
    try {
      state.payrollRuns = await apiFetch('/api/payroll');
      renderPayrollRunsTable();
    } catch (e) { console.error(e); }
  }

  function renderPayrollRunsTable() {
    if (!elements.payrollRunsWrap) return;
    if (!state.payrollRuns || state.payrollRuns.length === 0) {
      elements.payrollRunsWrap.innerHTML = `<div class="empty-state">No payroll runs found</div>`;
      return;
    }

    elements.payrollRunsWrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Status</th>
            <th>Generated By</th>
            <th>Employees</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.payrollRuns.map((r) => `
            <tr>
              <td><strong>${r.period_month}/${r.period_year}</strong></td>
              <td><span class="badge ${r.status === 'finalized' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
              <td>${r.generated_by_name || 'System'}</td>
              <td>${r.employee_count}</td>
              <td>${r.notes || '—'}</td>
              <td>
                <button class="btn btn-sm btn-outline btn-view-slips" data-id="${r.id}">View Payslips</button>
                ${r.status === 'draft' ? `
                  <button class="btn btn-sm btn-success btn-finalize-run" data-id="${r.id}">Finalize</button>
                  <button class="btn btn-sm btn-danger btn-delete-run" data-id="${r.id}">Delete</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    elements.payrollRunsWrap.querySelectorAll('.btn-view-slips').forEach((btn) => {
      btn.addEventListener('click', () => viewPayslips(btn.getAttribute('data-id')));
    });

    elements.payrollRunsWrap.querySelectorAll('.btn-finalize-run').forEach((btn) => {
      btn.addEventListener('click', () => finalizePayrollRun(btn.getAttribute('data-id')));
    });

    elements.payrollRunsWrap.querySelectorAll('.btn-delete-run').forEach((btn) => {
      btn.addEventListener('click', () => deletePayrollRun(btn.getAttribute('data-id')));
    });
  }

  if (elements.btnGenPayroll) {
    elements.btnGenPayroll.addEventListener('click', () => {
      if (elements.formPayroll) elements.formPayroll.reset();
      if (elements.payrollYearInput) elements.payrollYearInput.value = new Date().getFullYear();
      openModal(elements.modalPayroll);
    });
  }

  if (elements.formPayroll) {
    elements.formPayroll.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(elements.formPayroll);
      const payload = Object.fromEntries(formData.entries());
      payload.generated_by = 1;

      try {
        await apiFetch('/api/payroll/generate', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Payroll run generated successfully', 'success');
        closeModal(elements.modalPayroll);
        loadPayrollData();
      } catch (err) { console.error(err); }
    });
  }

  async function finalizePayrollRun(id) {
    if (!confirm('Are you sure you want to finalize this payroll run? This action cannot be undone.')) return;
    try {
      await apiFetch(`/api/payroll/${id}/finalize`, { method: 'PATCH' });
      showToast('Payroll run finalized', 'success');
      loadPayrollData();
    } catch (e) { console.error(e); }
  }

  async function deletePayrollRun(id) {
    if (!confirm('Delete this draft payroll run?')) return;
    try {
      await apiFetch(`/api/payroll/${id}`, { method: 'DELETE' });
      showToast('Draft payroll run deleted', 'success');
      loadPayrollData();
    } catch (e) { console.error(e); }
  }

  async function viewPayslips(runId) {
    try {
      const slips = await apiFetch(`/api/payroll/${runId}/payslips`);
      if (!elements.payslipsDetailBody) return;
      if (!slips || slips.length === 0) {
        elements.payslipsDetailBody.innerHTML = `<div class="empty-state">No payslips found for this run</div>`;
      } else {
        elements.payslipsDetailBody.innerHTML = `
          <table class="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Days Worked</th>
                <th>Gross Pay</th>
                <th>Unpaid Deduction</th>
                <th>Taxable</th>
                <th>Tax</th>
                <th>Social Sec</th>
                <th>Net Pay</th>
              </tr>
            </thead>
            <tbody>
              ${slips.map((s) => `
                <tr>
                  <td><strong>${s.employee_name}</strong><br><span style="font-size:0.8rem; color:#94a3b8;">${s.department}</span></td>
                  <td>${s.days_worked} / ${s.working_days_in_period}</td>
                  <td>$${formatCurrency(s.gross_pay)}</td>
                  <td>$${formatCurrency(s.unpaid_leave_deduction)}</td>
                  <td>$${formatCurrency(s.taxable_income)}</td>
                  <td>$${formatCurrency(s.income_tax)}</td>
                  <td>$${formatCurrency(s.social_security)}</td>
                  <td><strong style="color:#10b981;">$${formatCurrency(s.net_pay)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
      openModal(elements.modalPayslips);
    } catch (e) { console.error(e); }
  }

  // ── MODAL CLOSE EVENT HANDLERS ─────────────────────────────────────────────
  if (elements.closeModalEmployee) elements.closeModalEmployee.addEventListener('click', () => closeModal(elements.modalEmployee));
  if (elements.cancelModalEmployee) elements.cancelModalEmployee.addEventListener('click', () => closeModal(elements.modalEmployee));

  if (elements.closeModalLeave) elements.closeModalLeave.addEventListener('click', () => closeModal(elements.modalLeave));
  if (elements.cancelModalLeave) elements.cancelModalLeave.addEventListener('click', () => closeModal(elements.modalLeave));

  if (elements.closeModalPayroll) elements.closeModalPayroll.addEventListener('click', () => closeModal(elements.modalPayroll));
  if (elements.cancelModalPayroll) elements.cancelModalPayroll.addEventListener('click', () => closeModal(elements.modalPayroll));

  if (elements.closeModalPayslips) elements.closeModalPayslips.addEventListener('click', () => closeModal(elements.modalPayslips));
  if (elements.closeModalReview) elements.closeModalReview.addEventListener('click', () => closeModal(elements.modalReview));

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      closeModal(e.target);
    }
  });

  // ── INITIAL BOOT ──────────────────────────────────────────────────────────
  switchTab('dashboard');
});
