import { test, expect } from '@playwright/test';
import { calculateWorkDays } from '../lib/kpiCalculations.js';

/**
 * Validates Fix 5: calculateWorkDays excludes holidays.
 * Unit test (no browser) — tests the function directly.
 */

test.describe('Holiday-aware working days', () => {
  test('excludes weekends only when no holidays provided', () => {
    // Monday July 6, 2026 to Friday July 10, 2026 = 5 working days
    const result = calculateWorkDays('2026-07-06', '2026-07-10');
    expect(result).toBe(5);
  });

  test('excludes a holiday that falls on a weekday', () => {
    // Monday July 6 to Friday July 10, with July 7 (Tuesday) as a holiday = 4 working days
    const result = calculateWorkDays('2026-07-06', '2026-07-10', ['2026-07-07']);
    expect(result).toBe(4);
  });

  test('excludes multiple holidays', () => {
    // Monday July 6 to Friday July 10, with July 7 + July 8 as holidays = 3 working days
    const result = calculateWorkDays('2026-07-06', '2026-07-10', ['2026-07-07', '2026-07-08']);
    expect(result).toBe(3);
  });

  test('ignores holidays that fall on weekends', () => {
    // Monday July 6 to Friday July 10, with July 11 (Saturday) as a "holiday" = 5 working days (weekend already excluded)
    const result = calculateWorkDays('2026-07-06', '2026-07-10', ['2026-07-11']);
    expect(result).toBe(5);
  });

  test('returns 0 when end is before start', () => {
    const result = calculateWorkDays('2026-07-10', '2026-07-06', ['2026-07-07']);
    expect(result).toBe(0);
  });

  test('returns empty string for missing inputs', () => {
    expect(calculateWorkDays(null, '2026-07-10')).toBe('');
    expect(calculateWorkDays('2026-07-06', null)).toBe('');
  });

  test('handles empty holidays array (backward compatible)', () => {
    const result = calculateWorkDays('2026-07-06', '2026-07-10', []);
    expect(result).toBe(5);
  });
});
