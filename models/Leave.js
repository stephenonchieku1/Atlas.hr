'use strict';

const { getDb } = require('../database/db');

class Leave {
  // ── Queries ──────────────────────────────────────────────

  static findAll({ status, employeeId, departmentTeam } = {}) {
    const db     = getDb();
    const wheres = [`1=1`];
    const params = [];

    if (status)     { wheres.push(`lr.status = ?`);      params.push(status); }
    if (employeeId) { wheres.push(`lr.employee_id = ?`); params.push(employeeId); }

    return db.prepare(`
      SELECT lr.*,
             e.name AS employee_name, e.department, e.role, e.employment_type,
             r.name AS reviewer_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN employees r ON lr.reviewed_by = r.id
      WHERE ${wheres.join(' AND ')}
      ORDER BY lr.created_at DESC
    `).all(...params);
  }

  static findById(id) {
    return getDb().prepare(`
      SELECT lr.*,
             e.name AS employee_name, e.department, e.role, e.manager_id,
             r.name AS reviewer_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN employees r ON lr.reviewed_by = r.id
      WHERE lr.id = ?
    `).get(id);
  }

  static findPending() {
    return getDb().prepare(`
      SELECT lr.*,
             e.name AS employee_name, e.department, e.role, e.manager_id,
             m.name AS manager_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE lr.status = 'pending'
      ORDER BY lr.created_at ASC
    `).all();
  }

  /** Who is out on a given date? */
  static findActiveOnDate(date) {
    return getDb().prepare(`
      SELECT lr.*, e.name AS employee_name, e.department, e.role
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.status = 'approved'
        AND lr.start_date <= ?
        AND lr.end_date   >= ?
      ORDER BY e.department, e.name
    `).all(date, date);
  }

  /** Approved leaves overlapping a date range (for team-coverage check) */
  static findApprovedInRange(startDate, endDate, department) {
    const db = getDb();
    let sql = `
      SELECT lr.employee_id, e.department
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.status = 'approved'
        AND lr.start_date <= ?
        AND lr.end_date   >= ?
    `;
    const params = [endDate, startDate];
    if (department) { sql += ` AND e.department = ?`; params.push(department); }
    return db.prepare(sql).all(...params);
  }

  /** Count active employees in a department */
  static countActiveInDepartment(department) {
    return getDb().prepare(`
      SELECT COUNT(*) AS cnt FROM employees
      WHERE department = ? AND status = 'active'
    `).get(department).cnt;
  }

  /** Check for overlapping leave for the same employee */
  static findOverlap(employeeId, startDate, endDate, excludeId = null) {
    const db = getDb();
    let sql = `
      SELECT id FROM leave_requests
      WHERE employee_id = ?
        AND status NOT IN ('rejected','cancelled')
        AND start_date <= ?
        AND end_date   >= ?
    `;
    const params = [employeeId, endDate, startDate];
    if (excludeId) { sql += ` AND id != ?`; params.push(excludeId); }
    return db.prepare(sql).all(...params);
  }

  /** Leaves still pending older than N hours (for escalation) */
  static findStalePending(olderThanHours = 48) {
    const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000).toISOString();
    return getDb().prepare(`
      SELECT lr.*,
             e.name AS employee_name, e.department, e.manager_id,
             m.name AS manager_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE lr.status = 'pending'
        AND lr.escalated = 0
        AND lr.created_at < ?
    `).all(cutoff);
  }

  static getBalance(employeeId, leaveType, year) {
    return getDb().prepare(`
      SELECT * FROM leave_balances
      WHERE employee_id = ? AND leave_type = ? AND year = ?
    `).get(employeeId, leaveType, year);
  }

  static getBalancesForEmployee(employeeId, year) {
    return getDb().prepare(`
      SELECT * FROM leave_balances
      WHERE employee_id = ? AND year = ?
    `).all(employeeId, year);
  }

  // ── Mutations ────────────────────────────────────────────

  static create(data) {
    const db   = getDb();
    const stmt = db.prepare(`
      INSERT INTO leave_requests
        (employee_id, leave_type, start_date, end_date, days_requested, reason)
      VALUES
        (@employee_id, @leave_type, @start_date, @end_date, @days_requested, @reason)
    `);
    const result = stmt.run(data);

    // Reserve pending days in balance
    db.prepare(`
      UPDATE leave_balances
      SET pending_days = pending_days + ?
      WHERE employee_id = ? AND leave_type = ? AND year = ?
    `).run(data.days_requested, data.employee_id, data.leave_type, new Date().getFullYear());

    return Leave.findById(result.lastInsertRowid);
  }

  static approve(id, reviewerId) {
    const db  = getDb();
    const req = Leave.findById(id);

    db.transaction(() => {
      db.prepare(`
        UPDATE leave_requests
        SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now')
        WHERE id = ?
      `).run(reviewerId, id);

      // Move from pending → used in balance
      db.prepare(`
        UPDATE leave_balances
        SET used_days    = used_days    + ?,
            pending_days = pending_days - ?
        WHERE employee_id = ? AND leave_type = ? AND year = ?
      `).run(req.days_requested, req.days_requested,
             req.employee_id, req.leave_type,
             new Date(req.start_date).getFullYear());
    })();

    return Leave.findById(id);
  }

  static reject(id, reviewerId, reason) {
    const db  = getDb();
    const req = Leave.findById(id);

    db.transaction(() => {
      db.prepare(`
        UPDATE leave_requests
        SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now')
        WHERE id = ?
      `).run(reviewerId, id);

      // Release pending days
      db.prepare(`
        UPDATE leave_balances
        SET pending_days = MAX(0, pending_days - ?)
        WHERE employee_id = ? AND leave_type = ? AND year = ?
      `).run(req.days_requested, req.employee_id, req.leave_type,
             new Date(req.start_date).getFullYear());
    })();

    return Leave.findById(id);
  }

  static cancel(id) {
    const db  = getDb();
    const req = Leave.findById(id);

    db.transaction(() => {
      db.prepare(`
        UPDATE leave_requests SET status = 'cancelled' WHERE id = ?
      `).run(id);

      const col = req.status === 'approved' ? 'used_days' : 'pending_days';
      db.prepare(`
        UPDATE leave_balances
        SET ${col} = MAX(0, ${col} - ?)
        WHERE employee_id = ? AND leave_type = ? AND year = ?
      `).run(req.days_requested, req.employee_id, req.leave_type,
             new Date(req.start_date).getFullYear());
    })();

    return Leave.findById(id);
  }

  static markEscalated(id) {
    getDb().prepare(`
      UPDATE leave_requests
      SET escalated = 1, escalated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }
}

module.exports = Leave;
