// Claude-subscription mode (the default): copy a prompt out, paste Claude's reply back. No network calls.
import { expect, test } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const CRITERIA = [
  'Mental alertness',
  'Critical powers of assimilation',
  'Clear and logical exposition',
  'Balance of judgement',
  'Variety and depth of interest',
  'Social cohesion and leadership',
  'Intellectual and moral integrity',
];

test('drill: copy the prompt, paste Claude’s reply, see the rating', async ({ page }) => {
  let apiCalls = 0;
  await page.route('https://api.anthropic.com/**', (route) => {
    apiCalls++;
    return route.abort();
  });

  await page.goto('/#/drills');
  await page.getByRole('button', { name: '7 lenses' }).click();
  await page.getByLabel('Your response').fill('Social: inclusion\nEconomic: fiscal cost');
  await expect(page.getByRole('radiogroup').first()).toBeVisible();
  for (const group of await page.getByRole('radiogroup').all())
    await group.getByRole('radio', { name: '4' }).click();
  await page.getByRole('button', { name: 'Save drill' }).click();

  await page.getByRole('button', { name: 'Copy prompt for Claude' }).click();
  await expect(page.getByRole('button', { name: 'Copied ✓' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('REWIRE · EVALUATION REQUEST v1');
  expect(copied).toContain('Social: inclusion');

  const reply = {
    scores: ['Breadth', 'Depth', 'Balance', 'Causality', 'Practicality'].map((criterion) => ({
      criterion,
      score: 2,
      comment: 'generic',
    })),
    strength: 'Names two relevant lenses.',
    fix: 'Give one specific mechanism per lens.',
    improved: 'Economic: a UBI of ₹X would cost …',
    overall: 4,
  };
  const box = page.getByLabel('Claude’s reply');
  await box.fill('not json');
  await page.getByRole('button', { name: 'Save Claude’s rating' }).click();
  await expect(page.getByText(/Couldn’t find a valid JSON object/)).toBeVisible();

  await box.fill('```json\n' + JSON.stringify(reply) + '\n```');
  await page.getByRole('button', { name: 'Save Claude’s rating' }).click();
  await expect(page.getByText('Give one specific mechanism per lens.')).toBeVisible();
  await expect(page.getByText('Overall 4/10')).toBeVisible();
  expect(apiCalls).toBe(0);
});

test('mock board: copy the board prompt, import the debrief', async ({ page }) => {
  await page.goto('/#/interview');
  await page.getByRole('button', { name: 'Copy board prompt' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('REWIRE · MOCK BOARD v1');

  const debrief = {
    rewire: 'interview-debrief',
    transcript: [
      { role: 'board', text: 'Chairperson: Why the civil services?' },
      { role: 'candidate', text: 'To fix how welfare reaches villages.' },
    ],
    scores: CRITERIA.map((criterion) => ({ criterion, score: 3 })),
    strengths: ['Clear motivation'],
    improvements: ['Back opinions with one fact'],
    summary: 'Composed and sincere.',
  };
  await page.getByLabel('Claude’s debrief').fill('```json\n' + JSON.stringify(debrief) + '\n```');
  await page.getByRole('button', { name: 'Import debrief' }).click();

  await expect(page.getByText('Composed and sincere.')).toBeVisible();
  await expect(page.getByText('Chairperson: Why the civil services?')).toBeVisible();
  await page.getByRole('button', { name: '← All interviews' }).click();
  await expect(page.getByText(/via Claude/)).toBeVisible();
});
