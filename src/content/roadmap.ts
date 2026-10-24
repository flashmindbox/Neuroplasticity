import { addDays, daysBetween, type DateKey } from '../lib/dates';

export interface ExamDates {
  programmeStart: DateKey;
  prelims: DateKey;
  mains: DateKey;
  interview: DateKey;
}

// UPSC calendar 2027 (verify on upsc.gov.in). Interview is an estimate; edit in Settings.
export const DEFAULT_EXAM_DATES: Omit<ExamDates, 'programmeStart'> = {
  prelims: '2027-05-23',
  mains: '2027-08-20',
  interview: '2028-02-01',
};

export type PhaseId = 'diagnose' | 'build' | 'prelims' | 'mains' | 'interview';

export interface PhaseInfo {
  id: PhaseId;
  name: string;
  focus: string;
}

export const PHASES: Record<PhaseId, PhaseInfo> = {
  diagnose: {
    id: 'diagnose',
    name: 'Phase 0 · Diagnose & install',
    focus: 'Baseline tests, doctor visit, Personal Charter, keystone habits.',
  },
  build: {
    id: 'build',
    name: 'Phase 1 · Build',
    focus: 'Attention, habits, thinking drills, vision & identity, first experiments.',
  },
  prelims: {
    id: 'prelims',
    name: 'Phase 2 · Prelims mind',
    focus: 'Calibration & risk discipline, mock composure, comparison hygiene.',
  },
  mains: {
    id: 'mains',
    name: 'Phase 3 · Mains mind',
    focus: 'Stamina, structured expression at speed, essay creativity, ethical reasoning.',
  },
  interview: {
    id: 'interview',
    name: 'Phase 4 · Personality Test mind',
    focus: 'Communication, presence, balanced opinions, leadership stories, mock boards.',
  },
};

const DIAGNOSE_DAYS = 14;
const PRELIMS_PHASE_DAYS = 105; // ≈15 weeks before Prelims
const TAPER_DAYS = 10;
const MAINS_DAYS = 5;
const DELOAD_EVERY_WEEKS = 6;

export interface PhaseState {
  phase: PhaseId;
  /** 1-based week of the programme. */
  week: number;
  /** 1-based week within the current phase. */
  phaseWeek: number;
  taper: boolean;
  deload: boolean;
  examWeek: 'prelims' | 'mains' | null;
  daysToPrelims: number;
  daysToMains: number;
  /** Suggested dedicated programme minutes today. */
  doseMinutes: number;
}

export function phaseFor(date: DateKey, dates: ExamDates): PhaseState {
  const dayIndex = Math.max(0, daysBetween(dates.programmeStart, date));
  const week = Math.floor(dayIndex / 7) + 1;
  const daysToPrelims = daysBetween(date, dates.prelims);
  const daysToMains = daysBetween(date, dates.mains);
  const prelimsPhaseStart = addDays(dates.prelims, -PRELIMS_PHASE_DAYS);
  const mainsEnd = addDays(dates.mains, MAINS_DAYS - 1);

  let phase: PhaseId;
  let phaseStart: DateKey;
  if (dayIndex < DIAGNOSE_DAYS) {
    phase = 'diagnose';
    phaseStart = dates.programmeStart;
  } else if (date < prelimsPhaseStart) {
    phase = 'build';
    phaseStart = addDays(dates.programmeStart, DIAGNOSE_DAYS);
  } else if (date <= dates.prelims) {
    phase = 'prelims';
    phaseStart = maxKey(prelimsPhaseStart, addDays(dates.programmeStart, DIAGNOSE_DAYS));
  } else if (date <= mainsEnd) {
    phase = 'mains';
    phaseStart = addDays(dates.prelims, 1);
  } else {
    phase = 'interview';
    phaseStart = addDays(mainsEnd, 1);
  }

  const phaseWeek = Math.floor(Math.max(0, daysBetween(phaseStart, date)) / 7) + 1;
  const taper =
    (daysToPrelims >= 0 && daysToPrelims <= TAPER_DAYS) ||
    (daysToMains >= 0 && daysToMains <= TAPER_DAYS);
  const examWeek =
    daysToPrelims === 0 ? 'prelims' : date >= dates.mains && date <= mainsEnd ? 'mains' : null;
  const deload =
    !taper && examWeek === null && phase !== 'diagnose' && week % DELOAD_EVERY_WEEKS === 0;

  return {
    phase,
    week,
    phaseWeek,
    taper,
    deload,
    examWeek,
    daysToPrelims,
    daysToMains,
    doseMinutes: doseFor(phase, phaseWeek, { taper, deload, examWeek }),
  };
}

function maxKey(a: DateKey, b: DateKey) {
  return a > b ? a : b;
}

export function doseFor(
  phase: PhaseId,
  phaseWeek: number,
  flags: { taper: boolean; deload: boolean; examWeek: 'prelims' | 'mains' | null },
): number {
  if (flags.examWeek) return 15;
  if (flags.taper) return 30;
  const base: Record<PhaseId, number> = {
    diagnose: 30,
    // Ramp 45 → 75 minutes over the first five weeks of Build.
    build: Math.min(75, 45 + (phaseWeek - 1) * 7.5),
    prelims: 60,
    mains: 70,
    interview: 60,
  };
  const minutes = base[phase];
  return Math.round(flags.deload ? minutes / 2 : minutes);
}
