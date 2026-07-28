'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { getDb } = require('./database/db');

const app = express();
app.use(cors()); 
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/employees', require('./routes/employees'));
app.use('/api/leave',     require('./routes/leave'));
app.use('/api/payroll',   require('./routes/payroll'));

// ── Health Check ────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ── Dashboard endpoint ───
app.get('/api/dashboard', (req, res) => {
  const db   = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const pendingLeave   = db.prepare(`SELECT COUNT(*) AS cnt FROM leave_requests WHERE status = 'pending'`).get();
  const outToday       = db.prepare(`
    SELECT COUNT(*) AS cnt FROM leave_requests
    WHERE status = 'approved' AND start_date <= ? AND end_date >= ?
  `).get(today, today);
  const activeEmployees = db.prepare(`SELECT COUNT(*) AS cnt FROM employees WHERE status = 'active'`).get();
  const escalated      = db.prepare(`SELECT COUNT(*) AS cnt FROM leave_requests WHERE escalated = 1 AND status = 'pending'`).get();
  const recentPayroll  = db.prepare(`
    SELECT pr.*, e.name AS generated_by_name
    FROM payroll_runs pr
    LEFT JOIN employees e ON pr.generated_by = e.id
    ORDER BY pr.period_year DESC, pr.period_month DESC
    LIMIT 1
  `).get();
  const pendingList    = db.prepare(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.days_requested,
           e.name AS employee_name, e.department, lr.created_at
    FROM leave_requests lr
    JOIN employees e ON lr.employee_id = e.id
    WHERE lr.status = 'pending'
    ORDER BY lr.created_at ASC
    LIMIT 10
  `).all();
  const outList        = db.prepare(`
    SELECT lr.leave_type, lr.start_date, lr.end_date,
           e.name AS employee_name, e.department
    FROM leave_requests lr
    JOIN employees e ON lr.employee_id = e.id
    WHERE lr.status = 'approved' AND lr.start_date <= ? AND lr.end_date >= ?
    ORDER BY e.department, e.name
  `).all(today, today);

  res.json({
    success: true,
    data: {
      stats: {
        active_employees: activeEmployees.cnt,
        pending_leave:    pendingLeave.cnt,
        out_today:        outToday.cnt,
        escalated:        escalated.cnt
      },
      pending_approvals: pendingList,
      out_today:         outList,
      latest_payroll:    recentPayroll || null
    }
  });
});

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀  HR & Payroll System running at http://localhost:${PORT}`);
  console.log(`   API docs: http://localhost:${PORT}/api/employees`);
});

module.exports = app;
