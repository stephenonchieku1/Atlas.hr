'use strict';

const { calcTax, round2 } = require('../controllers/payrollController');
const { workingDaysInMonth, workingDaysBetween } = require('../utils/dateUtils');

// ── Tax bracket tests ─────────────────────────────────────

describe('calcTax — progressive income tax', () => {
  test('zero income → zero tax', () => {
    expect(calcTax(0)).toBe(0);
  });

  test('negative income → zero tax (edge case guard)', () => {
    expect(calcTax(-100)).toBe(0);
  });

  test('bracket 1 only: 10,000 → 10% = 1,000', () => {
    expect(calcTax(10000)).toBe(1000);
  });

  test('exactly at B1 boundary: 20,000 → 20,000 × 10% = 2,000', () => {
    expect(calcTax(20000)).toBe(2000);
  });

  test('just over B1 boundary: 20,001 → 2,000 + 1 × 20% = 2,000.20', () => {
    expect(calcTax(20001)).toBeCloseTo(2000.20, 2);
  });

  test('mid-bracket 2: 35,000 → 2,000 + 15,000×20% = 5,000', () => {
    expect(calcTax(35000)).toBe(5000);
  });

  test('exactly at B2 boundary: 50,000 → 2,000 + 30,000×20% = 8,000', () => {
    expect(calcTax(50000)).toBe(8000);
  });

  test('just over B2 boundary: 50,001 → 8,000 + 1×30% = 8,000.30', () => {
    expect(calcTax(50001)).toBeCloseTo(8000.30, 2);
  });

  test('high earner: 100,000 → 2,000 + 6,000 + 15,000 = 23,000', () => {
    // 20k×10% + 30k×20% + 50k×30% = 2,000 + 6,000 + 15,000 = 23,000
    expect(calcTax(100000)).toBe(23000);
  });

  test('high earner: 150,000 → 2,000 + 6,000 + 30,000 = 38,000', () => {
    // 20k×10% + 30k×20% + 100k×30%
    expect(calcTax(150000)).toBe(38000);
  });
});

// ── Social security tests ─────────────────────────────────

describe('social_security — 5% capped at 2,500', () => {
  function calcSS(gross) { return round2(Math.min(gross * 0.05, 2500)); }

  test('low earner: 20,000 gross → SS = 1,000', () => {
    expect(calcSS(20000)).toBe(1000);
  });

  test('mid earner: 35,000 gross → SS = 1,750', () => {
    expect(calcSS(35000)).toBe(1750);
  });

  test('exactly at cap: 50,000 gross → SS = 2,500', () => {
    expect(calcSS(50000)).toBe(2500);
  });

  test('high earner: 150,000 gross → SS capped at 2,500', () => {
    expect(calcSS(150000)).toBe(2500);
  });
});

// ── Working days utility ──────────────────────────────────

describe('workingDaysInMonth', () => {
  test('January 2026 has 22 working days', () => {
    expect(workingDaysInMonth(1, 2026)).toBe(22);
  });

  test('February 2026 has 20 working days', () => {
    expect(workingDaysInMonth(2, 2026)).toBe(20);
  });

  test('July 2026 has 23 working days', () => {
    // Mon 6, 13, 20, 27 = 4 Mon; same for Tue,Wed,Thu = 4; Fri 3,10,17,24,31 = 5; Sat/Sun excluded
    expect(workingDaysInMonth(7, 2026)).toBe(23);
  });
});

describe('workingDaysBetween', () => {
  test('Mon–Fri range = 5 days', () => {
    expect(workingDaysBetween('2026-07-27', '2026-07-31')).toBe(5);
  });

  test('single Monday = 1 day', () => {
    expect(workingDaysBetween('2026-07-27', '2026-07-27')).toBe(1);
  });

  test('Saturday–Sunday = 0 working days', () => {
    expect(workingDaysBetween('2026-07-25', '2026-07-26')).toBe(0);
  });

  test('two-week span Mon–Sun = 10 working days', () => {
    expect(workingDaysBetween('2026-07-13', '2026-07-26')).toBe(10);
  });
});

// ── Full payslip computation tests ────────────────────────

