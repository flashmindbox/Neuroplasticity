// Claude API access from the browser with your own key. Every call is triggered by an explicit
// button press; nothing is sent automatically.
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { todayKey } from '../dates';

export const MODEL = 'claude-opus-5-5';
/** Server-side refusal fallback: the API retries a policy-declined request on a default fallback model. */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

// Claude Opus 5.5 list prices (USD per million tokens).
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

export type AiErrorKind =
  | 'no-key'
  | 'auth'
  | 'billing'
  | 'permission'
  | 'rate'
  | 'overloaded'
  | 'network'
  | 'bad-request'
  | 'refusal'
  | 'truncated'
  | 'invalid-output'
  | 'unknown';

export class AiError extends Error {
  readonly kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'AiError';
  }
}

export function createClient(apiKey: string): Anthropic {
  if (!apiKey.trim()) throw new AiError('no-key', 'Add your Anthropic API key in Settings first.');
  // A personal, single-user app: the key is yours and stays in this device's storage.
  return new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });
}

/** Maps SDK errors to messages you can act on. Most specific classes first. */
export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.AuthenticationError)
    return new AiError('auth', 'The API key was rejected. Check it in Settings.');
  if (err instanceof Anthropic.PermissionDeniedError)
    return new AiError('permission', 'This API key is not allowed to use this model.');
  if (err instanceof Anthropic.RateLimitError)
    return new AiError('rate', 'Rate limit reached. Wait a minute and try again.');
  if (err instanceof Anthropic.BadRequestError)
    return new AiError('bad-request', `The request was rejected: ${err.message}`);
  if (err instanceof Anthropic.InternalServerError)
    return new AiError('overloaded', 'The AI service is busy or unavailable. Try again shortly.');
  if (err instanceof Anthropic.APIConnectionError)
    return new AiError(
      'network',
      'Could not reach the AI service. Check your internet connection.',
    );
  if (err instanceof Anthropic.APIError) {
    if (err.status === 402)
      return new AiError('billing', 'Your Anthropic account needs credit or a payment method.');
    if (err.status === 529)
      return new AiError('overloaded', 'The AI service is overloaded. Try again shortly.');
    return new AiError(
      'unknown',
      `AI service error${err.status ? ` (${err.status})` : ''}: ${err.message}`,
    );
  }
  return new AiError('unknown', err instanceof Error ? err.message : 'Unexpected error.');
}

export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function costOf(u: UsageLike): number {
  return (
    (u.input_tokens * PRICE.input +
      u.output_tokens * PRICE.output +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) /
    1_000_000
  );
}

export async function recordUsage(feature: string, u: UsageLike) {
  await db.aiUsage.add({
    date: todayKey(),
    feature,
    inputTokens:
      u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    outputTokens: u.output_tokens,
    costUsd: costOf(u),
  });
}

/** Throws for stop reasons that mean the output can't be used. */
export function assertUsable(stopReason: string | null | undefined) {
  if (stopReason === 'refusal')
    throw new AiError(
      'refusal',
      'The AI declined this request. Try rephrasing, or rate this one yourself.',
    );
  if (stopReason === 'max_tokens')
    throw new AiError('truncated', 'The AI response was cut off. Please try again.');
}
