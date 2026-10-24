import { expect, test, type Page } from '@playwright/test';

const ROUTES = [
  ['', /your Rewire mentor/],
  ['charter', /Personal Charter/],
  ['focus', /Attention is a trainable skill/],
  ['drills', /Thinking drills/],
  ['journal', /Tonight’s reflection/],
  ['speak', /Recorded talk/],
  ['mocks', /Mocks & calibration/],
  ['tests', /Weekly Brain Check/],
  ['experiments', /Fog audit \(14 days\)/],
  ['review', /Sunday review/],
  ['progress', /Topper profile/],
  ['interview', /Mock board/],
  ['handbook', /The Topper Mind Programme/],
  ['settings', /Exam dates/],
  ['more', /More/],
] as const;

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

test('every page renders without errors or horizontal scroll', async ({ page }) => {
  const errors = trackErrors(page);
  for (const [route, text] of ROUTES) {
    await page.goto(`/#/${route}`);
    await expect(page.locator('main').getByText(text).first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, `${route} overflows horizontally`).toBe(false);
  }
  expect(errors).toEqual([]);
});

test('core daily loop persists across reloads', async ({ page }) => {
  const errors = trackErrors(page);
  // The mentor's advice depends on the time of day; pin it to a morning.
  await page.clock.setFixedTime(new Date('2026-11-02T09:00:00'));

  // Charter with targets.
  await page.goto('/#/charter');
  await page
    .getByRole('textbox')
    .first()
    .fill('I want to serve rural districts with clean, fast public services.');
  await page.getByRole('button', { name: /Deep focus/ }).click();
  await page.getByRole('button', { name: /Critical & multi-angle thinking/ }).click();
  await page.getByRole('button', { name: 'Save charter' }).first().click();
  await expect(page.getByText('Saved ✓')).toBeVisible();

  // Check in on Today, tick a habit, and log an exact number in the detailed log.
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Morning check-in' })).toBeVisible();
  for (const [question, answer] of [
    ['Sleep last night', '7–8 h'],
    ['Energy', 'Good'],
    ['Stress', 'Calm'],
    ['Mood', 'Good'],
  ])
    await page
      .getByRole('radiogroup', { name: question })
      .getByRole('radio', { name: answer })
      .click();
  await page.getByRole('button', { name: 'Plan my day' }).click();
  await expect(page.getByText('You’re good to go — the full plan today.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Fixed wake time' }).check();
  await expect(page.getByRole('checkbox', { name: 'Deep focus' })).toBeVisible();
  await page.getByText('Detailed log').click();
  await page
    .getByRole('radiogroup', { name: 'Clarity — late morning' })
    .getByRole('radio', { name: '7' })
    .click();

  // A short focus block.
  await page.goto('/#/focus');
  await page.getByPlaceholder(/Finish chapter 4/).fill('Read polity chapter');
  await page.getByRole('button', { name: /Start 25-minute block/ }).click();
  await page.getByRole('button', { name: /I noticed a wander/ }).click();
  await page.getByRole('button', { name: /End early/ }).click();
  await page
    .getByRole('radiogroup', { name: 'Quality of the block' })
    .getByRole('radio', { name: '4' })
    .click();
  await page.getByRole('button', { name: 'Save block' }).click();
  await expect(page.getByText(/your first focus block/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Start 25-minute block/ })).toBeVisible();
  await expect(page.getByText('Wanders noticed', { exact: true })).toBeVisible();

  // The block ticked itself (and the Deep focus target) on Today.
  await page.goto('/#/');
  await expect(
    page.getByRole('checkbox', { name: /Study blocks with the focus protocol/ }),
  ).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Deep focus' })).toBeChecked();

  // Journal entry.
  await page.goto('/#/journal');
  await page.getByLabel('One win today (however small)').fill('Finished three focus blocks');
  await page.getByRole('button', { name: 'calm' }).click();
  await page.getByRole('button', { name: 'Save reflection' }).click();
  await expect(page.getByText('Reflection 1 saved.')).toBeVisible();
  await expect(page.getByText('✓ Finished three focus blocks')).toBeVisible();

  // Mock with confidence buckets.
  await page.goto('/#/mocks');
  await page.getByLabel('Sure attempted').fill('30');
  await page.getByLabel('Sure correct').fill('28');
  await page.getByLabel('Likely attempted').fill('25');
  await page.getByLabel('Likely correct').fill('18');
  await page.getByRole('button', { name: 'Save mock' }).click();
  await expect(page.getByText('Mock saved.')).toBeVisible();
  await expect(page.getByText('Your calibration (last 10 GS mocks)')).toBeVisible();
  await expect(page.getByRole('cell', { name: '93%' })).toBeVisible();

  // Monthly rating → radar.
  await page.goto('/#/review');
  await page.getByRole('tab', { name: 'Monthly rating' }).click();
  await expect(page.getByRole('radiogroup')).toHaveCount(13);
  for (const group of await page.getByRole('radiogroup').all()) {
    await group.getByRole('radio', { name: '5' }).click();
  }
  await page.getByRole('button', { name: /Save my rating \(13\/13\)/ }).click();
  await expect(page.getByText('Rating saved.')).toBeVisible();
  await page.goto('/#/progress');
  await expect(page.locator('.recharts-polar-grid')).toBeVisible();

  // Everything survives a reload.
  await page.reload();
  await page.goto('/#/');
  await expect(page.getByRole('checkbox', { name: 'Fixed wake time' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Reflection journal' })).toBeChecked();
  await page.goto('/#/journal');
  await expect(page.getByText('✓ Finished three focus blocks')).toBeVisible();

  expect(errors).toEqual([]);
});

test('the mentor takes a new user from welcome to their first results', async ({ page }) => {
  const errors = trackErrors(page);
  await page.clock.setFixedTime(new Date('2026-11-02T08:00:00'));
  await page.goto('/#/');

  // Welcome: name, purpose, recommended first targets.
  await page.getByLabel('What should I call you? (optional)').fill('Asha');
  await page.getByRole('button', { name: /Let’s set up/ }).click();
  await page.getByLabel('Your purpose').fill('Make public services in my district fast and fair.');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: /Deep focus/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start day 1' }).click();
  await expect(page.getByRole('heading', { name: 'Good morning, Asha' })).toBeVisible();

  // A short night and high stress: the mentor suggests a light day and says why.
  for (const [question, answer] of [
    ['Sleep last night', '5–6 h'],
    ['Energy', 'Okay'],
    ['Stress', 'Stressed'],
    ['Mood', 'Okay'],
  ])
    await page
      .getByRole('radiogroup', { name: question })
      .getByRole('radio', { name: answer })
      .click();
  await page.getByRole('button', { name: 'Plan my day' }).click();
  await expect(
    page.getByText(/Light day, because you slept under 6 hours and stress is high/),
  ).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Light day' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Morning briefing: the purpose, then today's if-then plan, which ticks itself.
  await expect(page.getByText('Make public services in my district fast and fair.')).toBeVisible();
  await page
    .getByRole('textbox', { name: /Today’s if-then plan/ })
    .fill('If I reach for my phone, then I put it in the other room.');
  await page.getByRole('button', { name: /Done — what’s next/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Today’s if-then plan' })).toBeChecked();

  // Next step: a shorter attention session, in the Focus page, then back to Today.
  await expect(page.getByRole('heading', { name: 'Attention training · 5 min' })).toBeVisible();
  await page.getByRole('link', { name: /Start attention training/ }).click();
  await expect(page.getByRole('tab', { name: 'Attention training' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Begin 5 minutes' }).click();
  await page.getByRole('button', { name: /Wandered — returning/ }).click();
  await page.getByRole('button', { name: 'Stop early' }).click();
  await page.getByRole('button', { name: /Save session/ }).click();
  await expect(page.getByText(/First session: 1 rep\./)).toBeVisible();
  await page.getByRole('link', { name: /Back to Today/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Attention training · 5 min' })).toBeChecked();
  await expect(
    page.getByRole('heading', { name: /Study blocks with the focus protocol/ }),
  ).toBeVisible();

  // "Not today" moves the mentor on without ticking anything.
  await page.getByRole('button', { name: 'Not today' }).click();
  await expect(page.getByRole('heading', { name: 'Practice done — now study' })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: /Study blocks with the focus protocol/ }),
  ).not.toBeChecked();

  // Progress shows the first result and what unlocks next.
  await page.goto('/#/progress');
  await expect(page.getByText('Attention reps', { exact: true })).toBeVisible();
  await expect(page.getByText('1 rep', { exact: true })).toBeVisible();
  await expect(page.getByText('Unlock next')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a PHQ-9 answer above zero on item 9 shows crisis contacts', async ({ page }) => {
  await page.goto('/#/tests');
  await page.getByRole('tab', { name: 'Wellbeing check-in' }).click();
  const groups = page.locator('fieldset');
  const n = await groups.count();
  for (let i = 0; i < n; i++) {
    await groups
      .nth(i)
      .getByRole('button', { name: i === n - 1 ? 'Several days' : 'Not at all' })
      .click();
  }
  await page.getByRole('button', { name: 'See result' }).click();
  await expect(page.getByText(/Tele-MANAS \(14416\)/)).toBeVisible();
  await expect(page.getByRole('link', { name: '14416' })).toBeVisible();
});

test('production build ships a Content-Security-Policy', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('Content-Security-Policy');
  expect(html).toContain("connect-src 'self' https://api.anthropic.com");
});