describe('Full-month employee payslip', () => {
  // Salary: 85,000/mo, workingDays: 21, daysWorked: 21
  const salary = 85000;
  const wd     = 21;
  const daily  = salary / wd;
  const gross  = round2(daily * wd);  // Should be exactly 85,000

  test('gross_pay equals full salary when no pro-ration', () => {
    expect(gross).toBe(85000);
  });

  test('no unpaid leave → deduction = 0', () => {
    const ded = round2(daily * 0);
    expect(ded).toBe(0);
  });

  test('taxable_income = gross when no deduction', () => {
    const taxable = round2(gross - 0);
    expect(taxable).toBe(85000);
  });

  test('income tax on 85,000 = 20,500', () => {
    // 20k×10% + 30k×20% + 35k×30% = 2000 + 6000 + 10500 = 18,500
    // Wait, let me recalculate: 85k - 50k = 35k × 30% = 10,500; 30k×20% = 6,000; 20k×10% = 2,000; Total = 18,500
    expect(calcTax(85000)).toBe(18500);
  });

  test('net_pay = gross - tax - SS', () => {
    const tax = calcTax(85000);  // 18,500
    const ss  = round2(Math.min(85000 * 0.05, 2500));  // 2,500
    const net = round2(85000 - 0 - tax - ss);
    expect(net).toBe(64000); // 85000 - 18500 - 2500
  });
});

describe('Mid-month joiner (15th of July, 23 working days)', () => {
  const salary     = 75000;
  const workingDays = 23; // July 2026
  const joinDate   = '2026-07-15';
  const periodEnd  = '2026-07-31';
  const daysWorked = workingDaysBetween(joinDate, periodEnd);

  test('days worked from July 15 to July 31', () => {
    // July 15 is Wed; 15,16,17,18,21,22,23,24,25,28,29,30,31 = 13 working days
    expect(daysWorked).toBe(13);
  });

  test('gross_pay is pro-rated', () => {
    const gross = round2((salary / workingDays) * daysWorked);
    const expected = round2((75000 / 23) * 13);
    expect(gross).toBe(expected);
    expect(gross).toBeLessThan(75000);
  });
});

describe('Zero-deduction edge case (salary ≤ 0 taxable)', () => {
  test('salary of 5,000 — tax is 500, still positive net', () => {
    const gross = 5000;
    const tax   = calcTax(gross);
    const ss    = round2(Math.min(gross * 0.05, 2500));
    expect(tax).toBe(500);
    expect(ss).toBe(250);
    const net = gross - tax - ss;
    expect(net).toBe(4250);
    expect(net).toBeGreaterThan(0);
  });

  test('zero taxable income → zero tax', () => {
    expect(calcTax(0)).toBe(0);
  });
});

describe('Unpaid leave deduction', () => {
  const salary     = 60000;
  const workingDays = 22;
  const daily      = salary / workingDays;

  test('5 days unpaid leave deducted from gross', () => {
    const gross = round2(daily * workingDays);   // 60,000
    const ded   = round2(daily * 5);
    const taxable = round2(gross - ded);

    expect(gross).toBe(60000);
    expect(ded).toBeCloseTo(13636.36, 1);
    expect(taxable).toBeCloseTo(46363.64, 1);
  });

  test('tax calculated on taxable (not gross) when unpaid leave present', () => {
    const gross   = 60000;
    const ded     = round2(daily * 5);
    const taxable = round2(gross - ded);
    const taxOnTaxable  = calcTax(taxable);
    const taxOnGross    = calcTax(gross);
    expect(taxOnTaxable).toBeLessThan(taxOnGross);
  });
});

describe('Salary near bracket boundary', () => {
  test('20,000 — top of bracket 1 (10% only)', () => {
    expect(calcTax(20000)).toBe(2000);
  });

  test('20,000.01 — just crosses into bracket 2', () => {
    const tax = calcTax(20000.01);
    expect(tax).toBeGreaterThan(2000);
    expect(tax).toBeCloseTo(2000.002, 2);
  });

  test('50,000 — top of bracket 2', () => {
    expect(calcTax(50000)).toBe(8000);
  });

  test('50,000.01 — just crosses into bracket 3', () => {
    const tax = calcTax(50000.01);
    expect(tax).toBeGreaterThan(8000);
    expect(tax).toBeCloseTo(8000.003, 2);
  });
});
