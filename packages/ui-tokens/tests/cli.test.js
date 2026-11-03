/**
 * The `link-ui-tokens` command line.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'test-anywhere';
import { main, USAGE } from '../src/cli.js';
import { FULL, GOLDEN, PACKAGE, SAMPLE } from './helpers.js';

/** Run `main` with captured output. */
async function run(argv) {
  const out = { stdout: '', stderr: '' };
  const code = await main(argv, {
    stdout: (text) => {
      out.stdout += text;
    },
    stderr: (text) => {
      out.stderr += text;
    },
  });
  return { code, ...out };
}

/** A temporary directory for one test, removed afterwards. */
async function inTemp(body) {
  const dir = mkdtempSync(join(tmpdir(), 'ui-tokens-cli-'));
  try {
    await body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const read = (file) => readFileSync(file, 'utf8');

describe('link-ui-tokens build', () => {
  it('writes the four files of the issue, equal to the golden files', () =>
    inTemp(async (dir) => {
      const { code, stdout, stderr } = await run([
        'build',
        SAMPLE,
        '--set',
        'material3',
        '--css',
        join(dir, 'out.css'),
        '--dtcg',
        join(dir, 'out.json'),
        '--swift',
        join(dir, 'Tokens.swift'),
        '--kotlin',
        join(dir, 'Tokens.kt'),
      ]);
      expect(code).toBe(0);
      expect(stdout).toBe('');
      // The sample extends a "base" set it does not contain.
      expect(stderr).toContain(
        'warning: The token set "material3" extends "base"'
      );
      expect(read(join(dir, 'out.css'))).toBe(
        read(join(GOLDEN, 'material3.css'))
      );
      expect(read(join(dir, 'out.json'))).toBe(
        read(join(GOLDEN, 'material3.tokens.json'))
      );
      expect(read(join(dir, 'Tokens.swift'))).toBe(
        read(join(GOLDEN, 'Tokens.swift'))
      );
      expect(read(join(dir, 'Tokens.kt'))).toBe(
        read(join(GOLDEN, 'Tokens.kt'))
      );
    }));

  it('runs as the bin of the package', () =>
    inTemp(async (dir) => {
      const result = spawnSync(
        'node',
        [
          join(PACKAGE, 'bin', 'cli.js'),
          'build',
          SAMPLE,
          '--css',
          join(dir, 'nested', 'out.css'),
        ],
        { encoding: 'utf8' }
      );
      if (result.error !== undefined) {
        return; // no `node` on the PATH of this runtime
      }
      expect(result.status).toBe(0);
      expect(read(join(dir, 'nested', 'out.css'))).toBe(
        read(join(GOLDEN, 'material3.css'))
      );
    }));

  it('writes CSS to stdout and passes the options on', async () => {
    const { code, stdout } = await run([
      'build',
      FULL,
      '--set',
      'brand',
      '--prefix',
      'ui',
      '--selector',
      '.app',
      '--mode-media',
      'dark=(prefers-color-scheme: dark)',
    ]);
    expect(code).toBe(0);
    expect(
      stdout.startsWith(
        '.app {\n  /* Text on surfaces */\n  --ui-color-neutral: #1c1b1f;\n'
      )
    ).toBe(true);
    expect(stdout).toContain(
      '@media (prefers-color-scheme: dark) {\n  .app {\n'
    );
  });

  it('builds one mode, names the Kotlin object and resolves aliases', () =>
    inTemp(async (dir) => {
      const { code } = await run([
        'build',
        FULL,
        '--set',
        'brand',
        '--mode',
        'dark',
        '--kotlin',
        join(dir, 'Brand.kt'),
        '--name',
        'Brand',
        '--package',
        'com.example',
        '--dtcg',
        join(dir, 'brand.json'),
        '--resolve-aliases',
      ]);
      expect(code).toBe(0);
      const kotlin = read(join(dir, 'Brand.kt'));
      expect(kotlin).toContain('package com.example\n');
      expect(kotlin).toContain('    val ColorPrimary = Color(0xFFD0BCFF)\n');
      expect(kotlin).not.toContain('object Dark');
      const dtcg = JSON.parse(read(join(dir, 'brand.json')));
      expect(dtcg.color.action.$value.hex).toBe('#d0bcff');
    }));

  it('fails with the diagnostics on errors', () =>
    inTemp(async (dir) => {
      const file = join(dir, 'bad.lino');
      writeFileSync(file, '(t: theme (token a (token b)) (token b (token a)))');
      const { code, stderr } = await run(['build', file]);
      expect(code).toBe(1);
      expect(stderr).toContain(
        `${file}: error: The token "b" of the set "t" refers to itself through b -> a -> b [alias-cycle]`
      );
    }));

  it('asks for --set when the file has several sets', async () => {
    const { code, stderr } = await run(['build', FULL]);
    expect(code).toBe(2);
    expect(stderr).toContain('--set is needed; the sets are: base, brand');
  });

  it('reports a missing file', async () => {
    const { code, stderr } = await run(['build', join(PACKAGE, 'nope.lino')]);
    expect(code).toBe(1);
    expect(stderr.startsWith('link-ui-tokens: ')).toBe(true);
  });
});

describe('link-ui-tokens import', () => {
  it('writes a DTCG file as a token set', () =>
    inTemp(async (dir) => {
      const out = join(dir, 'tokens.lino');
      const { code } = await run([
        'import',
        join(GOLDEN, 'material3.tokens.json'),
        '--id',
        'material3',
        '--out',
        out,
      ]);
      expect(code).toBe(0);
      expect(read(out)).toBe(`material3: theme
  token color.primary '#6750A4'
  token color.on-primary '#FFFFFF'
  token space.medium 16px
  token shape.corner.medium 12px
  token motion.duration.short 150ms
`);
      const stdout = await run([
        'import',
        join(GOLDEN, 'material3.tokens.json'),
      ]);
      expect(stdout.stdout.startsWith('tokens: theme\n')).toBe(true);
    }));
});

describe('link-ui-tokens usage', () => {
  it('prints the usage on help and fails on bad arguments', async () => {
    expect(await run(['help'])).toEqual({ code: 0, stdout: USAGE, stderr: '' });
    expect((await run(['-h'])).stdout).toBe(USAGE);
    expect((await run([])).code).toBe(2);
    expect((await run(['deploy', 'x'])).code).toBe(2);
    expect((await run(['build', 'a', 'b'])).code).toBe(2);
    const unknown = await run(['build', 'x', '--colour']);
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('--colour');
    const media = await run(['build', SAMPLE, '--mode-media', 'dark']);
    expect(media.code).toBe(1);
    expect(media.stderr).toContain('--mode-media wants NAME=QUERY');
  });
});
