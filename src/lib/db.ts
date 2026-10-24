// Local-first storage (IndexedDB via Dexie). Nothing leaves the device unless you press an AI button.
import Dexie, { type EntityTable } from 'dexie';
import type { DimensionId } from '../content/dimensions';
import type { ScreeningKind } from '../content/screening';
import type { MockBuckets } from './calibration';
import type { DateKey } from './dates';

export interface DailyLog {
  date: DateKey;
  checks: Record<string, boolean>;
  mvd: boolean;
  sleepHours?: number;
  exerciseMin?: number;
  stress?: number;
  mood?: number;
  energy?: number;
  clarityAM?: number;
  clarityPM?: number;
  /** Hours between last caffeine and bedtime. */
  caffeineGapHours?: number;
  screenHours?: number;
  note?: string;
}

export type SessionKind = 'attention' | 'focus' | 'breath' | 'focustest';

export interface FocusSession {
  id?: number;
  date: DateKey;
  kind: SessionKind;
  plannedMin: number;
  actualMin: number;
  intention?: string;
  wanders?: number;
  quality?: number;
  review?: string;
  /** Focus test: share of thought probes answered "on task". */
  onTaskPct?: number;
}

export interface AiEvaluation {
  scores: Record<string, number>;
  strength: string;
  fix: string;
  improved: string;
  overall: number;
  model: string;
  at: string;
}

export interface DrillEntry {
  id?: number;
  date: DateKey;
  type: string;
  prompt: string;
  response: string;
  durationSec: number;
  selfScores: Record<string, number>;
  ai?: AiEvaluation;
  /** Calibration quiz: per statement confidence and correctness. */
  calibration?: { confidence: number; correct: boolean }[];
}

export interface JournalEntry {
  id?: number;
  date: DateKey;
  win: string;
  emotions: string[];
  lesson: string;
  ifThen: string;
  gratitude?: string;
}

export interface EvidenceEntry {
  id?: number;
  date: DateKey;
  dimension: DimensionId;
  text: string;
}

export interface Woop {
  id?: number;
  createdAt: DateKey;
  wish: string;
  outcome: string;
  obstacle: string;
  plan: string;
  active: boolean;
}

export interface Story {
  id?: number;
  date: DateKey;
  situation: string;
  action: string;
  result: string;
  learned: string;
}

export interface WeeklyReview {
  weekStart: DateKey;
  worked: string;
  change: string;
  ruleActions: string;
  lowestSource: string;
  nextWeek: string;
  metrics: Record<string, number | null>;
}

export interface RatingSet {
  id?: number;
  date: DateKey;
  source: 'self' | 'external';
  ratings: Partial<Record<DimensionId, number>>;
  note?: string;
}

export type MockKind = 'prelims-gs' | 'csat' | 'mains-sim';

export interface MockEntry {
  id?: number;
  date: DateKey;
  name: string;
  kind: MockKind;
  buckets: MockBuckets;
  skipped: number;
  preStress?: number;
  composure?: number;
  firstHalfQuality?: number;
  lastHalfQuality?: number;
  notes?: string;
}

export interface TalkEntry {
  id?: number;
  date: DateKey;
  prompt: string;
  audio?: Blob;
  durationSec: number;
  transcript: string;
  wpm: number | null;
  fillers: number;
  selfScores: Record<string, number>;
  ai?: AiEvaluation;
}

export interface ScreeningEntry {
  id?: number;
  date: DateKey;
  kind: ScreeningKind;
  answers: number[];
  total: number;
}

export interface BrainCheckEntry {
  id?: number;
  date: DateKey;
  rtMedianMs: number;
  symbolCorrect: number;
  symbolErrors: number;
  spanForward: number;
  spanBackward: number;
}

export interface Experiment {
  id?: number;
  title: string;
  metric: string;
  baselineStart: DateKey;
  interventionStart: DateKey;
  end: DateKey;
  status: 'running' | 'done';
  decision?: 'keep' | 'drop' | 'retest';
  note?: string;
}

export interface InterviewMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface InterviewDebrief {
  scores: Record<string, number>;
  strengths: string[];
  improvements: string[];
  summary: string;
}

export interface InterviewSession {
  id?: number;
  date: DateKey;
  messages: InterviewMessage[];
  debrief?: InterviewDebrief;
}

export interface AiUsage {
  id?: number;
  date: DateKey;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export class RewireDB extends Dexie {
  settings!: EntityTable<Setting, 'key'>;
  dailyLogs!: EntityTable<DailyLog, 'date'>;
  focusSessions!: EntityTable<FocusSession, 'id'>;
  drills!: EntityTable<DrillEntry, 'id'>;
  journal!: EntityTable<JournalEntry, 'id'>;
  evidence!: EntityTable<EvidenceEntry, 'id'>;
  woops!: EntityTable<Woop, 'id'>;
  stories!: EntityTable<Story, 'id'>;
  weeklyReviews!: EntityTable<WeeklyReview, 'weekStart'>;
  ratings!: EntityTable<RatingSet, 'id'>;
  mocks!: EntityTable<MockEntry, 'id'>;
  talks!: EntityTable<TalkEntry, 'id'>;
  screenings!: EntityTable<ScreeningEntry, 'id'>;
  brainChecks!: EntityTable<BrainCheckEntry, 'id'>;
  experiments!: EntityTable<Experiment, 'id'>;
  interviews!: EntityTable<InterviewSession, 'id'>;
  aiUsage!: EntityTable<AiUsage, 'id'>;

  constructor(name = 'rewire') {
    super(name);
    this.version(1).stores({
      settings: 'key',
      dailyLogs: 'date',
      focusSessions: '++id, date, kind',
      drills: '++id, date, type',
      journal: '++id, date',
      evidence: '++id, date, dimension',
      woops: '++id, createdAt, active',
      stories: '++id, date',
      weeklyReviews: 'weekStart',
      ratings: '++id, date, source',
      mocks: '++id, date, kind',
      talks: '++id, date',
      screenings: '++id, date, kind',
      brainChecks: '++id, date',
      experiments: '++id, status',
      interviews: '++id, date',
      aiUsage: '++id, date',
    });
  }
}

export const db = new RewireDB();

export const TABLE_NAMES = [
  'settings',
  'dailyLogs',
  'focusSessions',
  'drills',
  'journal',
  'evidence',
  'woops',
  'stories',
  'weeklyReviews',
  'ratings',
  'mocks',
  'talks',
  'screenings',
  'brainChecks',
  'experiments',
  'interviews',
  'aiUsage',
] as const;

export type TableName = (typeof TABLE_NAMES)[number];
