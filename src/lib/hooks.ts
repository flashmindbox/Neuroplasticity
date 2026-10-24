import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { dailyProtocol } from '../content/protocol';
import { phaseFor, type ExamDates, type PhaseState } from '../content/roadmap';
import { db, type DailyLog } from './db';
import { todayKey, weekStart, type DateKey } from './dates';
import { ticksFor, weeklyTicksFor, type Activity, type ProgressInput } from './mentor';
import { getSetting, setSetting, useSetting } from './settings';
import { dayStatus, type DayStatus } from './streak';

/** A checkbox value that shows the new state at once and keeps it until the stored value catches up. */
export function useOptimistic(checked: boolean) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [prev, setPrev] = useState(checked);
  if (prev !== checked) {
    setPrev(checked);
    setPending(null);
  }
  return [pending ?? checked, setPending] as const;
}

/** The current hour, refreshed every minute so time-of-day advice stays current. */
export function useHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);
  return hour;
}

/** Today's date key; rolls over at midnight while the app is open. */
export function useToday(): DateKey {
  const [today, setToday] = useState(todayKey());
  useEffect(() => {
    const id = setInterval(() => setToday(todayKey()), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

export interface Programme {
  today: DateKey;
  dates: ExamDates;
  state: PhaseState;
}

export function useProgramme(): Programme | undefined {
  const today = useToday();
  const dates = useSetting('dates');
  return useMemo(
    () => (dates ? { today, dates, state: phaseFor(today, dates) } : undefined),
    [today, dates],
  );
}

export function useDailyLog(date: DateKey): DailyLog | undefined {
  return useLiveQuery(() => db.dailyLogs.get(date), [date]);
}

export async function patchDailyLog(date: DateKey, patch: Partial<Omit<DailyLog, 'date'>>) {
  await db.transaction('rw', db.dailyLogs, async () => {
    const existing = (await db.dailyLogs.get(date)) ?? { date, checks: {}, mvd: false };
    await db.dailyLogs.put({ ...existing, ...patch, date });
  });
}

export async function toggleCheck(date: DateKey, id: string, value: boolean) {
  await db.transaction('rw', db.dailyLogs, async () => {
    const existing = (await db.dailyLogs.get(date)) ?? { date, checks: {}, mvd: false };
    await db.dailyLogs.put({ ...existing, checks: { ...existing.checks, [id]: value } });
  });
}

/** Ticks everything an activity completed today and this week, so nothing is entered twice. */
export async function recordActivity(date: DateKey, activity: Activity) {
  const ids = ticksFor(activity);
  if (ids.length) {
    await db.transaction('rw', db.dailyLogs, async () => {
      const existing = (await db.dailyLogs.get(date)) ?? { date, checks: {}, mvd: false };
      const checks = { ...existing.checks };
      for (const id of ids) checks[id] = true;
      await db.dailyLogs.put({ ...existing, checks });
    });
  }
  const weekly = weeklyTicksFor(activity);
  if (weekly.length) {
    const week = weekStart(date);
    await db.transaction('rw', db.settings, async () => {
      const done = await getSetting('weeklyDone');
      const thisWeek = { ...done[week] };
      for (const id of weekly) thisWeek[id] = true;
      await setSetting('weeklyDone', { ...done, [week]: thisWeek });
    });
  }
}

/** "Not today": the step stays unticked and the mentor moves on. */
export async function skipStep(date: DateKey, id: string) {
  await db.transaction('rw', db.dailyLogs, async () => {
    const existing = (await db.dailyLogs.get(date)) ?? { date, checks: {}, mvd: false };
    await db.dailyLogs.put({ ...existing, skipped: { ...existing.skipped, [id]: true } });
  });
}

/** Planned checklist ids for a day: the protocol plus your active targets. */
export function plannedIds(date: DateKey, dates: ExamDates, targets: string[]): string[] {
  return [
    ...dailyProtocol(date, phaseFor(date, dates)).map((i) => i.id),
    ...targets.map((t) => `target-${t}`),
  ];
}

export async function currentTargets(): Promise<string[]> {
  return (await getSetting('charter'))?.targets ?? [];
}

export type ProgressData = ProgressInput & { weeklyReviews: number };

/** Everything the mentor needs to show visible progress, from the whole history. */
export function useProgressData(
  prog: Programme | undefined,
  targets: string[],
): ProgressData | undefined {
  const logs = useLiveQuery(() => db.dailyLogs.toArray(), []);
  const sessions = useLiveQuery(() => db.focusSessions.toArray(), []);
  const drills = useLiveQuery(() => db.drills.toArray(), []);
  const talks = useLiveQuery(() => db.talks.toArray(), []);
  const brainChecks = useLiveQuery(() => db.brainChecks.toArray(), []);
  const weeklyReviews = useLiveQuery(() => db.weeklyReviews.count(), []);
  return useMemo(() => {
    if (!prog || !logs || !sessions || !drills || !talks || !brainChecks || weeklyReviews == null)
      return undefined;
    const byDate = new Map(logs.map((l) => [l.date, l]));
    const cache = new Map<DateKey, DayStatus>();
    const statusOf = (d: DateKey) => {
      let s = cache.get(d);
      if (!s) {
        s = dayStatus(byDate.get(d), plannedIds(d, prog.dates, targets));
        cache.set(d, s);
      }
      return s;
    };
    return {
      today: prog.today,
      programmeStart: prog.dates.programmeStart,
      logs,
      sessions,
      drills,
      talks,
      brainChecks,
      statusOf,
      weeklyReviews,
    };
  }, [prog, targets, logs, sessions, drills, talks, brainChecks, weeklyReviews]);
}
