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
    dashboardDate: document.getElementById('dashboard-date'),
    toggleInactive: document.getElementById('toggle-inactive'),
    btnAddEmployee: document.getElementById('btn-add-employee'),
    employeeSearch: document.getElementById('employee-search'),
    employeesTableWrap: document.getElementById('employees-table-wrap'),
    modalEmployee: document.getElementById('modal-employee'),
    formEmployee: document.getElementById('form-employee'),
    closeModalEmployee: document.getElementById('close-modal-employee'),
    cancelModalEmployee: document.getElementById('cancel-modal-employee'),
    modalEmployeeTitle: document.getElementById('modal-employee-title'),
    submitEmployeeBtn: document.getElementById('submit-employee-btn'),
    empManagerSelect: document.getElementById('emp-manager'),
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

  elements.navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  function switchTab(tabName) {
    state.currentTab = tabName;
    elements.navItems.forEach((item) => {
      const isTarget = item.getAttribute('data-tab') === tabName;
      item.classList.toggle('active', isTarget);
    });

    elements.tabSections.forEach((section) => {
      section.classList.toggle('active', section.id === `tab-${tabName}`);
    });

    if (tabName === 'employees') loadEmployeesData();
  }

  // Employees Tab Logic
  async function loadEmployeesData() {
    try {
      const includeInactive = elements.toggleInactive ? elements.toggleInactive.checked : false;
      const data = await apiFetch(`/api/employees${includeInactive ? '?include_inactive=true' : ''}`);
      state.employees = data;
      renderEmployeesTable();
    } catch (e) { console.error(e); }
  }

  function renderEmployeesTable() {
    if (!elements.employeesTableWrap) return;
    const query = elements.employeeSearch ? elements.employeeSearch.value.toLowerCase().trim() : '';
    const filtered = state.employees.filter((emp) => {
      return (
        emp.name.toLowerCase().includes(query) ||
        emp.role.toLowerCase().includes(query) ||
        emp.department.toLowerCase().includes(query)
      );
    });

    if (filtered.length === 0) {
      elements.employeesTableWrap.innerHTML = `<div class="empty-state">No employees found</div>`;
      return;
    }

    elements.employeesTableWrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th><th>Role</th><th>Department</th><th>Manager</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(emp => `
            <tr>
              <td><strong>${emp.name}</strong><br><small style="color:var(--text-muted)">${emp.email}</small></td>
              <td>${emp.role}</td>
              <td>${emp.department}</td>
              <td>${emp.manager_name || '—'}</td>
              <td>${emp.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (elements.btnAddEmployee) {
    elements.btnAddEmployee.addEventListener('click', () => {
      openModal(elements.modalEmployee);
    });
  }
  if (elements.closeModalEmployee) elements.closeModalEmployee.addEventListener('click', () => closeModal(elements.modalEmployee));
  if (elements.cancelModalEmployee) elements.cancelModalEmployee.addEventListener('click', () => closeModal(elements.modalEmployee));
  if (elements.toggleInactive) elements.toggleInactive.addEventListener('change', loadEmployeesData);
  if (elements.employeeSearch) elements.employeeSearch.addEventListener('input', renderEmployeesTable);

  if (elements.dashboardDate) {
    elements.dashboardDate.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }
});
