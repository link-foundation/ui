import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import AxeBuilder from '@axe-core/playwright';

test.beforeAll(async () => {
  await build({
    entryPoints: ['packages/ui-sound/examples/main.js'],
    bundle: true,
    format: 'esm',
    outfile: 'packages/ui-sound/examples/dist/main.js',
    logLevel: 'silent',
  });
});

test('generated settings expose ordered voices, previews and accessible controls', async ({
  page,
}) => {
  await page.goto('/packages/ui-sound/examples/index.html');
  await page.waitForFunction(() => Boolean(window.soundDemo));
  const row = (key) => page.locator(`.settings-row[data-key="${key}"]`);
  await expect(row('sound.events.activate.voice2')).toBeHidden();
  await row('sound.enabled').getByRole('switch').click();
  await row('sound.events.activate.voice1').getByRole('combobox').click();
  await page
    .getByRole('option', { name: 'Glassy high tick', exact: true })
    .click();
  await expect(row('sound.events.activate.voice2')).toBeVisible();
  await expect(row('sound.events.activate.voice3')).toBeHidden();
  await page
    .getByRole('button', { name: 'Preview Activate voice 1', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Try an interaction', exact: true })
    .click();
  expect(
    await page.evaluate(() => window.soundDemo.player.play('activate'))
  ).toEqual(['quartz']);
  await expect(row('sound.room')).toBeVisible();
  await page.evaluate(() =>
    window.soundDemo.panel.update({ 'sound.reverb': 0, 'sound.stereo': false })
  );
  await expect(row('sound.room')).toBeHidden();
  await expect(row('sound.width')).toBeHidden();
  const audit = await new AxeBuilder({ page })
    .include('#settings')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
});

test('real audio envelopes stay silent before fractional sample starts', async ({
  page,
}) => {
  await page.goto('/packages/ui-sound/examples/index.html');
  const result = await page.evaluate(async () => {
    const { playVoice } = await import('/packages/ui-sound/src/graph.js');
    const rate = 8000;
    const context = new window.OfflineAudioContext(1, 800, rate);
    const start = 10.25 / rate;
    const part = {
      kind: 'tone',
      wave: 'square',
      frequency: 100,
      to: 100,
      gain: 1,
      detune: 0,
      pan: 0,
      delay: 0,
      envelope: { attack: 0.002, decay: 0.003, sustain: 0.2, release: 0.002 },
    };
    playVoice(
      context,
      { parts: [part], repeat: 3, gap: 0.02001, repeatDecay: 1 },
      context.destination,
      { at: start }
    );
    const data = (await context.startRendering()).getChannelData(0);
    const silent = [];
    for (let repeat = 0; repeat < 3; repeat++) {
      const at = start + repeat * 0.02001;
      const first = repeat
        ? Math.ceil((start + (repeat - 1) * 0.02001 + 0.007) * rate) + 1
        : 0;
      silent.push(
        [...data.slice(first, Math.floor(at * rate))].every(
          (value) => value === 0
        )
      );
    }
    return {
      silent,
      audible: [...data].some((value) => Math.abs(value) > 0.01),
    };
  });
  expect(result).toEqual({ silent: [true, true, true], audible: true });
});
