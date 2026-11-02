/**
 * scripts/check-i18n.mjs: key parity of the catalogs (lino-i18n check) and
 * no hard-coded text in documents with (i18n required).
 */

import { describe, it, expect } from 'test-anywhere';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import {
  DEFAULT_LOCALES_DIR,
  linoFiles,
  parseArgs,
  runCheck,
} from '../scripts/check-i18n.mjs';

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

/** Run the check, collecting the output. */
async function check(options) {
  const out = [];
  const code = await runCheck({
    targets: [FIXTURES],
    log: (line) => out.push(line),
    err: (line) => out.push(line),
    ...options,
  });
  return { code, out: out.join('\n') };
}

/** A temp copy of locales/ with `edit` applied to ui.lino. */
async function withCatalog(edit, run) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ui-i18n-'));
  try {
    const text = readFileSync(
      path.join(DEFAULT_LOCALES_DIR, 'ui.lino'),
      'utf8'
    );
    writeFileSync(path.join(dir, 'ui.lino'), edit(text));
    return await run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('check:i18n', () => {
  it('passes for the shipped catalogs and the fixtures', async () => {
    const { code, out } = await check();
    expect(code).toBe(0);
    expect(out).toContain('catalogs aligned');
  });

  it('fails when a ru key is removed', async () => {
    const removed = (text) =>
      text
        .split('\n')
        .filter((line) => !line.includes('Сбросить'))
        .join('\n');
    const { code, out } = await withCatalog(removed, (dir) => check({ dir }));
    expect(code).toBe(1);
    expect(out).toContain('ui.settings.reset');
  });

  it('fails on hard-coded text', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ui-i18n-doc-'));
    try {
      const file = path.join(dir, 'app.lino');
      writeFileSync(
        file,
        "(app: document (i18n required) (ok: button (label 'OK')))"
      );
      const { code, out } = await check({ targets: [dir] });
      expect(code).toBe(1);
      expect(out).toContain('hardcoded-text');
      expect(linoFiles(dir)).toEqual([file]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses its arguments', () => {
    expect(parseArgs(['--dir', 'x', '--reference', 'ru', 'a', 'b'])).toEqual({
      dir: 'x',
      reference: 'ru',
      targets: ['a', 'b'],
    });
  });
});
