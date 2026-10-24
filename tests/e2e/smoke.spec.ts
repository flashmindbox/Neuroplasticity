import { expect, test, type Page } from '@playwright/test';

const ROUTES = [
  ['', /Phase 0/],
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

  // Tick an item and log clarity on Today.
  await page.goto('/#/');
  await page.getByRole('checkbox', { name: 'Fixed wake time' }).check();
  await page
    .getByRole('radiogroup', { name: 'Clarity — late morning' })
    .getByRole('radio', { name: '7' })
    .click();
  await expect(page.getByText('Your active targets')).toBeVisible();

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
  await expect(page.getByRole('button', { name: /Start 25-minute block/ })).toBeVisible();
  await expect(page.getByText('Wanders noticed', { exact: true })).toBeVisible();

  // Journal entry.
  await page.goto('/#/journal');
  await page.getByLabel('One win today (however small)').fill('Finished three focus blocks');
  await page.getByRole('button', { name: 'calm' }).click();
  await page.getByRole('button', { name: 'Save reflection' }).click();
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
  await page.goto('/#/journal');
  await expect(page.getByText('✓ Finished three focus blocks')).toBeVisible();

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
