// Exercises the real browser AI path (SDK in the browser, CSP, streaming) against a mocked
// Anthropic endpoint — no real API calls or keys.
import { expect, test, type Page } from '@playwright/test';

const USAGE = { input_tokens: 900, output_tokens: 400 };

function message(text: string) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: USAGE,
  };
}

function sse(text: string) {
  const events = [
    [
      'message_start',
      { type: 'message_start', message: { ...message(''), content: [], stop_reason: null } },
    ],
    [
      'content_block_start',
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ],
    [
      'content_block_delta',
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    ],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    [
      'message_delta',
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 40 },
      },
    ],
    ['message_stop', { type: 'message_stop' }],
  ];
  return events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
}

async function addKey(page: Page) {
  await page.goto('/#/settings');
  await page.getByPlaceholder('sk-ant-…').fill('sk-ant-test-key');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Remove key')).toBeVisible();
}

test('drill evaluation through the browser SDK', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  const keys: (string | undefined)[] = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    bodies.push(route.request().postDataJSON());
    // SDK v1 (API version 2026-10-21) sends the API key as a bearer token.
    keys.push((await route.request().allHeaders()).authorization);
    await route.fulfill({
      json: message(
        JSON.stringify({
          scores: ['Breadth', 'Depth', 'Balance', 'Causality', 'Practicality'].map((c) => ({
            criterion: c,
            score: 3,
            comment: 'ok',
          })),
          strength: 'Covers social and economic angles concretely.',
          fix: 'Add the administrative angle with a named mechanism.',
          improved: 'Administrative: …',
          overall: 6,
        }),
      ),
    });
  });

  await addKey(page);
  await page.goto('/#/drills');
  await page.getByRole('button', { name: '7 lenses' }).click();
  await page
    .getByLabel('Your response')
    .fill('Social: inclusion\nEconomic: fiscal cost\nPolitical: federal tension');
  for (const group of await page.getByRole('radiogroup').all())
    await group.getByRole('radio', { name: '4' }).click();
  await page.getByRole('button', { name: 'Save drill' }).click();
  await page.getByRole('button', { name: 'I understand' }).click();
  await page.getByRole('button', { name: /Get AI second opinion/ }).click();

  await expect(page.getByText('Covers social and economic angles concretely.')).toBeVisible();
  await expect(page.getByText('Overall 6/10')).toBeVisible();
  expect(bodies).toHaveLength(1);
  expect(keys).toEqual(['Bearer sk-ant-test-key']);
  expect(bodies[0]).toMatchObject({
    model: 'claude-opus-5-5',
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
  });
  expect(JSON.stringify(bodies[0])).not.toContain('selfScores');
});

test('mock board streams a question and keeps the conversation', async ({ page }) => {
  const bodies: { messages: { role: string }[] }[] = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: sse(`Chairperson: Question ${bodies.length}?`),
    });
  });

  await addKey(page);
  await page.goto('/#/interview');
  await page.getByRole('button', { name: 'I understand' }).click();
  await page.getByRole('button', { name: 'Enter the board room' }).click();
  await expect(page.getByText('Chairperson: Question 1?')).toBeVisible();

  await page.getByPlaceholder('Your answer…').fill('Good morning. I am from Bihar.');
  await page.getByRole('button', { name: 'Answer' }).click();
  await expect(page.getByText('Chairperson: Question 2?')).toBeVisible();

  // Second request replays the whole history: opening, board turn, answer.
  expect(bodies[1].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
});

test('AI errors are shown, not swallowed', async ({ page }) => {
  await page.route('https://api.anthropic.com/**', (route) =>
    route.fulfill({
      status: 401,
      json: {
        type: 'error',
        error: { type: 'authentication_error', message: 'invalid x-api-key' },
      },
    }),
  );
  await addKey(page);
  await page.goto('/#/drills');
  await page.getByRole('button', { name: '1-minute structure' }).click();
  await page.getByLabel('Your response').fill('Intro / Body / Way forward');
  for (const group of await page.getByRole('radiogroup').all())
    await group.getByRole('radio', { name: '3' }).click();
  await page.getByRole('button', { name: 'Save drill' }).click();
  await page.getByRole('button', { name: 'I understand' }).click();
  await page.getByRole('button', { name: /Get AI second opinion/ }).click();
  await expect(page.getByText('The API key was rejected. Check it in Settings.')).toBeVisible();
});
