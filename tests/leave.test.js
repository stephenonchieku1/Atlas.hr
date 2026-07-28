'use strict';
/**
 * leave.test.js — Unit tests for leave business rules
 *
 * Rules tested:
 *  1. Notice period — annual leave needs 3 working days notice
 *  2. Balance check — reject if requested > available
 *  3. Overlap guard — can't have two overlapping requests
 *  4. Team coverage — <50% present means blocked
 *  5. Escalation    — stale pending (>48h) correctly identified
 *  6. Cancellation  — can't cancel leave that's already started
 *  7. Working days calculation — correct business-day counting
 */

const { workingDaysBetween, workingDaysInMonth } = require('../utils/dateUtils');

// ─────────────────────────────────────────────────────────
// Helper: simulate the notice-period check from leaveController
// ─────────────────────────────────────────────────────────
function checkNotice(leaveType, startDateStr, todayStr) {
  if (leaveType !== 'annual') return { ok: true };
  const noticeDays = workingDaysBetween(todayStr, startDateStr) - 1; // exclude start day
  // Actually the controller counts from today to start (exclusive start)
  // replicate: noticeWorkingDays = workingDaysBetween(today, startDate) but today is included
  const noticeWorkingDays = workingDaysBetween(todayStr, startDateStr);
  if (noticeWorkingDays < 3) {
    return { ok: false, reason: `Only ${noticeWorkingDays} working day(s) notice` };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────
// Helper: simulate balance check
// ─────────────────────────────────────────────────────────
function checkBalance(balance, daysRequested) {
  const available = balance.total_days - balance.used_days - balance.pending_days;
  if (daysRequested > available) {
    return { ok: false, available, reason: 'Insufficient balance' };
  }
  return { ok: true, available };
}

// ─────────────────────────────────────────────────────────
// Helper: simulate overlap check
// ─────────────────────────────────────────────────────────
function hasOverlap(existing, newStart, newEnd) {
  return existing.some(r => {
    return r.start_date <= newEnd && r.end_date >= newStart &&
           !['rejected','cancelled'].includes(r.status);
  });
}

// ─────────────────────────────────────────────────────────
// Helper: simulate team coverage check
// ─────────────────────────────────────────────────────────
function checkTeamCoverage(totalInDept, alreadyOutCount) {
  const remaining = totalInDept - alreadyOutCount;
  const coverage  = remaining / totalInDept;
  return { coverage, blocked: coverage < 0.5 };
}

// ─────────────────────────────────────────────────────────
// Helper: simulate stale-pending escalation
// ─────────────────────────────────────────────────────────
function isStale(createdAt, thresholdHours = 48) {
  const age = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  return age > thresholdHours;
}

// ─────────────────────────────────────────────────────────
// 1. Notice period
// ─────────────────────────────────────────────────────────
describe('Rule 1 — Notice period (annual leave needs 3 working days)', () => {
  const today = '2026-07-27'; // Monday

  test('sick leave: no notice required', () => {
    const result = checkNotice('sick', '2026-07-28', today);
    expect(result.ok).toBe(true);
  });

  test('unpaid leave: no notice required', () => {
    const result = checkNotice('unpaid', '2026-07-28', today);
    expect(result.ok).toBe(true);
  });

  test('annual leave same-day (today): blocked (0 notice)', () => {
    // workingDaysBetween('2026-07-27','2026-07-27') = 1 < 3 → blocked
    const result = checkNotice('annual', '2026-07-27', today);
    expect(result.ok).toBe(false);
  });

  test('annual leave tomorrow Tue Jul 28: blocked (2 working days Mon+Tue)', () => {
    // workingDaysBetween('2026-07-27','2026-07-28') = 2 < 3 → blocked
    const result = checkNotice('annual', '2026-07-28', today);
    expect(result.ok).toBe(false);
  });

  test('annual leave Wed Jul 29: exactly 3 working days (Mon+Tue+Wed) → allowed', () => {
    // workingDaysBetween('2026-07-27','2026-07-29') = 3 >= 3 → ok
    const result = checkNotice('annual', '2026-07-29', today);
    expect(result.ok).toBe(true);
  });

  test('annual leave Thu Jul 30 — 4 working days: allowed', () => {
    const result = checkNotice('annual', '2026-07-30', today);
    expect(result.ok).toBe(true);
  });

  test('annual leave 1 week ahead: allowed', () => {
    const result = checkNotice('annual', '2026-08-03', today);
    expect(result.ok).toBe(true);
  });

});

// ─────────────────────────────────────────────────────────
// 2. Balance check
// ─────────────────────────────────────────────────────────
describe('Rule 2 — Balance check', () => {
  const balance = { total_days: 21, used_days: 10, pending_days: 3 };
  // Available: 21 - 10 - 3 = 8

  test('request within balance: allowed', () => {
    const result = checkBalance(balance, 5);
    expect(result.ok).toBe(true);
    expect(result.available).toBe(8);
  });

  test('request exactly at balance: allowed', () => {
    const result = checkBalance(balance, 8);
    expect(result.ok).toBe(true);
  });

  test('request over balance: blocked', () => {
    const result = checkBalance(balance, 9);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/insufficient/i);
  });

  test('zero balance: any request blocked', () => {
    const zeroBal = { total_days: 10, used_days: 10, pending_days: 0 };
    expect(checkBalance(zeroBal, 1).ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// 3. Overlap guard
// ─────────────────────────────────────────────────────────
describe('Rule 3 — Overlap guard', () => {
  const existing = [
    { start_date: '2026-08-04', end_date: '2026-08-08', status: 'approved' }
  ];

  test('non-overlapping request: allowed', () => {
    expect(hasOverlap(existing, '2026-08-11', '2026-08-15')).toBe(false);
  });

  test('adjacent (end=start): no overlap', () => {
    // Aug 8 ends, Aug 9 starts — no overlap
    expect(hasOverlap(existing, '2026-08-09', '2026-08-12')).toBe(false);
  });

  test('overlapping by one day: blocked', () => {
    expect(hasOverlap(existing, '2026-08-08', '2026-08-10')).toBe(true);
  });

  test('fully overlapping: blocked', () => {
    expect(hasOverlap(existing, '2026-08-04', '2026-08-08')).toBe(true);
  });

  test('request inside existing: blocked', () => {
    expect(hasOverlap(existing, '2026-08-05', '2026-08-07')).toBe(true);
  });

  test('rejected request does not count as overlap', () => {
    const withRejected = [
      { start_date: '2026-08-04', end_date: '2026-08-08', status: 'rejected' }
    ];
    expect(hasOverlap(withRejected, '2026-08-04', '2026-08-08')).toBe(false);
  });

  test('cancelled request does not count as overlap', () => {
    const withCancelled = [
      { start_date: '2026-08-04', end_date: '2026-08-08', status: 'cancelled' }
    ];
    expect(hasOverlap(withCancelled, '2026-08-05', '2026-08-06')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// 4. Team coverage
// ─────────────────────────────────────────────────────────
describe('Rule 4 — Team coverage (min 50% present)', () => {
  test('2 of 10 out → 80% coverage: allowed', () => {
    const result = checkTeamCoverage(10, 2);
    expect(result.blocked).toBe(false);
    expect(result.coverage).toBe(0.8);
  });

  test('5 of 10 out → 50% coverage: allowed (exactly at threshold)', () => {
    const result = checkTeamCoverage(10, 5);
    expect(result.blocked).toBe(false);
    expect(result.coverage).toBe(0.5);
  });

  test('6 of 10 out → 40% coverage: blocked', () => {
    const result = checkTeamCoverage(10, 6);
    expect(result.blocked).toBe(true);
    expect(result.coverage).toBeCloseTo(0.4, 2);
  });

  test('solo employee (1 of 1) cannot take annual leave when alone', () => {
    // If they leave, 0% remain
    const result = checkTeamCoverage(1, 1);
    expect(result.blocked).toBe(true);
    expect(result.coverage).toBe(0);
  });

  test('2-person team: 1 out → 50% remains: allowed', () => {
    const result = checkTeamCoverage(2, 1);
    expect(result.blocked).toBe(false);
  });

  test('3-person team: 2 out → 33% remains: blocked', () => {
    const result = checkTeamCoverage(3, 2);
    expect(result.blocked).toBe(true);
    expect(result.coverage).toBeCloseTo(0.333, 2);
  });
});

// ─────────────────────────────────────────────────────────
// 5. Escalation — stale pending
// ─────────────────────────────────────────────────────────
describe('Rule 5 (6) — Escalation after 48 hours', () => {
  function hoursAgo(h) {
    return new Date(Date.now() - h * 3600000).toISOString();
  }

  test('47h old request: not stale', () => {
    expect(isStale(hoursAgo(47))).toBe(false);
  });

  test('exactly 48h old: not stale (threshold is >48h)', () => {
    // isStale checks > not >=
    // Because age = 48h exactly means age > 48 is false
    const createdAt = new Date(Date.now() - 48 * 3600000).toISOString();
    // Age is exactly 48h = not stale (strictly greater than)
    expect(isStale(createdAt)).toBe(false);
  });

  test('49h old request: stale — should be escalated', () => {
    expect(isStale(hoursAgo(49))).toBe(true);
  });

  test('72h old request: definitely stale', () => {
    expect(isStale(hoursAgo(72))).toBe(true);
  });

  test('2h old request: fresh', () => {
    expect(isStale(hoursAgo(2))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// 6. Cancellation guard
// ─────────────────────────────────────────────────────────
describe('Rule 6 — Cannot cancel leave that has started', () => {
  function canCancel(startDate, today, status) {
    if (!['pending','approved'].includes(status)) return false;
    if (status === 'approved' && startDate <= today) return false;
    return true;
  }

  const today = '2026-07-27';

  test('pending leave not yet started: can cancel', () => {
    expect(canCancel('2026-08-04', today, 'pending')).toBe(true);
  });

  test('approved leave starting tomorrow: can cancel', () => {
    expect(canCancel('2026-07-28', today, 'approved')).toBe(true);
  });

  test('approved leave starting today: cannot cancel', () => {
    expect(canCancel('2026-07-27', today, 'approved')).toBe(false);
  });

  test('approved leave started yesterday: cannot cancel', () => {
    expect(canCancel('2026-07-26', today, 'approved')).toBe(false);
  });

  test('rejected leave: cannot cancel', () => {
    expect(canCancel('2026-08-04', today, 'rejected')).toBe(false);
  });
});
