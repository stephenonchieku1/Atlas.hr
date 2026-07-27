'use strict';

const { getDb } = require('../database/db');

class Employee {
  // ── Queries ──────────────────────────────────────────────
  static findAll({ includeInactive = false } = {}) {
    const db = getDb();
    const where = includeInactive ? '' : `WHERE e.status = 'active'`;
    return db.prepare(`
      SELECT e.*,
             m.name AS manager_name,
             m.role AS manager_role
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.id
      ${where}
      ORDER BY e.department, e.name
    `).all();
  }

  static findById(id) {
    return getDb().prepare(`
      SELECT e.*, m.name AS manager_name, m.role AS manager_role
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.id = ?
    `).get(id);
  }

  static findDirectReports(managerId) {
    return getDb().prepare(`
      SELECT id, name, role, department, status
      FROM employees
      WHERE manager_id = ? AND status = 'active'
    `).all(managerId);
  }

  /** Full org tree as flat list with depth metadata */
  static getOrgTree() {
    const db  = getDb();
    const all = db.prepare(`
      SELECT e.id, e.name, e.role, e.department, e.status, e.manager_id,
             m.name AS manager_name
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.status = 'active'
      ORDER BY e.manager_id NULLS FIRST, e.name
    `).all();

    return all;
  }

  // ── Mutations ────────────────────────────────────────────
  static create(data) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO employees
        (name, email, role, department, manager_id, start_date, salary, employment_type)
      VALUES
        (@name, @email, @role, @department, @manager_id, @start_date, @salary, @employment_type)
    `);
    const result = stmt.run(data);
    const empId  = result.lastInsertRowid;

    // Auto-create leave balances for current year
    Employee._initLeaveBalances(empId, data.employment_type);

    return Employee.findById(empId);
  }

  static update(id, data) {
    const db     = getDb();
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE employees SET ${fields} WHERE id = @id`).run({ ...data, id });
    return Employee.findById(id);
  }

  /** Soft-delete: set status = inactive. Never hard-delete for payroll history. */
  static deactivate(id) {
    getDb().prepare(`UPDATE employees SET status = 'inactive' WHERE id = ?`).run(id);
    return Employee.findById(id);
  }

  static reactivate(id) {
    getDb().prepare(`UPDATE employees SET status = 'active' WHERE id = ?`).run(id);
    return Employee.findById(id);
  }

  static _initLeaveBalances(empId, empType) {
    const db   = getDb();
    const year = new Date().getFullYear();
    const annual = empType === 'part-time' ? 10 : 21;

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO leave_balances
        (employee_id, leave_type, year, total_days, used_days, pending_days)
      VALUES (?, ?, ?, ?, 0, 0)
    `);

    db.transaction(() => {
      stmt.run(empId, 'annual', year, annual);
      stmt.run(empId, 'sick',   year, 10);
      stmt.run(empId, 'unpaid', year, 30);
    })();
  }
}

module.exports = Employee;
