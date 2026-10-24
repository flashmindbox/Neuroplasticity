import { useLiveQuery } from 'dexie-react-hooks';
import type { DimensionId } from '../content/dimensions';
import { DEFAULT_EXAM_DATES, type ExamDates } from '../content/roadmap';
import { db } from './db';
import { todayKey, type DateKey } from './dates';
import { fogAuditExperiment } from './experiments';

export interface Charter {
  purpose: string;
  values: string;
  planB: string;
  supportContacts: string;
  targets: DimensionId[];
  profile: InterviewProfile;
  updatedAt: DateKey;
}

/** DAF-like profile used for the AI mock board. */
export interface InterviewProfile {
  name: string;
  homeState: string;
  education: string;
  work: string;
  hobbies: string;
  servicePreference: string;
  optional: string;
}

export interface SettingsMap {
  dates: ExamDates;
  charter: Charter | null;
  /** First-run welcome finished or skipped. */
  onboarded: boolean;
  setupDone: Record<string, boolean>;
  /** How AI second opinions run: copy/paste through your Claude subscription, or your own API key. */
  aiMode: 'subscription' | 'api';
  apiKey: string;
  aiAcknowledged: boolean;
  lastBackupAt: string | null;
  weeklyDone: Record<string, Record<string, boolean>>;
  writingSpeed: { date: DateKey; wpm: number }[];
}

export const EMPTY_PROFILE: InterviewProfile = {
  name: '',
  homeState: '',
  education: '',
  work: '',
  hobbies: '',
  servicePreference: '',
  optional: 'Political Science & International Relations',
};

export const EMPTY_CHARTER: Charter = {
  purpose: '',
  values: '',
  planB: '',
  supportContacts: 'Tele-MANAS: 14416 (free, 24×7)\n',
  targets: [],
  profile: EMPTY_PROFILE,
  updatedAt: '',
};

export function defaultSettings(today: DateKey = todayKey()): SettingsMap {
  return {
    dates: { programmeStart: today, ...DEFAULT_EXAM_DATES },
    charter: null,
    onboarded: false,
    setupDone: {},
    aiMode: 'subscription',
    apiKey: '',
    aiAcknowledged: false,
    lastBackupAt: null,
    weeklyDone: {},
    writingSpeed: [],
  };
}

export async function getSetting<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> {
  const row = await db.settings.get(key);
  return (row?.value as SettingsMap[K] | undefined) ?? defaultSettings()[key];
}

export async function setSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]) {
  await db.settings.put({ key, value });
}

/** First launch: fix the programme start date and set up the fog audit as experiment #1. */
export async function ensureInitialised() {
  await db.transaction('rw', db.settings, db.experiments, async () => {
    if (await db.settings.get('dates')) return;
    const dates = defaultSettings().dates;
    await setSetting('dates', dates);
    if ((await db.experiments.count()) === 0) {
      await db.experiments.add(fogAuditExperiment(dates.programmeStart));
    }
  });
}

export function useSetting<K extends keyof SettingsMap>(key: K): SettingsMap[K] | undefined {
  return useLiveQuery(() => getSetting(key), [key]);
}
