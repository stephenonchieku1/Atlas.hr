PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE employees (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  email           TEXT    NOT NULL UNIQUE,
  role            TEXT    NOT NULL,
  department      TEXT    NOT NULL,
  manager_id      INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  start_date      TEXT    NOT NULL,  -- ISO 8601: YYYY-MM-DD
  salary          REAL    NOT NULL CHECK(salary > 0),
  employment_type TEXT    NOT NULL CHECK(employment_type IN ('full-time','part-time','contract')),
  status          TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO employees VALUES(1,'Alice Mwangi','alice@hrco.dev','CEO','Executive',NULL,'2020-01-15',150000.0,'full-time','active','2026-07-27 12:41:34');
INSERT INTO employees VALUES(2,'Brian Odhiambo','brian@hrco.dev','Head of HR','HR',1,'2020-03-01',95000.0,'full-time','active','2026-07-27 12:41:34');
INSERT INTO employees VALUES(3,'Carol Wanjiku','carol@hrco.dev','Head of Finance','Finance',1,'2020-06-01',100000.0,'full-time','active','2026-07-27 12:41:34');
INSERT INTO employees VALUES(4,'David Kimani','david@hrco.dev','Senior Engineer','Engineering',5,'2021-02-15',85000.0,'full-time','active','2026-07-27 12:41:34');
INSERT INTO employees VALUES(5,'Esther Ndung''u','esther@hrco.dev','Engineering Lead','Engineering',1,'2020-09-01',110000.0,'full-time','active','2026-07-27 12:41:34');
INSERT INTO employees VALUES(6,'Frank Otieno','frank@hrco.dev','Junior Engineer','Engineering',5,'2022-04-01',55000.0,'full-time','active','2026-07-27 12:41:34');
INSERT INTO employees VALUES(7,'Grace Achieng','grace@hrco.dev','HR Specialist','HR',2,'2021-07-15',60000.0,'full-time','active','2026-07-27 12:41:34');
INSERT INTO employees VALUES(8,'Henry Muthoni','henry@hrco.dev','Accountant','Finance',3,'2022-01-10',65000.0,'full-time','active','2026-07-27 12:41:34');
INSERT INTO employees VALUES(9,'Irene Kamau','irene@hrco.dev','Part-time Designer','Engineering',5,'2023-03-01',35000.0,'part-time','active','2026-07-27 12:41:34');
INSERT INTO employees VALUES(10,'James Njoroge','james@hrco.dev','Sales Lead','Sales',1,'2026-07-15',75000.0,'full-time','active','2026-07-27 12:41:34');
INSERT INTO employees VALUES(11,'Karen Chebet','karen@hrco.dev','Sales Rep','Sales',10,'2021-11-01',50000.0,'full-time','inactive','2026-07-27 12:41:34');
CREATE TABLE leave_balances (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type   TEXT    NOT NULL CHECK(leave_type IN ('annual','sick','unpaid')),
  year         INTEGER NOT NULL,
  total_days   REAL    NOT NULL DEFAULT 0,
  used_days    REAL    NOT NULL DEFAULT 0,
  pending_days REAL    NOT NULL DEFAULT 0,
  UNIQUE(employee_id, leave_type, year)
);
INSERT INTO leave_balances VALUES(1,1,'annual',2026,21.0,0.0,0.0);
INSERT INTO leave_balances VALUES(2,1,'sick',2026,10.0,0.0,0.0);
INSERT INTO leave_balances VALUES(3,1,'unpaid',2026,30.0,0.0,0.0);
INSERT INTO leave_balances VALUES(4,2,'annual',2026,21.0,0.0,0.0);
INSERT INTO leave_balances VALUES(5,2,'sick',2026,10.0,0.0,0.0);
INSERT INTO leave_balances VALUES(6,2,'unpaid',2026,30.0,0.0,0.0);
INSERT INTO leave_balances VALUES(7,3,'annual',2026,21.0,0.0,0.0);
INSERT INTO leave_balances VALUES(8,3,'sick',2026,10.0,0.0,0.0);
INSERT INTO leave_balances VALUES(9,3,'unpaid',2026,30.0,0.0,0.0);
INSERT INTO leave_balances VALUES(10,4,'annual',2026,21.0,0.0,5.0);
INSERT INTO leave_balances VALUES(11,4,'sick',2026,10.0,2.0,0.0);
INSERT INTO leave_balances VALUES(12,4,'unpaid',2026,30.0,0.0,0.0);
INSERT INTO leave_balances VALUES(13,5,'annual',2026,21.0,0.0,0.0);
INSERT INTO leave_balances VALUES(14,5,'sick',2026,10.0,0.0,0.0);
INSERT INTO leave_balances VALUES(15,5,'unpaid',2026,30.0,0.0,0.0);
INSERT INTO leave_balances VALUES(16,6,'annual',2026,21.0,0.0,0.0);
INSERT INTO leave_balances VALUES(17,6,'sick',2026,10.0,0.0,2.0);
INSERT INTO leave_balances VALUES(18,6,'unpaid',2026,30.0,0.0,0.0);
INSERT INTO leave_balances VALUES(19,7,'annual',2026,21.0,0.0,5.0);
INSERT INTO leave_balances VALUES(20,7,'sick',2026,10.0,0.0,0.0);
INSERT INTO leave_balances VALUES(21,7,'unpaid',2026,30.0,0.0,0.0);
INSERT INTO leave_balances VALUES(22,8,'annual',2026,21.0,5.0,0.0);
INSERT INTO leave_balances VALUES(23,8,'sick',2026,10.0,0.0,0.0);
INSERT INTO leave_balances VALUES(24,8,'unpaid',2026,30.0,0.0,0.0);
INSERT INTO leave_balances VALUES(25,9,'annual',2026,10.0,0.0,0.0);
INSERT INTO leave_balances VALUES(26,9,'sick',2026,10.0,0.0,0.0);
INSERT INTO leave_balances VALUES(27,9,'unpaid',2026,30.0,0.0,0.0);
INSERT INTO leave_balances VALUES(28,10,'annual',2026,21.0,0.0,0.0);
INSERT INTO leave_balances VALUES(29,10,'sick',2026,10.0,0.0,0.0);
INSERT INTO leave_balances VALUES(30,10,'unpaid',2026,30.0,0.0,0.0);
CREATE TABLE leave_requests (
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
  escalated       INTEGER NOT NULL DEFAULT 0, -- 1 if escalated to HR
  escalated_at    TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO leave_requests VALUES(1,4,'annual','2026-08-04','2026-08-08',5.0,'Family vacation','approved',5,'2026-07-20T10:00:00',0,NULL,'2026-07-18T08:00:00');
INSERT INTO leave_requests VALUES(2,6,'sick','2026-07-28','2026-07-29',2.0,'Flu','pending',NULL,NULL,0,NULL,'2026-07-27T07:00:00');
INSERT INTO leave_requests VALUES(3,7,'annual','2026-08-11','2026-08-15',5.0,'Rest','pending',NULL,NULL,0,NULL,'2026-07-25T09:00:00');
INSERT INTO leave_requests VALUES(4,8,'annual','2026-07-21','2026-07-25',5.0,'Holiday','approved',3,'2026-07-15T14:00:00',0,NULL,'2026-07-14T11:00:00');
INSERT INTO leave_requests VALUES(5,9,'unpaid','2026-08-18','2026-08-22',5.0,'Personal','rejected',5,'2026-07-22T16:00:00',0,NULL,'2026-07-20T10:00:00');
INSERT INTO leave_requests VALUES(6,4,'sick','2026-07-10','2026-07-11',2.0,'Headache','approved',5,'2026-07-10T09:00:00',0,NULL,'2026-07-10T08:30:00');
CREATE TABLE payroll_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  period_month  INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
  period_year   INTEGER NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','finalized')),
  generated_by  INTEGER REFERENCES employees(id),
  generated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  notes         TEXT,
  UNIQUE(period_month, period_year)
);
INSERT INTO payroll_runs VALUES(1,6,2026,'finalized',2,'2026-07-01T08:00:00','June 2026 payroll — processed on time');
CREATE TABLE payslips (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_run_id         INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id            INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  -- time basis
  working_days_in_period INTEGER NOT NULL,
  days_worked            REAL    NOT NULL,
  unpaid_leave_days      REAL    NOT NULL DEFAULT 0,
  -- pay components
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
INSERT INTO payslips VALUES(1,1,1,21,21.0,0.0,150000.0,0.0,150000.0,37000.0,2500.0,110500.0,NULL,'2026-07-27 12:41:34');
INSERT INTO payslips VALUES(2,1,2,21,21.0,0.0,95000.0,0.0,95000.0,22000.0,2500.0,70500.0,NULL,'2026-07-27 12:41:34');
INSERT INTO payslips VALUES(3,1,3,21,21.0,0.0,100000.0,0.0,100000.0,24000.0,2500.0,73500.0,NULL,'2026-07-27 12:41:34');
INSERT INTO payslips VALUES(4,1,4,21,21.0,0.0,85000.0,0.0,85000.0,20500.0,2500.0,62000.0,NULL,'2026-07-27 12:41:34');
INSERT INTO payslips VALUES(5,1,5,21,21.0,0.0,110000.0,0.0,110000.0,27000.0,2500.0,80500.0,NULL,'2026-07-27 12:41:34');
INSERT INTO payslips VALUES(6,1,6,21,21.0,0.0,55000.0,0.0,55000.0,11500.0,2500.0,41000.0,NULL,'2026-07-27 12:41:34');
INSERT INTO payslips VALUES(7,1,7,21,21.0,0.0,60000.0,0.0,60000.0,13000.0,2500.0,44500.0,NULL,'2026-07-27 12:41:34');
INSERT INTO payslips VALUES(8,1,8,21,21.0,0.0,65000.0,0.0,65000.0,14500.0,2500.0,48000.0,NULL,'2026-07-27 12:41:34');
INSERT INTO payslips VALUES(9,1,9,21,21.0,0.0,35000.0,0.0,35000.0,5000.0,1750.0,28250.0,'Part-time — social security uncapped','2026-07-27 12:41:34');
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('employees',11);
INSERT INTO sqlite_sequence VALUES('leave_balances',30);
INSERT INTO sqlite_sequence VALUES('leave_requests',6);
INSERT INTO sqlite_sequence VALUES('payroll_runs',1);
INSERT INTO sqlite_sequence VALUES('payslips',9);
CREATE INDEX idx_employees_manager   ON employees(manager_id);
CREATE INDEX idx_employees_status    ON employees(status);
CREATE INDEX idx_leave_employee      ON leave_requests(employee_id);
CREATE INDEX idx_leave_status        ON leave_requests(status);
CREATE INDEX idx_leave_dates         ON leave_requests(start_date, end_date);
CREATE INDEX idx_payslips_run        ON payslips(payroll_run_id);
CREATE INDEX idx_payslips_employee   ON payslips(employee_id);
COMMIT;
