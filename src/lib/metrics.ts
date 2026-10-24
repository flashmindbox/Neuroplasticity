import type { DailyLog, FocusSession, MockEntry } from './db';
import { addDays, rangeKeys, type DateKey } from './dates';
import { mean, pearson, round } from './stats';
import { completionRatio } from './streak';

export interface WeekMetrics {
  habitPct: number | null;
  focusMinutes: number;
  attentionSessions: number;
  avgSleep: number | null;
  exerciseDays: number;
  avgStress: number | null;
  avgClarity: number | null;
  mocks: number;
}

export function clarityOf(log: DailyLog | undefined): number | null {
  return mean([log?.clarityAM, log?.clarityPM].filter((v): v is number => v != null));
}

export function weekMetrics(
  weekStart: DateKey,
  logs: Map<DateKey, DailyLog>,
  sessions: FocusSession[],
  mocks: MockEntry[],
  plannedIdsFor: (date: DateKey) => string[],
  today: DateKey,
): WeekMetrics {
  const days = rangeKeys(weekStart, addDays(weekStart, 6)).filter((d) => d <= today);
  const inWeek = (d: DateKey) => d >= weekStart && d <= addDays(weekStart, 6);
  const ratios = days.map((d) => completionRatio(logs.get(d), plannedIdsFor(d)));
  const dayLogs = days.map((d) => logs.get(d)).filter((l): l is DailyLog => !!l);
  const nums = (pick: (l: DailyLog) => number | undefined | null) =>
    dayLogs.map(pick).filter((v): v is number => v != null);

  const avg = (xs: number[]) => {
    const m = mean(xs);
    return m == null ? null : round(m, 1);
  };
  return {
    habitPct: ratios.length ? Math.round((mean(ratios) ?? 0) * 100) : null,
    focusMinutes: sessions
      .filter((s) => inWeek(s.date) && s.kind === 'focus')
      .reduce((sum, s) => sum + s.actualMin, 0),
    attentionSessions: sessions.filter((s) => inWeek(s.date) && s.kind === 'attention').length,
    avgSleep: avg(nums((l) => l.sleepHours)),
    exerciseDays: dayLogs.filter((l) => (l.exerciseMin ?? 0) >= 20).length,
    avgStress: avg(nums((l) => l.stress)),
    avgClarity: avg(dayLogs.map(clarityOf).filter((v): v is number => v != null)),
    mocks: mocks.filter((m) => inWeek(m.date)).length,
  };
}

export interface FogFactor {
  id: keyof DailyLog;
  label: string;
  r: number | null;
  n: number;
}

const FOG_FACTORS: { id: keyof DailyLog; label: string }[] = [
  { id: 'sleepHours', label: 'Sleep hours' },
  { id: 'exerciseMin', label: 'Exercise minutes' },
  { id: 'caffeineGapHours', label: 'Hours from last caffeine to bed' },
  { id: 'screenHours', label: 'Leisure screen hours' },
  { id: 'stress', label: 'Stress' },
];

/** Correlation of daily clarity with each logged factor (association, not causation). */
export function fogAudit(logs: DailyLog[]): FogFactor[] {
  return FOG_FACTORS.map(({ id, label }) => {
    const pairs = logs
      .map((l) => [l[id], clarityOf(l)] as const)
      .filter((p): p is readonly [number, number] => typeof p[0] === 'number' && p[1] != null)
      .map(([x, y]) => [x, y] as [number, number]);
    const r = pairs.length >= 7 ? pearson(pairs) : null;
    return { id, label, r: r == null ? null : round(r, 2), n: pairs.length };
  });
}
