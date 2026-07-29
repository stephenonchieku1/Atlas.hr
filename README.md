# Atlas HR — Human Resource & Payroll System

A clean, production-ready internal HR & Payroll platform with real-world business logic and automated leave/payroll rules. Built with **Express.js + Node.js native SQLite (`node:sqlite`) + Vanilla HTML/CSS/JS (SPA)**.

---

## Quick Start

**Requirements:** Node.js ≥ 22.5 (uses the built-in `node:sqlite` — no native compilation needed)

```bash
git clone https://github.com/stephenonchieku1/Atlas.hr.git
cd atlas-hr
npm install
npm run seed        # Load sample data (11 employees, leave requests, payroll run)
npm start           # http://localhost:3000
```

**Run tests:**
```bash
npm test
```

---

## What I Prioritized and Why

I implemented all three core modules fully. Here's the order of effort:

| Priority | Module | Rationale |
|---|---|---|
| 1 | **Leave Management** | Highest density of real business logic. Real leave systems fail in predictable ways; I wanted to show I could identify and solve those problems. |
| 2 | **Payroll** | Math correctness and edge cases are the core evaluation signal. All edge cases explicitly unit-tested. |
| 3 | **Employee Records** | Foundation layer — done correctly but straightforwardly. |

---

## Leave Management — Problems Identified + Rules Built

Real leave systems fail in ways spreadsheets don't catch. Here's what I identified and built:

