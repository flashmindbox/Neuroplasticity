// Drill types and prompt banks. Prompts are read directly from handbook/drills/*.md
// so the handbook stays the single source.
import thinkingMd from '../../handbook/drills/thinking-prompts.md?raw';
import dilemmasMd from '../../handbook/drills/dilemmas.md?raw';
import talksMd from '../../handbook/drills/talk-topics.md?raw';

/** Parses `## Heading` sections and their `- bullet` lines. */
export function parseBank(md: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let section: string | null = null;
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      section = heading[1].trim();
      out[section] = [];
    } else if (section && line.startsWith('- ')) {
      out[section].push(line.slice(2).trim());
    }
  }
  return out;
}

export const THINKING_BANK = parseBank(thinkingMd);
export const DILEMMA_BANK = parseBank(dilemmasMd);
export const TALK_BANK = parseBank(talksMd);

export interface CalibrationStatement {
  text: string;
  truth: boolean;
}

export const CALIBRATION_STATEMENTS: CalibrationStatement[] = (
  THINKING_BANK['Calibration statements'] ?? []
)
  .map((line) => /^([TF])\s*\|\s*(.+)$/.exec(line))
  .filter((m): m is RegExpExecArray => m !== null)
  .map((m) => ({ truth: m[1] === 'T', text: m[2] }));

export type DrillTypeId =
  'lenses' | 'steelman' | 'causal' | 'dm' | 'structure' | 'dilemma' | 'calibration';

export interface DrillType {
  id: DrillTypeId;
  name: string;
  instructions: string;
  seconds: number;
  bank: string[];
  rubric: string[];
}

export const RUBRIC_THINKING = ['Breadth', 'Depth', 'Balance', 'Causality', 'Practicality'];
export const RUBRIC_STRUCTURE = ['Structure', 'Relevance', 'Clarity', 'Specificity', 'Conclusion'];
export const RUBRIC_DILEMMA = [
  'Stakeholders',
  'Options',
  'Principles',
  'Decision',
  'Communication',
];

const issues = THINKING_BANK['Issues'] ?? [];

export const DRILL_TYPES: DrillType[] = [
  {
    id: 'lenses',
    name: '7 lenses',
    instructions:
      'One specific point per lens: Social · Economic · Political · Legal/Constitutional · Ethical · Environmental · Administrative. One line per angle.',
    seconds: 90,
    bank: issues,
    rubric: RUBRIC_THINKING,
  },
  {
    id: 'steelman',
    name: 'Steelman',
    instructions:
      'State the strongest version of the view you disagree with — so well its supporters would agree. Then give your reasoned position.',
    seconds: 300,
    bank: issues,
    rubric: RUBRIC_THINKING,
  },
  {
    id: 'causal',
    name: 'Causal chain',
    instructions:
      'X → Y → Z: at least three links deep, plus one feedback loop. Keep asking “and then what?”',
    seconds: 300,
    bank: issues,
    rubric: RUBRIC_THINKING,
  },
  {
    id: 'dm',
    name: 'Think like a DM',
    instructions:
      'It is Monday morning in your district. Immediate steps (24 h) → short term (1 month) → systemic fix (1 year). Who do you call? Legal basis? What can go wrong?',
    seconds: 420,
    bank: THINKING_BANK['District problems'] ?? [],
    rubric: RUBRIC_THINKING,
  },
  {
    id: 'structure',
    name: '1-minute structure',
    instructions:
      'Skeleton only: headings and one line each (intro, body sections, way forward, conclusion). Match the directive word.',
    seconds: 60,
    bank: THINKING_BANK['Structure prompts'] ?? [],
    rubric: RUBRIC_STRUCTURE,
  },
  {
    id: 'dilemma',
    name: 'Ethical dilemma',
    instructions:
      'Stakeholders · at least three options · principles at stake · your decision · how you would explain it to those affected.',
    seconds: 1200,
    bank: DILEMMA_BANK['Dilemmas'] ?? [],
    rubric: RUBRIC_DILEMMA,
  },
  {
    id: 'calibration',
    name: 'Calibration quiz',
    instructions:
      'For each statement choose True/False and how confident you are. Check your calibration at the end.',
    seconds: 300,
    bank: [],
    rubric: [],
  },
];

export const DRILL_BY_ID = Object.fromEntries(DRILL_TYPES.map((d) => [d.id, d])) as Record<
  DrillTypeId,
  DrillType
>;

export const TALK_TOPICS: string[] = Object.values(TALK_BANK).flat();

export const TALK_RUBRIC = ['Main point', 'Structure', 'Balance', 'Pace & fillers', 'Presence'];

/** Deterministic daily pick so the "drill of the day" is stable across reloads. */
export function pickForDay<T>(items: T[], dateKey: string, salt = 0): T | undefined {
  if (!items.length) return undefined;
  let h = salt;
  for (const c of dateKey) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return items[h % items.length];
}

const ROTATION: DrillTypeId[] = [
  'lenses',
  'structure',
  'steelman',
  'dm',
  'causal',
  'calibration',
  'lenses',
];

export function drillTypeForDay(dayOfWeek: number): DrillTypeId {
  return ROTATION[dayOfWeek % ROTATION.length];
}
