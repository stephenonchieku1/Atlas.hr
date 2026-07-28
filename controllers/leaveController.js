'use strict';

const Leave    = require('../models/Leave');
const Employee = require('../models/Employee');
const { countWorkingDays, workingDaysBetween } = require('../utils/dateUtils');

const ok   = (res, data, code = 200) => res.status(code).json({ success: true,  data });
const fail = (res, msg,  code = 400) => res.status(code).json({ success: false, error: msg });

// ── Public endpoints ──────────────────────────────────────

exports.list = (req, res) => {
  try {
    const { status, employee_id } = req.query;
    ok(res, Leave.findAll({ status, employeeId: employee_id ? Number(employee_id) : undefined }));
  } catch (e) { fail(res, e.message, 500); }
};

exports.getPending = (req, res) => {
  try { ok(res, Leave.findPending()); }
  catch (e) { fail(res, e.message, 500); }
};

exports.getById = (req, res) => {
  const req_ = Leave.findById(Number(req.params.id));
  if (!req_) return fail(res, 'Leave request not found', 404);
  ok(res, req_);
};

exports.getBalances = (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  try {
    ok(res, Leave.getBalancesForEmployee(Number(req.params.employeeId), year));
  } catch (e) { fail(res, e.message, 500); }
};

exports.whoIsOut = (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  try { ok(res, Leave.findActiveOnDate(date)); }
  catch (e) { fail(res, e.message, 500); }
};

// ── Submit a leave request ────────────────────────────────

exports.submit = (req, res) => {
  const { employee_id, leave_type, start_date, end_date, reason } = req.body;

  // Basic validation
  const missing = ['employee_id','leave_type','start_date','end_date']
    .filter(f => !req.body[f]);
  if (missing.length) return fail(res, `Missing fields: ${missing.join(', ')}`);

  if (!['annual','sick','unpaid'].includes(leave_type))
    return fail(res, 'leave_type must be annual | sick | unpaid');

  const start = new Date(start_date);
  const end   = new Date(end_date);
  if (isNaN(start) || isNaN(end)) return fail(res, 'Invalid date format. Use YYYY-MM-DD');
  if (end < start)                return fail(res, 'end_date must be on or after start_date');

  const employee = Employee.findById(Number(employee_id));
  if (!employee)          return fail(res, 'Employee not found', 404);
  if (employee.status !== 'active') return fail(res, 'Inactive employees cannot submit leave');

  const days_requested = workingDaysBetween(start_date, end_date);
  if (days_requested <= 0) return fail(res, 'No working days in selected range');

  // ── RULE 1: Notice period ─────────────────────────────
  if (leave_type === 'annual') {
    const noticeWorkingDays = workingDaysBetween(
      new Date().toISOString().slice(0,10), start_date
    );
    if (noticeWorkingDays < 3) {
      return fail(res,
        `Annual leave requires at least 3 working days notice. ` +
        `You have ${noticeWorkingDays} working day(s) notice. ` +
        `Please submit sick leave if this is urgent.`
      );
    }
  }
// ── RULE 2: Balance check ─────────────────────────────
  if (leave_type !== 'unpaid') {
    const year    = start.getFullYear();
    const balance = Leave.getBalance(Number(employee_id), leave_type, year);
    if (!balance) {
      return fail(res, `No ${leave_type} leave balance found for ${year}`);
    }
    const available = balance.total_days - balance.used_days - balance.pending_days;
    if (days_requested > available) {
      return fail(res,
        `Insufficient ${leave_type} leave balance. ` +
        `Requested: ${days_requested} day(s), Available: ${available.toFixed(1)} day(s).`
      );
    }
  }
  // ── RULE 3: Overlap guard ─────────────────────────────
  const overlaps = Leave.findOverlap(Number(employee_id), start_date, end_date);
  if (overlaps.length > 0) {
    return fail(res,
      `You already have a leave request (ID: ${overlaps[0].id}) that overlaps with these dates.`
    );
  }
  // ── RULE 4: Team coverage (annual leave only) ─────────
  if (leave_type === 'annual') {
    const deptCount   = Leave.countActiveInDepartment(employee.department);
    const alreadyOut  = Leave.findApprovedInRange(start_date, end_date, employee.department);
    // Count unique employees already approved (excluding the requester)
    const uniqueOut   = new Set(alreadyOut.map(r => r.employee_id)).size;
    const coverage    = (deptCount - uniqueOut) / deptCount;

    if (coverage < 0.5) {
      return fail(res,
        `Team coverage violation: ${uniqueOut} of ${deptCount} colleagues in ` +
        `'${employee.department}' are already on approved leave during this period. ` +
        `At least 50% of the team must be present.`
      );
    }
  }

  try {
    const leaveReq = Leave.create({
      employee_id: Number(employee_id),
      leave_type,
      start_date,
      end_date,
      days_requested,
      reason: reason || null
    });
    ok(res, leaveReq, 201);
  } catch (e) { fail(res, e.message, 500); }
};

// ── Approve / Reject / Cancel ─────────────────────────────

exports.approve = (req, res) => {
  const id = Number(req.params.id);
  const { reviewer_id } = req.body;
  if (!reviewer_id) return fail(res, 'reviewer_id is required');

  const req_ = Leave.findById(id);
  if (!req_)                    return fail(res, 'Leave request not found', 404);
  if (req_.status !== 'pending') return fail(res, `Cannot approve a ${req_.status} request`);

  try { ok(res, Leave.approve(id, Number(reviewer_id))); }
  catch (e) { fail(res, e.message, 500); }
};

exports.reject = (req, res) => {
  const id = Number(req.params.id);
  const { reviewer_id, reason } = req.body;
  if (!reviewer_id) return fail(res, 'reviewer_id is required');

  const req_ = Leave.findById(id);
  if (!req_)                    return fail(res, 'Leave request not found', 404);
  if (req_.status !== 'pending') return fail(res, `Cannot reject a ${req_.status} request`);

  try { ok(res, Leave.reject(id, Number(reviewer_id), reason)); }
  catch (e) { fail(res, e.message, 500); }
};

exports.cancel = (req, res) => {
  const id   = Number(req.params.id);
  const req_ = Leave.findById(id);
  if (!req_) return fail(res, 'Leave request not found', 404);

  if (!['pending','approved'].includes(req_.status))
    return fail(res, `Cannot cancel a ${req_.status} request`);

  // ── RULE 5: Mid-leave cancellation guard ─────────────
  const today = new Date().toISOString().slice(0, 10);
  if (req_.status === 'approved' && req_.start_date <= today) {
    return fail(res,
      'Cannot cancel leave that has already started. ' +
      'Contact HR to process a partial cancellation manually.'
    );
  }

  try { ok(res, Leave.cancel(id)); }
  catch (e) { fail(res, e.message, 500); }
};

// ── RULE 6: Escalation check ──────────────────────────────
// Call this endpoint on a schedule (e.g. cron) or via the UI
exports.escalate = (req, res) => {
  try {
    const stale = Leave.findStalePending(48);
    let escalated = 0;

    for (const r of stale) {
      Leave.markEscalated(r.id);
      escalated++;
      // In production: send notification to HR
      
    }

    ok(res, {
      message: `Escalated ${escalated} stale request(s) to HR`,
      escalated_requests: stale.map(r => ({
        id: r.id,
        employee: r.employee_name,
        manager: r.manager_name,
        submitted: r.created_at,
        hours_pending: Math.round((Date.now() - new Date(r.created_at).getTime()) / 3600000)
      }))
    });
  } catch (e) { fail(res, e.message, 500); }
};
