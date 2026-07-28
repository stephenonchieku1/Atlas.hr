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
  }

  if (elements.dashboardDate) {
    elements.dashboardDate.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }
});
