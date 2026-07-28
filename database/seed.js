'use strict';
/**
 * seed.js — Idempotent sample data loader
 * Run: node database/seed.js
 */
const { getDb } = require('./db');

const db = getDb();

function seed() {
  const insertEmp = db.prepare(`
    INSERT OR IGNORE INTO employees
      (id, name, email, role, department, manager_id, start_date, salary, employment_type, status)
    VALUES
      (@id, @name, @email, @role, @department, @manager_id, @start_date, @salary, @employment_type, @status)
  `);

  const employees = [
    { id: 1,  name: 'Alice Mwangi',    email: 'alice@hrco.dev',    role: 'CEO',               department: 'Executive',    manager_id: null, start_date: '2020-01-15', salary: 150000, employment_type: 'full-time', status: 'active' },
    { id: 2,  name: 'Brian Odhiambo',  email: 'brian@hrco.dev',    role: 'Head of HR',        department: 'HR',           manager_id: 1,    start_date: '2020-03-01', salary: 95000,  employment_type: 'full-time', status: 'active' },
    { id: 3,  name: 'Carol Wanjiku',   email: 'carol@hrco.dev',    role: 'Head of Finance',   department: 'Finance',      manager_id: 1,    start_date: '2020-06-01', salary: 100000, employment_type: 'full-time', status: 'active' },
    { id: 4,  name: 'David Kimani',    email: 'david@hrco.dev',    role: 'Senior Engineer',   department: 'Engineering',  manager_id: 5,    start_date: '2021-02-15', salary: 85000,  employment_type: 'full-time', status: 'active' },
    { id: 5,  name: 'Esther Ndung\'u', email: 'esther@hrco.dev',   role: 'Engineering Lead',  department: 'Engineering',  manager_id: 1,    start_date: '2020-09-01', salary: 110000, employment_type: 'full-time', status: 'active' },
    { id: 6,  name: 'Frank Otieno',    email: 'frank@hrco.dev',    role: 'Junior Engineer',   department: 'Engineering',  manager_id: 5,    start_date: '2022-04-01', salary: 55000,  employment_type: 'full-time', status: 'active' },
    { id: 7,  name: 'Grace Achieng',   email: 'grace@hrco.dev',    role: 'HR Specialist',     department: 'HR',           manager_id: 2,    start_date: '2021-07-15', salary: 60000,  employment_type: 'full-time', status: 'active' },
    { id: 8,  name: 'Henry Muthoni',   email: 'henry@hrco.dev',    role: 'Accountant',        department: 'Finance',      manager_id: 3,    start_date: '2022-01-10', salary: 65000,  employment_type: 'full-time', status: 'active' },
    { id: 9,  name: 'Irene Kamau',     email: 'irene@hrco.dev',    role: 'Part-time Designer',department: 'Engineering',  manager_id: 5,    start_date: '2023-03-01', salary: 35000,  employment_type: 'part-time', status: 'active' },
    { id: 10, name: 'James Njoroge',   email: 'james@hrco.dev',    role: 'Sales Lead',        department: 'Sales',        manager_id: 1,    start_date: '2026-07-15', salary: 75000,  employment_type: 'full-time', status: 'active' },
    { id: 11, name: 'Karen Chebet',    email: 'karen@hrco.dev',    role: 'Sales Rep',         department: 'Sales',        manager_id: 10,   start_date: '2021-11-01', salary: 50000,  employment_type: 'full-time', status: 'inactive' },
  ];

  // Temporarily disable FK checks — employees reference managers not yet inserted
  db.exec('PRAGMA foreign_keys = OFF');

  const seedEmployees = db.transaction(() => {
    for (const e of employees) insertEmp.run(e);
  });
  seedEmployees();

  db.exec('PRAGMA foreign_keys = ON');


  // Leave balances (2026)
  const insertBal = db.prepare(`
    INSERT OR IGNORE INTO leave_balances
      (employee_id, leave_type, year, total_days, used_days, pending_days)
    VALUES (@employee_id, @leave_type, @year, @total_days, @used_days, @pending_days)
  `);

  const activeIds = employees.filter(e => e.status === 'active').map(e => e.id);
  const seedBalances = db.transaction(() => {
    for (const id of activeIds) {
      const emp = employees.find(e => e.id === id);
      const annual = emp.employment_type === 'part-time' ? 10 : 21;
      insertBal.run({ employee_id: id, leave_type: 'annual', year: 2026, total_days: annual, used_days: 0, pending_days: 0 });
      insertBal.run({ employee_id: id, leave_type: 'sick',   year: 2026, total_days: 10,     used_days: 0, pending_days: 0 });
      insertBal.run({ employee_id: id, leave_type: 'unpaid', year: 2026, total_days: 30,     used_days: 0, pending_days: 0 });
    }
  });
  seedBalances();

  // Leave requests (mix of statuses)
  const insertLeave = db.prepare(`
    INSERT OR IGNORE INTO leave_requests
      (id, employee_id, leave_type, start_date, end_date, days_requested,
       reason, status, reviewed_by, reviewed_at, created_at)
    VALUES
      (@id, @employee_id, @leave_type, @start_date, @end_date, @days_requested,
       @reason, @status, @reviewed_by, @reviewed_at, @created_at)
  `);

  const leaves = [
    { id: 1, employee_id: 4, leave_type: 'annual', start_date: '2026-08-04', end_date: '2026-08-08', days_requested: 5, reason: 'Family vacation', status: 'approved',  reviewed_by: 5, reviewed_at: '2026-07-20T10:00:00', created_at: '2026-07-18T08:00:00' },
    { id: 2, employee_id: 6, leave_type: 'sick',   start_date: '2026-07-28', end_date: '2026-07-29', days_requested: 2, reason: 'Flu',            status: 'pending',   reviewed_by: null, reviewed_at: null, created_at: '2026-07-27T07:00:00' },
    { id: 3, employee_id: 7, leave_type: 'annual', start_date: '2026-08-11', end_date: '2026-08-15', days_requested: 5, reason: 'Rest',           status: 'pending',   reviewed_by: null, reviewed_at: null, created_at: '2026-07-25T09:00:00' },
    { id: 4, employee_id: 8, leave_type: 'annual', start_date: '2026-07-21', end_date: '2026-07-25', days_requested: 5, reason: 'Holiday',        status: 'approved',  reviewed_by: 3, reviewed_at: '2026-07-15T14:00:00', created_at: '2026-07-14T11:00:00' },
    { id: 5, employee_id: 9, leave_type: 'unpaid', start_date: '2026-08-18', end_date: '2026-08-22', days_requested: 5, reason: 'Personal',       status: 'rejected',  reviewed_by: 5, reviewed_at: '2026-07-22T16:00:00', created_at: '2026-07-20T10:00:00' },
    { id: 6, employee_id: 4, leave_type: 'sick',   start_date: '2026-07-10', end_date: '2026-07-11', days_requested: 2, reason: 'Headache',       status: 'approved',  reviewed_by: 5, reviewed_at: '2026-07-10T09:00:00', created_at: '2026-07-10T08:30:00' },
  ];

  const seedLeaves = db.transaction(() => {
    for (const l of leaves) insertLeave.run(l);
  });
  seedLeaves();

  // Update leave balances for approved/pending requests
  // David: 5 annual approved + 2 sick approved + 2 sick pending
  db.prepare(`UPDATE leave_balances SET used_days = 2    WHERE employee_id=4 AND leave_type='sick'   AND year=2026`).run();
  db.prepare(`UPDATE leave_balances SET pending_days = 5 WHERE employee_id=4 AND leave_type='annual' AND year=2026`).run();
  // Henry: 5 annual used
  db.prepare(`UPDATE leave_balances SET used_days = 5    WHERE employee_id=8 AND leave_type='annual' AND year=2026`).run();
  // Grace: 5 annual pending
  db.prepare(`UPDATE leave_balances SET pending_days = 5 WHERE employee_id=7 AND leave_type='annual' AND year=2026`).run();
  // Frank: 2 sick pending
  db.prepare(`UPDATE leave_balances SET pending_days = 2 WHERE employee_id=6 AND leave_type='sick'   AND year=2026`).run();

  // Payroll run for June 2026 (finalized)
  db.prepare(`
    INSERT OR IGNORE INTO payroll_runs (id, period_month, period_year, status, generated_by, generated_at, notes)
    VALUES (1, 6, 2026, 'finalized', 2, '2026-07-01T08:00:00', 'June 2026 payroll — processed on time')
  `).run();

  // Payslips for June 2026
  const insertSlip = db.prepare(`
    INSERT OR IGNORE INTO payslips
      (payroll_run_id, employee_id, working_days_in_period, days_worked,
       unpaid_leave_days, gross_pay, unpaid_leave_deduction, taxable_income,
       income_tax, social_security, net_pay, notes)
    VALUES
      (@payroll_run_id, @employee_id, @working_days_in_period, @days_worked,
       @unpaid_leave_days, @gross_pay, @unpaid_leave_deduction, @taxable_income,
       @income_tax, @social_security, @net_pay, @notes)
  `);

  const slips = [
    { payroll_run_id: 1, employee_id: 1, working_days_in_period: 21, days_worked: 21, unpaid_leave_days: 0, gross_pay: 150000, unpaid_leave_deduction: 0, taxable_income: 150000, income_tax: 37000, social_security: 2500, net_pay: 110500, notes: null },
    { payroll_run_id: 1, employee_id: 2, working_days_in_period: 21, days_worked: 21, unpaid_leave_days: 0, gross_pay: 95000,  unpaid_leave_deduction: 0, taxable_income: 95000,  income_tax: 22000, social_security: 2500, net_pay:  70500, notes: null },
    { payroll_run_id: 1, employee_id: 3, working_days_in_period: 21, days_worked: 21, unpaid_leave_days: 0, gross_pay: 100000, unpaid_leave_deduction: 0, taxable_income: 100000, income_tax: 24000, social_security: 2500, net_pay:  73500, notes: null },
    { payroll_run_id: 1, employee_id: 4, working_days_in_period: 21, days_worked: 21, unpaid_leave_days: 0, gross_pay: 85000,  unpaid_leave_deduction: 0, taxable_income: 85000,  income_tax: 20500, social_security: 2500, net_pay:  62000, notes: null },
    { payroll_run_id: 1, employee_id: 5, working_days_in_period: 21, days_worked: 21, unpaid_leave_days: 0, gross_pay: 110000, unpaid_leave_deduction: 0, taxable_income: 110000, income_tax: 27000, social_security: 2500, net_pay:  80500, notes: null },
    { payroll_run_id: 1, employee_id: 6, working_days_in_period: 21, days_worked: 21, unpaid_leave_days: 0, gross_pay: 55000,  unpaid_leave_deduction: 0, taxable_income: 55000,  income_tax: 11500, social_security: 2500, net_pay:  41000, notes: null },
    { payroll_run_id: 1, employee_id: 7, working_days_in_period: 21, days_worked: 21, unpaid_leave_days: 0, gross_pay: 60000,  unpaid_leave_deduction: 0, taxable_income: 60000,  income_tax: 13000, social_security: 2500, net_pay:  44500, notes: null },
    { payroll_run_id: 1, employee_id: 8, working_days_in_period: 21, days_worked: 21, unpaid_leave_days: 0, gross_pay: 65000,  unpaid_leave_deduction: 0, taxable_income: 65000,  income_tax: 14500, social_security: 2500, net_pay:  48000, notes: null },
    { payroll_run_id: 1, employee_id: 9, working_days_in_period: 21, days_worked: 21, unpaid_leave_days: 0, gross_pay: 35000,  unpaid_leave_deduction: 0, taxable_income: 35000,  income_tax:  5000, social_security: 1750, net_pay:  28250, notes: 'Part-time — social security uncapped' },
  ];

  const seedSlips = db.transaction(() => {
    for (const s of slips) insertSlip.run(s);
  });
  seedSlips();

  console.log('✅  Seed data loaded successfully');
  console.log(`   ${employees.length} employees  |  ${leaves.length} leave requests  |  1 payroll run  |  ${slips.length} payslips`);
}

seed();
