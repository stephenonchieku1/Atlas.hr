
'use strict';

const API = '';
const $ = id => document.getElementById(id);

// ── Utility helpers ───────
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API error');
  return json.data;
}

const fmt = num => num == null ? '—' : Number(num).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = str => str ? new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const monthName = m => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1];
const badge = (text, cls) => `<span class="badge badge-${cls}">${text}</span>`;
const statusBadge = status => badge(status, status || 'pending');

function workingDays(start, end) {
  if (!start || !end) return 0;
  let count = 0;
  const cur = new Date(start), fin = new Date(end);
  while (cur <= fin) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ── Toast ──────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const iconMap = { success: 'check', error: 'close', warning: 'alert', info: 'clock' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon"><svg width="14" height="14"><use href="#icon-${iconMap[type] || 'clock'}"/></svg></span><span class="toast-msg">${msg}</span>`;
  $('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOut .25s ease forwards';
    setTimeout(() => el.remove(), 250);
  }, 4000);
}

// ── Tab navigation ─────────────────────────────────────────
const tabs = ['dashboard', 'employees', 'org', 'leave', 'payroll'];

function switchTab(name) {
  tabs.forEach(t => {
    $(`tab-${t}`).classList.toggle('active', t === name);
    $(`nav-${t}`).classList.toggle('active', t === name);
    $(`nav-${t}`).setAttribute('aria-current', t === name ? 'page' : 'false');
  });
  const loaders = { dashboard: loadDashboard, employees: loadEmployees, org: loadOrgChart, leave: loadLeave, payroll: loadPayroll };
  loaders[name]?.();
}

tabs.forEach(t => $(`nav-${t}`)?.addEventListener('click', () => switchTab(t)));

// ── DASHBOARD ──────────────────────────────────────────────
async function loadDashboard() {
  $('dashboard-date').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  try {
    const d = await api('/api/dashboard');
    $('stat-active-employees').textContent = d.stats.active_employees;
    $('stat-pending-leave').textContent    = d.stats.pending_leave;
    $('stat-out-today').textContent       = d.stats.out_today;
    const escEl = $('stat-escalated-val') || $('stat-escalated');
    if (escEl) escEl.textContent = d.stats.escalated;

    const bEl = $('leave-badge');
    bEl.textContent = d.stats.pending_leave || '';
    bEl.style.display = d.stats.pending_leave > 0 ? 'inline-block' : 'none';

    $('pending-approvals-list').innerHTML = !d.pending_approvals.length
      ? '<div class="empty-state">No pending approvals</div>'
      : d.pending_approvals.map(r => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${r.employee_name}</div>
            <div class="list-item-sub">
              ${r.leave_type} · ${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}
              · ${r.days_requested} day(s) · <span class="text-muted">${r.department}</span>
            </div>
          </div>
          <div class="list-item-actions">
            <button class="action-btn success" onclick="quickApprove(${r.id})">Approve</button>
            <button class="action-btn danger"  onclick="quickReject(${r.id})">Reject</button>
          </div>
        </div>`).join('');

    $('out-today-list').innerHTML = !d.out_today.length
      ? '<div class="empty-state">Everyone is present today</div>'
      : d.out_today.map(r => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${r.employee_name}</div>
            <div class="list-item-sub">${r.department} · ${r.leave_type} · back ${fmtDate(r.end_date)}</div>
          </div>
          ${statusBadge('approved')}
        </div>`).join('');

    const lp = $('latest-payroll-summary');
    if (d.latest_payroll) {
      const p = d.latest_payroll;
      lp.innerHTML = `
        <div class="summary-block">
          <div class="summary-item"><label>Period</label><span>${monthName(p.period_month)} ${p.period_year}</span></div>
          <div class="summary-item"><label>Status</label><span>${statusBadge(p.status)}</span></div>
          <div class="summary-item"><label>Generated By</label><span>${p.generated_by_name || '—'}</span></div>
          <div class="summary-item"><label>Generated At</label><span>${fmtDate(p.generated_at)}</span></div>
          <div class="summary-item"><label>&nbsp;</label><button class="btn btn-ghost btn-sm" onclick="switchTab('payroll')">View Payroll →</button></div>
        </div>`;
    } else {
      lp.innerHTML = '<div class="empty-state">No payroll runs yet. Generate one in the Payroll tab.</div>';
    }
  } catch (e) {
    toast(`Failed to load dashboard: ${e.message}`, 'error');
  }
}

let _reviewLeaveId = null;

