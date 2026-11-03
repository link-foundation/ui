import { asRecording } from './format.js';
const quote = JSON.stringify;
const selector = (id) => `[data-link-id=${quote(String(id))}]`;
const locator = (id) => `page.locator(${quote(selector(id))})`;
const field = (args, name) =>
  args.find((v) => Array.isArray(v) && v[0] === name)?.slice(1) ?? [];

function pointerLines(args) {
  const [, action, id] = args;
  const [x = 0, y = 0] = field(args, 'at');
  const [button = 0] = field(args, 'button');
  const lines = [
    `  { const box = await target(${quote(id)}).boundingBox(); await page.mouse.move(box.x + ${Number(x)}, box.y + ${Number(y)}); }`,
  ];
  if (action === 'down' || action === 'up') {
    lines.push(
      `  await page.mouse.${action}({ button: ${quote(['left', 'middle', 'right'][Number(button)] ?? 'left')} });`
    );
  }
  if (action === 'cancel') {
    lines.push(`  await target(${quote(id)}).dispatchEvent('pointercancel');`);
  }
  return lines;
}
const INPUT = {
  pointer: pointerLines,
  text: ([, id, value]) => [
    `  await target(${quote(id)}).fill(${quote(value)});`,
  ],
  key: (args) => [
    `  await target(${quote(field(args, 'target')[0])}).dispatchEvent(${quote(`key${args[1]}`)}, { key: ${quote(args[2])} });`,
  ],
  wheel: ([, id, x, y, mode = 0]) => [
    `  await target(${quote(id)}).dispatchEvent('wheel', { deltaX: ${Number(x)}, deltaY: ${Number(y)}, deltaMode: ${Number(mode)} });`,
  ],
  focus: ([, action, id]) => [
    `  await target(${quote(id)}).${action === 'in' ? 'focus' : 'blur'}();`,
  ],
};
function assertion(event) {
  const [id, name, ...values] = event.args;
  if (typeof id !== 'string') {
    return [];
  }
  const value = values.join(' ');
  if (['label', 'text'].includes(name)) {
    return [`  await expect(${locator(id)}).toHaveText(${quote(value)});`];
  }
  if (name === 'value') {
    return [
      `  await expect(target(${quote(id)})).toHaveValue(${quote(value)});`,
    ];
  }
  // The application supplies the hook for properties with no DOM representation.
  return [
    `  await expect.poll(() => page.evaluate(([id, name]) => globalThis.uiRecordingState(id, name), ${quote([id, name])})).toEqual(${quote(values)});`,
  ];
}

/** Export standard DOM interactions and observable property assertions. */
export function toPlaywright(source, { url = '/' } = {}) {
  const recording = asRecording(source);
  if (recording.truncated) {
    throw new Error('Cannot export a truncated recording');
  }
  const lines = [
    "import { test, expect } from '@playwright/test';",
    '',
    '// prettier-ignore',
    "test('recorded session', async ({ page }) => {",
    `  await page.setViewportSize({ width: ${recording.viewport?.[0] || 1280}, height: ${recording.viewport?.[1] || 800} });`,
    '  await page.clock.install();',
    `  await page.goto(${quote(url)});`,
    '  const target = (id) => { const host = page.locator(`[data-link-id=${JSON.stringify(id)}]`); return host.locator("button, input, textarea, select").or(host).last(); };',
  ];
  let previous = 0;
  for (const event of recording.events) {
    if (event.time > previous) {
      lines.push(`  await page.clock.runFor(${event.time - previous});`);
    }
    previous = event.time;
    if (event.kind === 'mark') {
      lines.push(`  await test.step(${quote(event.args[0])}, async () => {});`);
    }
    if (event.kind === 'input') {
      const encode = INPUT[event.args[0]];
      if (!encode) {
        throw new TypeError(`Unsupported input ${event.args[0]}`);
      }
      lines.push(...encode(event.args));
    }
    if (event.kind === 'set') {
      lines.push(...assertion(event));
    }
  }
  lines.push('});', '');
  return lines.join('\n');
}
