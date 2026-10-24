// Day completion and the "never miss twice" rule (handbook/00-foundations/programme-rules.md).
import { LIGHT_SKIP_IDS, MVD_ITEMS } from '../content/protocol';
import { addDays, type DateKey } from './dates';
import type { DailyLog } from './db';

export type DayStatus = 'done' | 'mvd' | 'missed';

/** A day counts when at least half of its planned items are ticked, or the minimum viable day is complete. */
export const DONE_THRESHOLD = 0.5;

/** What a day actually asked of you: a light day leaves out the drill and the talk. */
export function effectivePlan(log: DailyLog | undefined, plannedIds: string[]): string[] {
  return log?.light ? plannedIds.filter((id) => !LIGHT_SKIP_IDS.includes(id)) : plannedIds;
}

export function dayStatus(log: DailyLog | undefined, plannedIds: string[]): DayStatus {
  if (!log) return 'missed';
  if (log.mvd && MVD_ITEMS.every((i) => log.checks[i.id])) return 'mvd';
  const planned = effectivePlan(log, plannedIds);
  if (planned.length === 0) return 'missed';
  const done = planned.filter((id) => log.checks[id]).length;
  return done / planned.length >= DONE_THRESHOLD ? 'done' : 'missed';
}

export function completionRatio(log: DailyLog | undefined, plannedIds: string[]): number {
  if (!log || plannedIds.length === 0) return 0;
  if (log.mvd) return MVD_ITEMS.filter((i) => log.checks[i.id]).length / MVD_ITEMS.length;
  const planned = effectivePlan(log, plannedIds);
  return planned.length ? planned.filter((id) => log.checks[id]).length / planned.length : 0;
}

export interface ChainInfo {
  /** Days in the current chain (single misses don't break it; two in a row do). */
  length: number;
  singleMisses: number;
  /** True when yesterday and the day before were both missed. */
  doubleMissNow: boolean;
}

/**
 * Walks back from `today`. Today only counts if it is already complete — an unfinished
 * today is not a miss yet.
 */
export function neverMissTwiceChain(
  today: DateKey,
  start: DateKey,
  statusOf: (date: DateKey) => DayStatus,
): ChainInfo {
  let length = 0;
  let singleMisses = 0;
  let prevMissed = false;
  let day = statusOf(today) === 'missed' ? addDays(today, -1) : today;
  const doubleMissNow =
    addDays(today, -2) >= start &&
    statusOf(addDays(today, -1)) === 'missed' &&
    statusOf(addDays(today, -2)) === 'missed';

  while (day >= start) {
    const missed = statusOf(day) === 'missed';
    if (missed && prevMissed) {
      // The later miss was already counted; remove it — the chain broke here.
      length -= 1;
      singleMisses -= 1;
      break;
    }
    length += 1;
    if (missed) singleMisses += 1;
    prevMissed = missed;
    day = addDays(day, -1);
  }
  return { length: Math.max(0, length), singleMisses: Math.max(0, singleMisses), doubleMissNow };
}
