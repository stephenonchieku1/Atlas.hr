'use strict';
/**
 * employee.test.js — Unit tests for employee validation & helper functions
 */

function validateEmployeeInput(data) {
  const missing = ['name', 'email', 'role', 'department', 'start_date', 'salary', 'employment_type']
    .filter(f => !data[f]);
  if (missing.length) return { ok: false, error: `Missing required fields: ${missing.join(', ')}` };

  if (!['full-time', 'part-time', 'contract'].includes(data.employment_type)) {
    return { ok: false, error: 'employment_type must be full-time | part-time | contract' };
  }

  if (isNaN(Number(data.salary)) || Number(data.salary) <= 0) {
    return { ok: false, error: 'salary must be positive number' };
  }

  return { ok: true };
}

function calculateLeaveAllocation(employmentType) {
  const annual = employmentType === 'part-time' ? 10 : 21;
  const sick = 10;
  const unpaid = 30;
  return { annual, sick, unpaid };
}

function buildOrgHierarchy(flatEmployees) {
  const map = {};
  const roots = [];

  flatEmployees.forEach(e => {
    map[e.id] = { ...e, children: [] };
  });

  flatEmployees.forEach(e => {
    if (e.manager_id && map[e.manager_id]) {
      map[e.manager_id].children.push(map[e.id]);
    } else {
      roots.push(map[e.id]);
    }
  });

  return roots;
}

describe('Employee Validation & Business Rules', () => {
  test('validates required fields correctly', () => {
    const invalid = { name: 'Jane Doe', email: 'jane@example.com' };
    const res = validateEmployeeInput(invalid);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Missing required fields');
  });

  test('validates employment type restrictions', () => {
    const invalidType = {
      name: 'Jane Doe', email: 'jane@example.com', role: 'Engineer',
      department: 'Engineering', start_date: '2026-01-01', salary: 50000,
      employment_type: 'freelance'
    };
    const res = validateEmployeeInput(invalidType);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('employment_type must be full-time | part-time | contract');
  });

  test('passes with valid full-time employee payload', () => {
    const valid = {
      name: 'Jane Doe', email: 'jane@example.com', role: 'Engineer',
      department: 'Engineering', start_date: '2026-01-01', salary: 75000,
      employment_type: 'full-time'
    };
    const res = validateEmployeeInput(valid);
    expect(res.ok).toBe(true);
  });

  test('allocates 21 annual leave days for full-time employees', () => {
    const alloc = calculateLeaveAllocation('full-time');
    expect(alloc.annual).toBe(21);
    expect(alloc.sick).toBe(10);
    expect(alloc.unpaid).toBe(30);
  });

  test('allocates 10 annual leave days for part-time employees', () => {
    const alloc = calculateLeaveAllocation('part-time');
    expect(alloc.annual).toBe(10);
  });

  test('builds nested org hierarchy tree from flat employee array', () => {
    const employees = [
      { id: 1, name: 'CEO', manager_id: null },
      { id: 2, name: 'Lead', manager_id: 1 },
      { id: 3, name: 'Dev', manager_id: 2 }
    ];

    const tree = buildOrgHierarchy(employees);
    expect(tree.length).toBe(1);
    expect(tree[0].name).toBe('CEO');
    expect(tree[0].children.length).toBe(1);
    expect(tree[0].children[0].name).toBe('Lead');
    expect(tree[0].children[0].children[0].name).toBe('Dev');
  });
});
