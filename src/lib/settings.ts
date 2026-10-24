import { useLiveQuery } from 'dexie-react-hooks';
import type { DimensionId } from '../content/dimensions';
import { DEFAULT_EXAM_DATES, type ExamDates } from '../content/roadmap';
import { db } from './db';
import { todayKey, type DateKey } from './dates';

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
  setupDone: Record<string, boolean>;
  apiKey: string;
  aiAcknowledged: boolean;
  lastBackupAt: string | null;
  weeklyDone: Record<string, Record<string, boolean>>;
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

export function defaultSettings(today: DateKey = todayKey()): SettingsMap {
  return {
    dates: { programmeStart: today, ...DEFAULT_EXAM_DATES },
    charter: null,
    setupDone: {},
    apiKey: '',
    aiAcknowledged: false,
    lastBackupAt: null,
    weeklyDone: {},
  };
}

export async function getSetting<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> {
  const row = await db.settings.get(key);
  return (row?.value as SettingsMap[K] | undefined) ?? defaultSettings()[key];
}

export async function setSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]) {
  await db.settings.put({ key, value });
}

/** Persist the programme start date the first time the app opens. */
export async function ensureInitialised() {
  if (!(await db.settings.get('dates'))) {
    await setSetting('dates', defaultSettings().dates);
  }
}

export function useSetting<K extends keyof SettingsMap>(key: K): SettingsMap[K] | undefined {
  return useLiveQuery(() => getSetting(key), [key]);
}