async function quickApprove(leaveId) {
  _reviewLeaveId = leaveId;
  const req = await api(`/api/leave/${leaveId}`);
  $('review-request-summary').innerHTML = `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${req.employee_name} — ${req.leave_type} leave</div>
        <div class="list-item-sub">${fmtDate(req.start_date)} – ${fmtDate(req.end_date)} · ${req.days_requested} day(s)</div>
      </div>
    </div>`;
  $('modal-review-title').textContent = 'Approve Leave Request';
  $('modal-review').style.display = 'flex';
  $('btn-approve-confirm').onclick = () => doApprove(leaveId);
  $('btn-reject-confirm').onclick  = () => doReject(leaveId);
}

async function quickReject(leaveId) {
  await quickApprove(leaveId);
  $('modal-review-title').textContent = 'Approve or Reject Leave';
}

async function doApprove(id) {
  try {
    await api(`/api/leave/${id}/approve`, { method: 'PATCH', body: { reviewer_id: 1 } });
    toast('Leave request approved ✓', 'success');
    $('modal-review').style.display = 'none';
    loadDashboard();
  } catch (e) { toast(e.message, 'error'); }
}

async function doReject(id) {
  try {
    await api(`/api/leave/${id}/reject`, { method: 'PATCH', body: { reviewer_id: 1 } });
    toast('Leave request rejected', 'warning');
    $('modal-review').style.display = 'none';
    loadDashboard();
  } catch (e) { toast(e.message, 'error'); }
}

$('close-modal-review').addEventListener('click', () => $('modal-review').style.display = 'none');
$('btn-refresh-dashboard').addEventListener('click', loadDashboard);
$('btn-run-escalate').addEventListener('click', async () => {
  try {
    const r = await api('/api/leave/escalate');
    toast(r.message, r.escalated_requests.length ? 'warning' : 'success');
    loadDashboard();
  } catch (e) { toast(e.message, 'error'); }
});

// ── EMPLOYEES ──────────────────────────────────────────────
let _allEmployees = [];

async function loadEmployees() {
  const includeInactive = $('toggle-inactive').checked;
  $('employees-table-wrap').innerHTML = '<div class="empty-state"><span class="spinner"></span></div>';
  try {
    _allEmployees = await api(`/api/employees?includeInactive=${includeInactive}`);
    renderEmployeesTable(_allEmployees);
  } catch (e) { toast(e.message, 'error'); }
}

