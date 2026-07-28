'use strict';

/**
 * Count working days (Mon–Fri) between two dates inclusive.
 * @param {string}
 * @param {string} 
 * @returns {number}
 */

function workingDaysBetween(startStr, endStr) {
  let count = 0;
  const start = new Date(startStr);
  const end   = new Date(endStr);
  const cur   = new Date(start);

  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Count working days in a full calendar month.
 * @param {number} 
 * @param {number} 
 * @returns {number}
 */

function workingDaysInMonth(month, year) {
  const lastDay = new Date(year, month, 0).getDate();
  const start   = `${year}-${String(month).padStart(2,'0')}-01`;
  const end     = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  return workingDaysBetween(start, end);
}

const countWorkingDays = workingDaysBetween;

module.exports = { workingDaysBetween, workingDaysInMonth, countWorkingDays };
