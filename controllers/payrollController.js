'use strict';

const Payroll  = require('../models/Payroll');
const Employee = require('../models/Employee');
const Leave    = require('../models/Leave');
const { workingDaysInMonth, workingDaysBetween, countWorkingDays } = require('../utils/dateUtils');

const ok   = (res, data, code = 200) => res.status(code).json({ success: true,  data });
const fail = (res, msg,  code = 400) => res.status(code).json({ success: false, error: msg });

// ── Public endpoints ──────────────────────────────────────

exports.listRuns = (req, res) => {
  try { ok(res, Payroll.findAllRuns()); }
  catch (e) { fail(res, e.message, 500); }
};

exports.getRunById = (req, res) => {
  const run = Payroll.findRunById(Number(req.params.id));
  if (!run) return fail(res, 'Payroll run not found', 404);
  ok(res, run);
};

exports.getSlipsByRun = (req, res) => {
  const run = Payroll.findRunById(Number(req.params.id));
  if (!run) return fail(res, 'Payroll run not found', 404);
  try { ok(res, Payroll.findSlipsByRun(Number(req.params.id))); }
  catch (e) { fail(res, e.message, 500); }
};

exports.getSlipsByEmployee = (req, res) => {
  try { ok(res, Payroll.findSlipsByEmployee(Number(req.params.employeeId))); }
  catch (e) { fail(res, e.message, 500); }
};

// ── Generate payroll run ──────────────────────────────────

exports.generateRun = (req, res) => {
  const { month, year, generated_by } = req.body;
  if (!month || !year) return fail(res, 'month and year are required');

  const m = Number(month);
  const y = Number(year);
  if (m < 1 || m > 12)       return fail(res, 'month must be 1–12');
  if (y < 2000 || y > 2099)  return fail(res, 'Invalid year');

  // Prevent duplicate runs
  if (Payroll.findRunByPeriod(m, y)) {
    return fail(res, `A payroll run for ${y}-${String(m).padStart(2,'0')} already exists. Delete draft first or finalize it.`);
  }

  const workingDays = workingDaysInMonth(m, y);

  // Fetch all active employees at time of run (+ inactive with payslips from prior runs — not needed for new run)
  const employees = Employee.findAll({ includeInactive: false });
  if (!employees.length) return fail(res, 'No active employees found');

  try {
    const run = Payroll.createRun({ month: m, year: y, generatedBy: generated_by || null, notes: req.body.notes });

    const payslips = [];
    const periodStart = `${y}-${String(m).padStart(2,'0')}-01`;
    const lastDay     = new Date(y, m, 0).getDate();
    const periodEnd   = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

    for (const emp of employees) {
      const slip = computePayslip({
        emp, runId: run.id, m, y, workingDays, periodStart, periodEnd
      });
      Payroll.insertSlip(slip);
      payslips.push(slip);
    }

    ok(res, { run, payslips_generated: payslips.length, payslips }, 201);
  } catch (e) {
    fail(res, e.message, 500);
  }
};

exports.finalizeRun = (req, res) => {
  const run = Payroll.findRunById(Number(req.params.id));
  if (!run)                      return fail(res, 'Payroll run not found', 404);
  if (run.status === 'finalized') return fail(res, 'Run is already finalized');
  try { ok(res, Payroll.finalizeRun(run.id)); }
  catch (e) { fail(res, e.message, 500); }
};

exports.deleteRun = (req, res) => {
  const run = Payroll.findRunById(Number(req.params.id));
  if (!run)                  return fail(res, 'Payroll run not found', 404);
  if (run.status === 'finalized') return fail(res, 'Cannot delete a finalized payroll run');
  try {
    Payroll.deleteRun(run.id);
    ok(res, { message: 'Draft payroll run deleted' });
  } catch (e) { fail(res, e.message, 500); }
};

// ── Core payroll math (also exported for unit tests) ─────

/**
 * computePayslip — Exported for direct unit-test use
 * @param {Object} params
 * @returns {Object} payslip row ready to insert
 */
function computePayslip({ emp, runId, m, y, workingDays, periodStart, periodEnd }) {
  let daysWorked    = workingDays;
  const notes       = [];

  // Edge case: mid-month joiner
  const startDate   = emp.start_date; // YYYY-MM-DD
  const empStart    = new Date(startDate);
  const periodMonthStart = new Date(periodStart);

  if (empStart > periodMonthStart) {
    // Employee joined mid-period: count working days from join date to end of month
    daysWorked = workingDaysBetween(startDate, periodEnd);
    notes.push(`Mid-month joiner (${startDate}): ${daysWorked}/${workingDays} working days`);
  }

  // Unpaid leave days during this period
  const unpaidLeaves = Leave.findApprovedInRange(periodStart, periodEnd, null)
    .filter(l => l.employee_id === emp.id);

  // Sum unpaid leave days that overlap with this period
  let unpaidLeaveDays = 0;
  if (unpaidLeaves.length > 0) {
    // Use Leave model data from the DB which stores approved days
    const { getDb } = require('../database/db');
    const db = getDb();
    const rows = db.prepare(`
      SELECT days_requested FROM leave_requests
      WHERE employee_id = ?
        AND leave_type = 'unpaid'
        AND status = 'approved'
        AND start_date <= ?
        AND end_date   >= ?
    `).all(emp.id, periodEnd, periodStart);
    unpaidLeaveDays = rows.reduce((s, r) => s + r.days_requested, 0);
    if (unpaidLeaveDays > 0) notes.push(`Unpaid leave: ${unpaidLeaveDays} day(s) deducted`);
  }

  unpaidLeaveDays = Math.min(unpaidLeaveDays, daysWorked); // can't deduct more than worked

  const dailyRate            = emp.salary / workingDays;
  const gross_pay            = round2(dailyRate * daysWorked);
  const unpaid_leave_ded     = round2(dailyRate * unpaidLeaveDays);
  const taxable_income       = round2(gross_pay - unpaid_leave_ded);

  // Progressive income tax
  const income_tax           = round2(calcTax(taxable_income));

  // Social security: 5% capped at 2,500
  const social_security      = round2(Math.min(gross_pay * 0.05, 2500));

  // Edge case: zero-deduction (taxable ≤ 0)
  const net_pay              = round2(
    gross_pay - unpaid_leave_ded - income_tax - social_security
  );

  if (income_tax === 0)    notes.push('Zero income tax (below threshold)');
  if (daysWorked < workingDays && empStart <= periodMonthStart) {
    // Shouldn't happen but guard anyway
  }

  return {
    payroll_run_id:         runId,
    employee_id:            emp.id,
    working_days_in_period: workingDays,
    days_worked:            daysWorked,
    unpaid_leave_days:      unpaidLeaveDays,
    gross_pay,
    unpaid_leave_deduction: unpaid_leave_ded,
    taxable_income,
    income_tax,
    social_security,
    net_pay,
    notes: notes.length ? notes.join('; ') : null
  };
}

function calcTax(taxable) {
  if (taxable <= 0) return 0;

  let tax = 0;
  const B1 = 20000, B2 = 50000;
  const R1 = 0.10,  R2 = 0.20, R3 = 0.30;

  if (taxable <= B1) {
    tax = taxable * R1;
  } else if (taxable <= B2) {
    tax = B1 * R1 + (taxable - B1) * R2;
  } else {
    tax = B1 * R1 + (B2 - B1) * R2 + (taxable - B2) * R3;
  }

  return tax;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports.computePayslip = computePayslip;
module.exports.calcTax         = calcTax;
module.exports.round2          = round2;