function renderEmployeesTable(emps) {
  const wrap = $('employees-table-wrap');
  if (!emps.length) {
    wrap.innerHTML = '<div class="empty-state">No employees found</div>';
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>Name</th><th>Role</th><th>Department</th><th>Manager</th><th>Start Date</th><th>Salary</th><th>Type</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${emps.map(e => `
          <tr>
            <td><strong>${e.name}</strong></td>
            <td>${e.role}</td>
            <td>${e.department}</td>
            <td>${e.manager_name || '<span style="color:var(--text-muted)">—</span>'}</td>
            <td>${fmtDate(e.start_date)}</td>
            <td>${fmt(e.salary)}</td>
            <td>${statusBadge(e.employment_type)}</td>
            <td>${statusBadge(e.status)}</td>
            <td>
              <button class="action-btn" onclick="openEditEmployee(${e.id})">Edit</button>
              ${e.status === 'active'
                ? `<button class="action-btn danger" onclick="toggleEmpStatus(${e.id},'deactivate')">Deactivate</button>`
                : `<button class="action-btn success" onclick="toggleEmpStatus(${e.id},'reactivate')">Reactivate</button>`
              }
              <button class="action-btn" onclick="viewLeaveBalances(${e.id}, '${e.name}')">Balances</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

$('employee-search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderEmployeesTable(_allEmployees.filter(emp =>
    [emp.name, emp.role, emp.department, emp.manager_name].some(f => f && f.toLowerCase().includes(q))
  ));
});

$('toggle-inactive').addEventListener('change', loadEmployees);

$('btn-add-employee').addEventListener('click', () => {
  $('modal-employee-title').textContent = 'Add Employee';
  $('form-employee').reset();
  $('form-employee').removeAttribute('data-edit-id');
  $('submit-employee-btn').textContent = 'Add Employee';
  populateManagerSelect();
  $('modal-employee').style.display = 'flex';
});

async function openEditEmployee(id) {
  const emp = await api(`/api/employees/${id}`);
  $('modal-employee-title').textContent = 'Edit Employee';
  $('form-employee').setAttribute('data-edit-id', id);
  $('emp-name').value   = emp.name;
  $('emp-email').value  = emp.email;
  $('emp-role').value   = emp.role;
  $('emp-dept').value   = emp.department;
  $('emp-start').value  = emp.start_date;
  $('emp-salary').value = emp.salary;
  $('emp-type').value   = emp.employment_type;
  await populateManagerSelect(id, emp.manager_id);
  $('submit-employee-btn').textContent = 'Save Changes';
  $('modal-employee').style.display = 'flex';
}

async function populateManagerSelect(excludeId = null, selectedId = null) {
  const emps = await api('/api/employees');
  $('emp-manager').innerHTML = '<option value="">— None (top level) —</option>' +
    emps.filter(e => e.id !== excludeId).map(e =>
      `<option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${e.name} (${e.role})</option>`
    ).join('');
}

$('form-employee').addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.salary = Number(data.salary);
  if (data.manager_id === '') data.manager_id = null;
  const editId = e.target.getAttribute('data-edit-id');

  try {
    if (editId) {
      await api(`/api/employees/${editId}`, { method: 'PATCH', body: data });
      toast('Employee updated ✓', 'success');
    } else {
      await api('/api/employees', { method: 'POST', body: data });
      toast('Employee added ✓', 'success');
    }
    $('modal-employee').style.display = 'none';
    loadEmployees();
  } catch (err) { toast(err.message, 'error'); }
});

async function toggleEmpStatus(id, action) {
  try {
    await api(`/api/employees/${id}/${action}`, { method: 'PATCH' });
    toast(action === 'deactivate' ? 'Employee deactivated' : 'Employee reactivated', 'success');
    loadEmployees();
  } catch (e) { toast(e.message, 'error'); }
}

async function viewLeaveBalances(empId, name) {
  try {
    const balances = await api(`/api/leave/balances/${empId}`);
    $('payslips-detail-body').innerHTML = `
      <h3 style="margin-bottom:1rem">Leave Balances — ${name}</h3>
      <table>
        <thead><tr><th>Type</th><th>Year</th><th>Total</th><th>Used</th><th>Pending</th><th>Available</th></tr></thead>
        <tbody>${balances.map(b => `
          <tr>
            <td>${b.leave_type}</td><td>${b.year}</td><td>${b.total_days}</td><td>${b.used_days}</td><td>${b.pending_days}</td>
            <td><strong style="color:var(--green)">${b.total_days - b.used_days - b.pending_days}</strong></td>
          </tr>`).join('')}</tbody>
      </table>`;
    $('modal-payslips-title').textContent = 'Leave Balances';
    $('modal-payslips').style.display = 'flex';
  } catch (e) { toast(e.message, 'error'); }
}

// Modal close handlers
['employee','leave','payroll','payslips'].forEach(name => {
  $(`close-modal-${name}`)?.addEventListener('click', () => $(`modal-${name}`).style.display = 'none');
  $(`cancel-modal-${name}`)?.addEventListener('click', () => $(`modal-${name}`).style.display = 'none');
});

document.querySelectorAll('.modal-backdrop').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.style.display = 'none'; });
});

// ── ORG CHART ──────────────────────────────────────────────
async function loadOrgChart() {
  const container = $('org-chart');
  container.innerHTML = '<div class="empty-state"><span class="spinner"></span></div>';
  try {
    const nodes = await api('/api/employees/org-tree');
    container.innerHTML = renderOrgTreeHTML(nodes);
  } catch (e) { toast(e.message, 'error'); }
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderOrgTreeHTML(employees) {
  if (!employees || employees.length === 0) {
    return `<div class="empty-state">No organization data available</div>`;
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

  return `
    <div class="org-tree-root">
      ${roots.map((root) => buildNodeHtml(root, true)).join('')}
    </div>
  `;
}

// ── LEAVE ──────────────────────────────────────────────────
let _leaveFilter = 'all';

async function loadLeave() {
  $('leave-list').innerHTML = '<div class="empty-state"><span class="spinner"></span></div>';
  try {
    const url = _leaveFilter === 'all' ? '/api/leave' : `/api/leave?status=${_leaveFilter}`;
    const reqs = await api(url);

    const pending = await api('/api/leave?status=pending');
    const pcb = $('pending-count-badge');
    pcb.textContent = pending.length || '';
    pcb.style.display = pending.length ? 'inline' : 'none';

    renderLeaveList(reqs);
  } catch (e) { toast(e.message, 'error'); }
}

function renderLeaveList(reqs) {
  const list = $('leave-list');
  if (!reqs.length) {
    list.innerHTML = '<div class="empty-state">No leave requests found</div>';
    return;
  }
  list.innerHTML = reqs.map(r => `
    <div class="list-item ${r.escalated && r.status==='pending' ? 'escalated-row' : ''}">
      <div class="list-item-main">
        <div class="list-item-title">
          ${r.employee_name}
          ${r.escalated && r.status === 'pending'
            ? `<span class="escalated-chip"><svg width="12" height="12"><use href="#icon-alert"/></svg> Escalated</span>` : ''}
        </div>
        <div class="list-item-sub">
          ${r.leave_type} leave · ${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}
          · <strong>${r.days_requested} day(s)</strong> · ${r.department} · ${r.role}
          ${r.reason ? `· "${r.reason}"` : ''}
          ${r.reviewer_name ? `· Reviewed by ${r.reviewer_name}` : ''}
        </div>
      </div>
      <div class="list-item-actions" style="flex-wrap:wrap;justify-content:flex-end;gap:.35rem">
        ${statusBadge(r.status)}
        ${r.status === 'pending' ? `
          <button class="action-btn success" onclick="reviewLeave(${r.id},'approve')">Approve</button>
          <button class="action-btn danger"  onclick="reviewLeave(${r.id},'reject')">Reject</button>
        ` : ''}
        ${['pending','approved'].includes(r.status) ? `
          <button class="action-btn" onclick="cancelLeave(${r.id})">Cancel</button>
        ` : ''}
      </div>
    </div>`).join('');
}

document.querySelectorAll('.leave-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.leave-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _leaveFilter = btn.dataset.leaveFilter;
    loadLeave();
  });
});

async function reviewLeave(id, action) {
  try {
    await api(`/api/leave/${id}/${action}`, { method: 'PATCH', body: { reviewer_id: 1 } });
    toast(`Leave request ${action}d`, action === 'approve' ? 'success' : 'warning');
    loadLeave();
    loadDashboard();
  } catch (e) { toast(e.message, 'error'); }
}

async function cancelLeave(id) {
  try {
    await api(`/api/leave/${id}/cancel`, { method: 'PATCH' });
    toast('Leave request cancelled', 'info');
    loadLeave();
  } catch (e) { toast(e.message, 'error'); }
}

$('btn-submit-leave').addEventListener('click', async () => {
  await populateLeaveEmployeeSelect();
  $('form-leave').reset();
  $('leave-balance-preview').style.display = 'none';
  $('days-preview').textContent = '—';
  $('modal-leave').style.display = 'flex';
});

async function populateLeaveEmployeeSelect() {
  const emps = await api('/api/employees');
  $('leave-employee').innerHTML = emps.map(e => `<option value="${e.id}">${e.name} (${e.department})</option>`).join('');
}

['leave-start', 'leave-end'].forEach(id => {
  $(id).addEventListener('change', updateDaysPreview);
});

function updateDaysPreview() {
  const s = $('leave-start').value, e = $('leave-end').value;
  if (s && e) {
    const d = workingDays(s, e);
    $('days-preview').textContent = `${d} working day${d !== 1 ? 's' : ''}`;
  }
}

async function updateBalancePreview() {
  const empId = $('leave-employee').value, type = $('leave-type').value;
  if (!empId) return;
  try {
    const balances = await api(`/api/leave/balances/${empId}`);
    const b = balances.find(x => x.leave_type === type && x.year === new Date().getFullYear());
    if (b) {
      const avail = b.total_days - b.used_days - b.pending_days;
      $('leave-balance-preview').style.display = 'flex';
      $('leave-balance-preview').innerHTML = `
        <div class="balance-item"><div class="balance-label">Total</div><div class="balance-value">${b.total_days}d</div></div>
        <div class="balance-item"><div class="balance-label">Used</div><div class="balance-value">${b.used_days}d</div></div>
        <div class="balance-item"><div class="balance-label">Pending</div><div class="balance-value">${b.pending_days}d</div></div>
        <div class="balance-item"><div class="balance-label">Available</div><div class="balance-value balance-avail">${avail}d</div></div>`;
    }
  } catch (_) {}
}

$('leave-employee').addEventListener('change', updateBalancePreview);
$('leave-type').addEventListener('change', updateBalancePreview);

$('form-leave').addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.employee_id = Number(data.employee_id);
  try {
    await api('/api/leave', { method: 'POST', body: data });
    toast('Leave request submitted ✓', 'success');
    $('modal-leave').style.display = 'none';
    loadLeave();
  } catch (err) { toast(err.message, 'error'); }
});

// ── PAYROLL ────────────────────────────────────────────────
async function loadPayroll() {
  const wrap = $('payroll-runs-wrap');
  wrap.innerHTML = '<div class="empty-state"><span class="spinner"></span></div>';
  try {
    const runs = await api('/api/payroll');
    if (!runs.length) {
      wrap.innerHTML = '<div class="empty-state">No payroll runs yet. Click "Generate Payroll" to start.</div>';
      return;
    }
    wrap.innerHTML = `
      <div class="payroll-run-row" style="background:var(--bg-elevated);font-weight:700;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">
        <div>Period</div><div>Employees</div><div>Status</div><div>Generated By</div><div>Actions</div>
      </div>
      ${runs.map(r => `
        <div class="payroll-run-row">
          <div>
            <div class="payroll-period">${monthName(r.period_month)} ${r.period_year}</div>
            <div class="payroll-sub">${fmtDate(r.generated_at)}</div>
          </div>
          <div>${r.employee_count} employees</div>
          <div>${statusBadge(r.status)}</div>
          <div>${r.generated_by_name || '—'}</div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="action-btn" onclick="viewPayslips(${r.id},'${monthName(r.period_month)} ${r.period_year}')">View Payslips</button>
            ${r.status === 'draft' ? `
              <button class="action-btn success" onclick="finalizeRun(${r.id})">Finalize</button>
              <button class="action-btn danger"  onclick="deleteRun(${r.id})">Delete</button>
            ` : ''}
          </div>
        </div>`).join('')}`;
  } catch (e) { toast(e.message, 'error'); }
}

$('btn-gen-payroll').addEventListener('click', () => {
  const now = new Date();
  $('payroll-month').value = now.getMonth() + 1;
  $('payroll-year').value  = now.getFullYear();
  $('modal-payroll').style.display = 'flex';
});

$('form-payroll').addEventListener('submit', async e => {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const data = {
    month: Number(fd.get('month')),
    year:  Number(fd.get('year')),
    notes: fd.get('notes') || null,
    generated_by: 1
  };
  try {
    const result = await api('/api/payroll/generate', { method: 'POST', body: data });
    toast(`Payroll generated: ${result.payslips_generated} payslips ✓`, 'success');
    $('modal-payroll').style.display = 'none';
    loadPayroll();
  } catch (err) { toast(err.message, 'error'); }
});

async function viewPayslips(runId, periodLabel) {
  try {
    const slips = await api(`/api/payroll/${runId}/payslips`);
    $('modal-payslips-title').textContent = `Payslips — ${periodLabel}`;
    $('payslips-detail-body').innerHTML = slips.length
      ? slips.map(s => `
          <div class="payslip-detail">
            <div class="payslip-detail-header">${s.employee_name} · ${s.role} · ${s.department}</div>
            <div class="payslip-detail-grid">
              <div class="payslip-field"><label>Gross Pay</label><span>${fmt(s.gross_pay)}</span></div>
              <div class="payslip-field"><label>Working Days</label><span>${s.working_days_in_period}</span></div>
              <div class="payslip-field"><label>Days Worked</label><span>${s.days_worked}</span></div>
              <div class="payslip-field"><label>Unpaid Leave</label><span>${s.unpaid_leave_days}d (−${fmt(s.unpaid_leave_deduction)})</span></div>
              <div class="payslip-field"><label>Taxable Income</label><span>${fmt(s.taxable_income)}</span></div>
              <div class="payslip-field"><label>Income Tax</label><span>−${fmt(s.income_tax)}</span></div>
              <div class="payslip-field"><label>Social Security</label><span>−${fmt(s.social_security)}</span></div>
              <div class="payslip-field net"><label>Net Pay</label><span>${fmt(s.net_pay)}</span></div>
              ${s.notes ? `<div class="payslip-field" style="grid-column:1/-1"><label>Notes</label><span>${s.notes}</span></div>` : ''}
            </div>
          </div>`).join('')
      : '<div class="empty-state">No payslips found for this run</div>';
    $('modal-payslips').style.display = 'flex';
  } catch (e) { toast(e.message, 'error'); }
}

async function finalizeRun(id) {
  try {
    await api(`/api/payroll/${id}/finalize`, { method: 'PATCH' });
    toast('Payroll run finalized ✓', 'success');
    loadPayroll();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteRun(id) {
  if (!confirm('Delete this draft payroll run? This cannot be undone.')) return;
  try {
    await api(`/api/payroll/${id}`, { method: 'DELETE' });
    toast('Draft payroll run deleted', 'info');
    loadPayroll();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Global functions (called from inline onclick) ──────────
Object.assign(window, {
  quickApprove, quickReject, openEditEmployee, toggleEmpStatus,
  viewLeaveBalances, reviewLeave, cancelLeave, viewPayslips,
  finalizeRun, deleteRun, switchTab
});

// ── Initial load ───────────────────────────────────────────
loadDashboard();
