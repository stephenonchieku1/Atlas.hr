PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS employees (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  email           TEXT    NOT NULL UNIQUE,
  role            TEXT    NOT NULL,
  department      TEXT    NOT NULL,
  manager_id      INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  start_date      TEXT    NOT NULL,  
  salary          REAL    NOT NULL CHECK(salary > 0),
  employment_type TEXT    NOT NULL CHECK(employment_type IN ('full-time','part-time','contract')),
  status          TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type   TEXT    NOT NULL CHECK(leave_type IN ('annual','sick','unpaid')),
  year         INTEGER NOT NULL,
  total_days   REAL    NOT NULL DEFAULT 0,
  used_days    REAL    NOT NULL DEFAULT 0,
  pending_days REAL    NOT NULL DEFAULT 0,
  UNIQUE(employee_id, leave_type, year)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id     INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type      TEXT    NOT NULL CHECK(leave_type IN ('annual','sick','unpaid')),
  start_date      TEXT    NOT NULL,
  end_date        TEXT    NOT NULL,
  days_requested  REAL    NOT NULL CHECK(days_requested > 0),
  reason          TEXT,
  status          TEXT    NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','approved','rejected','cancelled')),
  reviewed_by     INTEGER REFERENCES employees(id),
  reviewed_at     TEXT,
  escalated       INTEGER NOT NULL DEFAULT 0, 
  escalated_at    TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  period_month  INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
  period_year   INTEGER NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','finalized')),
  generated_by  INTEGER REFERENCES employees(id),
  generated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  notes         TEXT,
  UNIQUE(period_month, period_year)
);

CREATE TABLE IF NOT EXISTS payslips (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_run_id         INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id            INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  working_days_in_period INTEGER NOT NULL,
  days_worked            REAL    NOT NULL,
  unpaid_leave_days      REAL    NOT NULL DEFAULT 0,

  gross_pay              REAL    NOT NULL,
  unpaid_leave_deduction REAL    NOT NULL DEFAULT 0,
  taxable_income         REAL    NOT NULL,
  income_tax             REAL    NOT NULL DEFAULT 0,
  social_security        REAL    NOT NULL DEFAULT 0,
  net_pay                REAL    NOT NULL,
  -- meta
  notes                  TEXT,
  created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(payroll_run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employees_manager   ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_status    ON employees(status);
CREATE INDEX IF NOT EXISTS idx_leave_employee      ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status        ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates         ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payslips_run        ON payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee   ON payslips(employee_id);
