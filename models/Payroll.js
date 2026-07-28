'use strict';

const { getDb } = require('../database/db');

class Payroll {
  // ── Payroll Runs ─────────────────────────────────────────

  static findAllRuns() {
    const db = getDb();
    return db.prepare(`
      SELECT pr.*,
             e.name AS generated_by_name,
             COUNT(ps.id) AS employee_count
      FROM payroll_runs pr
      LEFT JOIN employees e  ON pr.generated_by = e.id
      LEFT JOIN payslips  ps ON pr.id = ps.payroll_run_id
      GROUP BY pr.id
      ORDER BY pr.period_year DESC, pr.period_month DESC
    `).all();
  }

  static findRunById(id) {
    return getDb().prepare(`
      SELECT pr.*, e.name AS generated_by_name
      FROM payroll_runs pr
      LEFT JOIN employees e ON pr.generated_by = e.id
      WHERE pr.id = ?
    `).get(id);
  }

  static findRunByPeriod(month, year) {
    return getDb().prepare(`
      SELECT * FROM payroll_runs
      WHERE period_month = ? AND period_year = ?
    `).get(month, year);
  }

  static createRun({ month, year, generatedBy, notes }) {
    const db   = getDb();
    const stmt = db.prepare(`
      INSERT INTO payroll_runs (period_month, period_year, generated_by, notes)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(month, year, generatedBy, notes || null);
    return Payroll.findRunById(result.lastInsertRowid);
  }

  static finalizeRun(id) {
    getDb().prepare(`
      UPDATE payroll_runs SET status = 'finalized' WHERE id = ?
    `).run(id);
    return Payroll.findRunById(id);
  }

  static deleteRun(id) {
    // Cascade deletes payslips via FK
    getDb().prepare(`DELETE FROM payroll_runs WHERE id = ? AND status = 'draft'`).run(id);
  }

  // ── Payslips ─────────────────────────────────────────────

  static findSlipsByRun(runId) {
    return getDb().prepare(`
      SELECT ps.*,
             e.name AS employee_name, e.role, e.department,
             e.employment_type, e.salary, e.start_date
      FROM payslips ps
      JOIN employees e ON ps.employee_id = e.id
      WHERE ps.payroll_run_id = ?
      ORDER BY e.department, e.name
    `).all(runId);
  }

  static findSlipsByEmployee(employeeId) {
    return getDb().prepare(`
      SELECT ps.*,
             pr.period_month, pr.period_year, pr.status AS run_status
      FROM payslips ps
      JOIN payroll_runs pr ON ps.payroll_run_id = pr.id
      WHERE ps.employee_id = ?
      ORDER BY pr.period_year DESC, pr.period_month DESC
    `).all(employeeId);
  }

  static insertSlip(data) {
    return getDb().prepare(`
      INSERT OR REPLACE INTO payslips
        (payroll_run_id, employee_id, working_days_in_period, days_worked,
         unpaid_leave_days, gross_pay, unpaid_leave_deduction, taxable_income,
         income_tax, social_security, net_pay, notes)
      VALUES
        (@payroll_run_id, @employee_id, @working_days_in_period, @days_worked,
         @unpaid_leave_days, @gross_pay, @unpaid_leave_deduction, @taxable_income,
         @income_tax, @social_security, @net_pay, @notes)
    `).run(data);
  }
}

module.exports = Payroll;
