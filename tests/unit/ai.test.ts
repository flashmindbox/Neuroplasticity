import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { costOf, createClient, MODEL, toAiError } from '../../src/lib/ai/client';
import { buildUserMessage, evaluate, type ParseClient } from '../../src/lib/ai/evaluate';
import {
  boardDebrief,
  boardSystemPrompt,
  boardTurn,
  OPENING_MESSAGE,
  toApiMessages,
  type StreamClient,
} from '../../src/lib/ai/interview';
import { db, type InterviewMessage } from '../../src/lib/db';
import { EMPTY_PROFILE } from '../../src/lib/settings';

const usage = { input_tokens: 1000, output_tokens: 500 };

function fakeParse(result: object) {
  const parse = vi
    .fn()
    .mockResolvedValue({ model: MODEL, usage, stop_reason: 'end_turn', ...result });
  return { client: { beta: { messages: { parse } } } as unknown as ParseClient, parse };
}

const request = {
  kind: 'drill' as const,
  title: '7 lenses',
  instructions: 'One point per lens',
  prompt: 'Should India adopt UBI?',
  response: 'Social: ...\nEconomic: ...',
  rubric: ['Breadth', 'Depth', 'Balance', 'Causality', 'Practicality'],
};

beforeEach(async () => {
  await db.aiUsage.clear();
});

describe('client helpers', () => {
  it('refuses to create a client without a key', () => {
    expect(() => createClient('  ')).toThrow(/API key/);
  });

  it('prices Claude Opus 5.5 usage', () => {
    expect(costOf(usage)).toBeCloseTo((1000 * 4 + 500 * 20) / 1e6);
  });

  it('maps SDK errors to actionable kinds', () => {
    const headers = new Headers();
    expect(
      toAiError(new Anthropic.AuthenticationError(401, undefined, 'bad key', headers)).kind,
    ).toBe('auth');
    expect(toAiError(new Anthropic.RateLimitError(429, undefined, 'slow down', headers)).kind).toBe(
      'rate',
    );
    expect(toAiError(new Anthropic.APIConnectionError({ message: 'offline' })).kind).toBe(
      'network',
    );
    expect(toAiError(new Error('boom')).kind).toBe('unknown');
  });
});

describe('evaluate', () => {
  it('sends an independent rating request and normalises the result', async () => {
    const { client, parse } = fakeParse({
      parsed_output: {
        scores: [
          { criterion: 'breadth', score: 4.4, comment: 'covers five lenses' },
          { criterion: 'Depth', score: 9, comment: 'x' },
          { criterion: 'Unknown', score: 3, comment: 'ignored' },
        ],
        strength: ' Clear lens labels ',
        fix: 'Add a causal link',
        improved: 'Example...',
        overall: 6.6,
      },
    });
    const ev = await evaluate(client, request);
    expect(ev.scores).toEqual({ Breadth: 4, Depth: 5 });
    expect(ev.overall).toBe(7);
    expect(ev.strength).toBe('Clear lens labels');

    const params = parse.mock.calls[0][0];
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      thinking: { type: 'adaptive' },
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
    });
    expect(params.output_config.effort).toBe('high');
    expect(params).not.toHaveProperty('temperature');
    expect(await db.aiUsage.count()).toBe(1);
  });

  it('does not call the API for an empty response', async () => {
    const { client, parse } = fakeParse({});
    await expect(evaluate(client, { ...request, response: '  ' })).rejects.toMatchObject({
      kind: 'bad-request',
    });
    expect(parse).not.toHaveBeenCalled();
  });

  it('surfaces refusals and truncation instead of partial data', async () => {
    await expect(
      evaluate(fakeParse({ stop_reason: 'refusal', parsed_output: null }).client, request),
    ).rejects.toMatchObject({ kind: 'refusal' });
    await expect(
      evaluate(fakeParse({ stop_reason: 'max_tokens', parsed_output: null }).client, request),
    ).rejects.toMatchObject({ kind: 'truncated' });
  });

  it('includes measured delivery metrics for talks', () => {
    const msg = buildUserMessage({
      ...request,
      kind: 'talk',
      metrics: { wpm: 142, fillersPerMin: 2.5 },
    });
    expect(msg).toMatch(/142 words\/min/);
    expect(msg).toMatch(/speech-recognition transcript/);
  });
});

describe('mock interview', () => {
  const thinking = { type: 'thinking', thinking: '', signature: 'sig-abc' };

  function fakeStream(text: string) {
    const stream = vi.fn().mockImplementation(() => {
      const handlers: ((d: string) => void)[] = [];
      return {
        on(_event: string, cb: (d: string) => void) {
          handlers.push(cb);
          return this;
        },
        async finalMessage() {
          handlers.forEach((h) => h(text));
          return {
            content: [thinking, { type: 'text', text, citations: null }],
            stop_reason: 'end_turn',
            usage,
          };
        },
      };
    });
    return { client: { beta: { messages: { stream } } } as unknown as StreamClient, stream };
  }

  it('builds a board prompt from the profile', () => {
    const p = boardSystemPrompt({ ...EMPTY_PROFILE, homeState: 'Bihar', hobbies: 'chess' });
    expect(p).toMatch(/Home state \/ district: Bihar/);
    expect(p).toMatch(/Hobbies and interests: chess/);
    expect(p).not.toMatch(/Name:/);
  });

  it('streams a turn and keeps the raw content for verbatim replay', async () => {
    const { client, stream } = fakeStream('Chairperson: Welcome. Tell us about Bihar.');
    const deltas: string[] = [];
    const history: InterviewMessage[] = [{ role: 'user', content: OPENING_MESSAGE }];
    const turn = await boardTurn(client, 'SYSTEM', history, (d) => deltas.push(d));
    expect(turn.text).toBe('Chairperson: Welcome. Tell us about Bihar.');
    expect(turn.raw[0]).toEqual(thinking);
    expect(deltas.join('')).toBe(turn.text);
    expect(stream.mock.calls[0][0].output_config.effort).toBe('medium');

    const next: InterviewMessage[] = [
      ...history,
      { role: 'assistant', content: turn.text, raw: turn.raw },
      { role: 'user', content: 'Bihar has...' },
    ];
    expect(toApiMessages(next)[1]).toEqual({ role: 'assistant', content: turn.raw });
  });

  it('needs at least three answers before a debrief', async () => {
    const { client, parse } = fakeParse({});
    await expect(
      boardDebrief(client, [
        { role: 'user', content: OPENING_MESSAGE },
        { role: 'assistant', content: 'Q1' },
        { role: 'user', content: 'A1' },
      ]),
    ).rejects.toMatchObject({ kind: 'bad-request' });
    expect(parse).not.toHaveBeenCalled();
  });
});