### Problem 1: Insufficient notice time
**What breaks:** Employees book annual leave for tomorrow, leaving no time to arrange cover.  
**Rule built:** Annual leave requires **≥ 3 working days notice**. Sick leave and unpaid leave are exempt (you can't predict illness).

### Problem 2: Team under-coverage
**What breaks:** Multiple people from the same department leave at the same time, leaving critical work uncovered.  
**Rule built:** If approving a request would leave **< 50% of the department present**, the request is blocked. The error message tells the requester exactly how many colleagues are already out.

### Problem 3: Requests sitting unanswered
**What breaks:** A pending leave request is forgotten in someone's inbox. The employee doesn't know if they can book their flight.  
**Rule built:** Any request **pending for > 48 hours** is flagged as escalated. `GET /api/leave/escalate` checks this and marks stale requests. The Dashboard has a "Check Escalations" button. In production, this would send a notification to HR.

### Problem 4: Overlapping requests
**What breaks:** An employee submits two requests for the same dates (deliberately or by accident).  
**Rule built:** Overlap is blocked at submission time. Rejected and cancelled requests are excluded from the overlap check.

### Problem 5: Balance exceeded
**What breaks:** Someone requests 15 days when they only have 5 left.  
**Rule built:** Balance (total − used − pending) is checked at submission. Pending days are reserved immediately and only released on rejection or cancellation.

### Problem 6: Mid-leave cancellations
**What breaks:** An employee cancels approved leave after it has already started, causing scheduling confusion.  
**Rule built:** Cancelling approved leave is blocked once `start_date ≤ today`. The error message tells them to contact HR for a partial cancellation.

### Leave ↔ Payroll Interaction
When payroll is generated for a period, the system looks up **approved unpaid leave** for each employee during that period. The unpaid days are deducted from gross pay before tax is applied (see formula below).

---

## Payroll Formula

### Gross Pay
```
daily_rate = monthly_salary / working_days_in_month
gross_pay  = daily_rate × days_worked

# Mid-month joiner: days_worked = working days from start_date to month end
# Normal employee:  days_worked = working_days_in_month
```

### Deductions
```
unpaid_leave_deduction = daily_rate × unpaid_leave_days
taxable_income         = gross_pay − unpaid_leave_deduction
```

### Income Tax (Progressive)
| Bracket | Rate |
|---|---|
| 0 – 20,000 | 10% |
| 20,001 – 50,000 | 20% |
| 50,001 + | 30% |

```
# Example: taxable = 85,000
tax = 20,000×10% + 30,000×20% + 35,000×30%
    = 2,000 + 6,000 + 10,500 = 18,500
```

### Social Security
```
social_security = min(gross_pay × 5%, 2,500)
```

### Net Pay
```
net_pay = gross_pay − unpaid_leave_deduction − income_tax − social_security
```

### Edge Cases Handled
| Edge Case | Handling |
|---|---|
| Mid-month joiner | `days_worked` counted from `start_date` to month end |
| Zero-deduction | When taxable ≤ 0, tax = 0; net = gross − SS |
| Salary at bracket boundary | Progressive split: only the amount in each bracket is taxed at that rate |
| Unpaid leave | Deducted from gross before tax is applied |
| Part-time social security | 5% × their pro-rated gross (not capped if gross < 50k) |

---

## Tech Stack & Assumptions

- **Backend:** Express.js (Node.js)
- **Database:** SQLite via Node.js native `node:sqlite` (zero-config, built-in)
- **Frontend:** Vanilla HTML/CSS/JS — Atlas HR single-page application (SPA) with dark glassmorphism design system
- **Tests:** Jest
- **Leave year:** Calendar year (Jan–Dec)
- **Annual leave allocation:** 21 days/year (full-time), 10 days/year (part-time)
- **Sick leave allocation:** 10 days/year (all types)
- **Working days:** Monday–Friday (weekends excluded from all calculations)
- **Currency:** Generic numeric (no symbol — currency-agnostic)

---

## API Endpoints

### Employees
| Method | Path | Description |
|---|---|---|
| GET | `/api/employees` | List employees (`?includeInactive=true`) |
| GET | `/api/employees/org-tree` | Org chart flat list |
| GET | `/api/employees/:id` | Get by ID |
| POST | `/api/employees` | Create employee |
| PATCH | `/api/employees/:id` | Update fields |
| PATCH | `/api/employees/:id/deactivate` | Soft-delete |
| PATCH | `/api/employees/:id/reactivate` | Re-activate |

### Leave
| Method | Path | Description |
|---|---|---|
| GET | `/api/leave` | List (`?status=pending&employee_id=1`) |
| GET | `/api/leave/pending` | All pending requests |
| GET | `/api/leave/who-is-out` | Who's on approved leave today (`?date=YYYY-MM-DD`) |
| GET | `/api/leave/escalate` | Flag stale (>48h) pending requests |
| GET | `/api/leave/balances/:empId` | Leave balances for employee |
| POST | `/api/leave` | Submit leave request (all rules applied) |
| PATCH | `/api/leave/:id/approve` | Approve |
| PATCH | `/api/leave/:id/reject` | Reject |
| PATCH | `/api/leave/:id/cancel` | Cancel |

### Payroll
| Method | Path | Description |
|---|---|---|
| GET | `/api/payroll` | List all runs |
| GET | `/api/payroll/:id/payslips` | Payslips for a run |
| GET | `/api/payroll/employee/:id` | Payslip history for employee |
| POST | `/api/payroll/generate` | Generate payroll run |
| PATCH | `/api/payroll/:id/finalize` | Finalize draft run |
| DELETE | `/api/payroll/:id` | Delete draft run |

---

## Tests

```bash
npm test
```

Tests are in `tests/` using Jest. Coverage focuses on:

- **`employee.test.js`:** Employee retrieval, creation, search, department filtering, activation status, and update validation.
- **`payroll.test.js`:** All three tax brackets, bracket boundaries (20k, 50k), social security cap, mid-month pro-ration, zero-deduction, unpaid leave deduction, net pay calculation.
- **`leave.test.js`:** Notice period rule (0,1,2,3,7 days), balance check, overlap detection, team coverage thresholds, escalation age logic, cancellation guard.

Tests are **pure unit tests** — no external server required.

---

## Sample Data

The seed script loads:
- **11 employees** across 5 departments with a realistic org hierarchy
- **1 inactive employee** (Karen Chebet — payroll history preserved)
- **6 leave requests** (mix of approved, pending, rejected)
- **1 finalized payroll run** (June 2026) with 9 payslips

---

## What I'd Improve Given More Time

1. **Authentication & roles** — Currently, `reviewer_id: 1` (Alice/CEO) is hardcoded for demo approvals. A real system would have JWT sessions and role-based access (employee, manager, HR admin).
2. **Notifications** — The escalation endpoint marks stale requests but only logs. In production, I'd wire this to email/Slack via a webhook.
3. **Payroll finalization lock** — Once finalized, prevent any leave changes that would affect that period retroactively.
4. **Leave calendar view** — A month-grid showing who's out when, useful for managers planning coverage.
5. **Audit log** — Track every status change with timestamps and actor IDs.
6. **Export** — PDF payslip generation and CSV export for accounting systems.
7. **Public holidays** — Currently, only weekends are excluded. A holiday calendar would make the working-day math country-accurate.
8. **Automated escalation cron** — The escalation check is manual (button click). In production, it would run on a schedule (e.g., every hour) automatically.

---

## Project Structure

```
atlas-hr/
├── server.js              ← Express entry point + dashboard endpoint
├── package.json
├── database/
│   ├── db.js              ← SQLite singleton via node:sqlite (auto-initialises schema)
│   ├── schema.sql         ← DDL with constraints and indexes
│   └── seed.js            ← Idempotent sample data
├── routes/                ← Express routers (employees, leave, payroll)
├── controllers/           ← Business logic (leave rules, payroll math)
├── models/                ← Data access layer
├── utils/
│   └── dateUtils.js       ← Working-day calculations
├── public/
│   ├── index.html         ← SPA shell (Atlas HR interface)
│   ├── css/style.css      ← Dark glassmorphism design system
│   └── js/app.js          ← Vanilla JS SPA client
└── tests/
    ├── employee.test.js   ← Employee management unit tests
    ├── leave.test.js      ← Leave rule unit tests
    └── payroll.test.js    ← Payroll math unit tests
```

