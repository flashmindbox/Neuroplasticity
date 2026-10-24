import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { dailyProtocol } from '../content/protocol';
import { phaseFor, type ExamDates, type PhaseState } from '../content/roadmap';
import { db, type DailyLog } from './db';
import { todayKey, type DateKey } from './dates';
import { getSetting, useSetting } from './settings';

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
