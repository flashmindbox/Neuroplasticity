import { describe, expect, it } from 'vitest';
import {
  BOARD_HEADER,
  EVALUATION_HEADER,
  extractJson,
  MENTOR_HEADER,
  parsePortableDebrief,
  parsePortableEvaluation,
  portableEvaluationPrompt,
  portableInterviewPrompt,
  portableMentorPrompt,
  SUBSCRIPTION_MODEL,
} from '../../src/lib/ai/portable';
import { BOARD_CRITERIA, OPENING_MESSAGE } from '../../src/lib/ai/interview';
import { EMPTY_PROFILE } from '../../src/lib/settings';

const rubric = ['Breadth', 'Depth', 'Balance', 'Causality', 'Practicality'];
const request = {
  kind: 'drill' as const,
  title: '7 lenses',
  instructions: 'One point per lens',
  prompt: 'Should India adopt UBI?',
  response: 'Social: …\nEconomic: …',
  rubric,
};

const reply = (scores: unknown[], extra = '') => `Here is my evaluation:${extra}
\`\`\`json
${JSON.stringify({ scores, strength: 'Concrete social point', fix: 'Add a mechanism', improved: 'Example', overall: 6 })}
\`\`\`
Hope this helps.`;

describe('portable evaluation prompt', () => {
  it('is self-contained: header, evaluator instructions, response and an exact JSON shape', () => {
    const p = portableEvaluationPrompt(request);
    expect(p.startsWith(EVALUATION_HEADER)).toBe(true);
    expect(p).toMatch(/strict, fair evaluator/);
    expect(p).toContain('<response>\nSocial: …\nEconomic: …\n</response>');
    for (const c of rubric) expect(p).toContain(`"criterion": "${c}"`);
    expect(p).toMatch(/```json/);
  });
});

describe('parsing pasted replies', () => {
  it('reads a fenced JSON block surrounded by chatter', () => {
    const ev = parsePortableEvaluation(
      reply(rubric.map((criterion) => ({ criterion, score: 3, comment: 'ok' }))),
      rubric,
    );
    expect(ev.scores).toEqual({ Breadth: 3, Depth: 3, Balance: 3, Causality: 3, Practicality: 3 });
    expect(ev.model).toBe(SUBSCRIPTION_MODEL);
    expect(ev.overall).toBe(6);
  });

  it('accepts unfenced JSON and numeric strings', () => {
    const raw = JSON.stringify({
      scores: [{ criterion: 'Depth', score: '4', comment: 'x' }],
      strength: 's',
      fix: 'f',
      improved: 'i',
      overall: '7',
    });
    const ev = parsePortableEvaluation(`Sure! ${raw}`, rubric);
    expect(ev.scores).toEqual({ Depth: 4 });
    expect(ev.overall).toBe(7);
  });

  it('explains what is wrong with unusable pastes', () => {
    expect(() => parsePortableEvaluation('I think it was good.', rubric)).toThrow(/valid JSON/);
    expect(() => parsePortableEvaluation('```json\n{"scores": []}\n```', rubric)).toThrow(
      /missing some fields/,
    );
    expect(() =>
      parsePortableEvaluation(reply([{ criterion: 'Elegance', score: 5, comment: '' }]), rubric),
    ).toThrow(/did not match the rubric/);
    expect(() => extractJson('```json\n{oops}\n```')).toThrow();
  });
});

describe('portable mock board', () => {
  it('builds a board prompt with the profile, criteria, debrief shape and safety line', () => {
    const p = portableInterviewPrompt({ ...EMPTY_PROFILE, homeState: 'Uttar Pradesh' });
    expect(p.startsWith(BOARD_HEADER)).toBe(true);
    expect(p).toContain('Home state / district: Uttar Pradesh');
    expect(p).toContain('Tele-MANAS: 14416');
    expect(p).toContain('DEBRIEF');
    for (const c of BOARD_CRITERIA) expect(p).toContain(c);
  });

  it('imports a debrief with its transcript', () => {
    const text = `\`\`\`json
${JSON.stringify({
  rewire: 'interview-debrief',
  transcript: [
    { role: 'board', text: 'Chairperson: Tell us about your district.' },
    { role: 'candidate', text: 'It is in eastern UP…' },
  ],
  scores: BOARD_CRITERIA.map((criterion) => ({ criterion, score: 3 })),
  strengths: ['Calm'],
  improvements: ['Use data'],
  summary: 'Composed.',
})}
\`\`\``;
    const { debrief, messages } = parsePortableDebrief(text);
    expect(Object.keys(debrief.scores)).toHaveLength(BOARD_CRITERIA.length);
    expect(messages[0]).toEqual({ role: 'user', content: OPENING_MESSAGE });
    expect(messages[1]).toEqual({
      role: 'assistant',
      content: 'Chairperson: Tell us about your district.',
    });
    expect(messages[2].role).toBe('user');
  });

  it('accepts a debrief without a transcript', () => {
    const text = JSON.stringify({
      scores: [{ criterion: 'Balance of judgement', score: 4 }],
      strengths: [],
      improvements: [],
      summary: 'ok',
    });
    expect(parsePortableDebrief(text).messages).toHaveLength(1);
  });
});

describe('mentor review prompt', () => {
  const metrics = {
    habitPct: 72,
    focusMinutes: 310,
    attentionSessions: 5,
    avgSleep: 6.4,
    exerciseDays: 3,
    avgStress: null,
    avgClarity: 6.5,
    mocks: 0,
  };
  const prompt = portableMentorPrompt({
    phase: 'Phase 1 · Build',
    programmeWeek: 6,
    daysToPrelims: 180,
    targets: ['Deep focus', 'Discipline & habits'],
    weeks: [{ weekStart: '9 Nov', metrics }],
    review: { worked: 'Morning blocks', change: '', lowestSource: 'Energy', nextWeek: '' },
    note: {
      headline: 'A solid week, with one thing to adjust.',
      wins: ['Exercise on 4 days.'],
      watch: ['Sleep averaged 6.4 h.'],
      change: 'Fix one sleep lever.',
    },
  });

  it('carries the numbers, the review and the safety line', () => {
    expect(prompt.startsWith(MENTOR_HEADER)).toBe(true);
    expect(prompt).toContain('plan done 72% · deep focus 310 min');
    expect(prompt).toContain('stress –');
    expect(prompt).toContain('- What worked: Morning blocks');
    expect(prompt).toContain('- What I will change: (not filled in)');
    expect(prompt).toContain('Active targets: Deep focus, Discipline & habits');
    expect(prompt).toContain('- Watch: Sleep averaged 6.4 h.');
    expect(prompt).toMatch(/14416/);
  });
});
