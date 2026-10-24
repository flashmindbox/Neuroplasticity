import { describe, expect, it } from 'vitest';
import { phaseFor, type ExamDates } from '../../src/content/roadmap';
import { dailyProtocol, weeklyProtocol } from '../../src/content/protocol';

const dates: ExamDates = {
  programmeStart: '2026-10-26',
  prelims: '2027-05-23',
  mains: '2027-08-20',
  interview: '2028-02-01',
};

describe('phaseFor', () => {
  it('starts in the 2-week diagnose phase at 30 minutes', () => {
    const s = phaseFor('2026-10-26', dates);
    expect(s).toMatchObject({ phase: 'diagnose', week: 1, doseMinutes: 30, deload: false });
    expect(phaseFor('2026-11-08', dates).phase).toBe('diagnose');
  });

  it('moves to build after 14 days and ramps the dose', () => {
    const w1 = phaseFor('2026-11-09', dates);
    expect(w1).toMatchObject({ phase: 'build', phaseWeek: 1, doseMinutes: 45 });
    const w5 = phaseFor('2026-12-07', dates);
    expect(w5.phaseWeek).toBe(5);
    expect(w5.doseMinutes).toBe(75);
  });

  it('enters Prelims mind 15 weeks before Prelims and tapers in the last 10 days', () => {
    expect(phaseFor('2027-02-06', dates).phase).toBe('build');
    expect(phaseFor('2027-02-07', dates).phase).toBe('prelims');
    const taper = phaseFor('2027-05-15', dates);
    expect(taper).toMatchObject({ phase: 'prelims', taper: true, doseMinutes: 30, deload: false });
    expect(phaseFor('2027-05-23', dates)).toMatchObject({ examWeek: 'prelims', doseMinutes: 15 });
  });

  it('runs Mains mind until the five Mains days end, then the interview phase', () => {
    expect(phaseFor('2027-05-24', dates).phase).toBe('mains');
    expect(phaseFor('2027-08-22', dates)).toMatchObject({ phase: 'mains', examWeek: 'mains' });
    expect(phaseFor('2027-08-25', dates).phase).toBe('interview');
  });

  it('halves the dose in every sixth programme week outside tapers', () => {
    const wk6 = phaseFor('2026-11-30', dates); // day 35 → week 6
    expect(wk6.week).toBe(6);
    expect(wk6.deload).toBe(true);
    // Build week 4 → 67.5 min, halved.
    expect(wk6.phaseWeek).toBe(4);
    expect(wk6.doseMinutes).toBe(34);
  });

  it('counts days to the exams', () => {
    const s = phaseFor('2026-10-26', dates);
    expect(s.daysToPrelims).toBe(209);
    expect(s.daysToMains).toBe(298);
  });
});

describe('protocol', () => {
  it('keeps diagnose light: no drill or talk', () => {
    const ids = dailyProtocol('2026-10-28', phaseFor('2026-10-28', dates)).map((i) => i.id);
    expect(ids).not.toContain('drill');
    expect(ids).not.toContain('talk');
    expect(ids).toEqual(
      expect.arrayContaining(['wake', 'attention', 'journal', 'quicklog', 'exercise']),
    );
  });

  it('adds drills in build and talks on Mon/Wed/Fri', () => {
    const monday = '2026-11-16';
    const tuesday = '2026-11-17';
    expect(dailyProtocol(monday, phaseFor(monday, dates)).map((i) => i.id)).toEqual(
      expect.arrayContaining(['drill', 'talk']),
    );
    expect(dailyProtocol(tuesday, phaseFor(tuesday, dates)).map((i) => i.id)).not.toContain('talk');
  });

  it('drops drills and talks during the taper', () => {
    const d = '2027-05-17';
    const ids = dailyProtocol(d, phaseFor(d, dates)).map((i) => i.id);
    expect(ids).not.toContain('drill');
    expect(ids).not.toContain('talk');
  });

  it('adds phase-specific weekly items', () => {
    expect(weeklyProtocol(phaseFor('2027-03-01', dates)).map((i) => i.id)).toContain('mock');
    expect(weeklyProtocol(phaseFor('2027-10-01', dates)).map((i) => i.id)).toContain('board');
  });
});
