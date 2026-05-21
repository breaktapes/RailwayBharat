import { describe, it, expect } from 'vitest';
import { trainRunsToday, getDayBit } from './client';

describe('trainRunsToday', () => {
  // bit 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const monday = new Date('2026-05-25'); // a Monday
  const sunday = new Date('2026-05-24'); // a Sunday

  it('returns true when train runs on Monday and today is Monday', () => {
    const mondayBit = 1 << 1; // bit 1
    expect(trainRunsToday(mondayBit, monday)).toBe(true);
  });

  it('returns false when train does not run on Monday', () => {
    const allExceptMonday = 0b1111101; // all days except bit 1 (Monday)
    expect(trainRunsToday(allExceptMonday, monday)).toBe(false);
  });

  it('returns true for runs_on=127 (every day) on any day', () => {
    expect(trainRunsToday(127, monday)).toBe(true);
    expect(trainRunsToday(127, sunday)).toBe(true);
  });

  it('handles Sunday (bit 0) correctly', () => {
    const sundayOnly = 1 << 0; // bit 0
    expect(trainRunsToday(sundayOnly, sunday)).toBe(true);
    expect(trainRunsToday(sundayOnly, monday)).toBe(false);
  });
});

describe('getDayBit', () => {
  it('returns 0 for Sunday', () => {
    expect(getDayBit(new Date('2026-05-24'))).toBe(0);
  });

  it('returns 1 for Monday', () => {
    expect(getDayBit(new Date('2026-05-25'))).toBe(1);
  });

  it('returns 6 for Saturday', () => {
    expect(getDayBit(new Date('2026-05-30'))).toBe(6);
  });
});
