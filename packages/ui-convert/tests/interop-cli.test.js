/**
 * The ui-convert command line, run in process with fake stdio and files.
 */

import { join } from 'node:path';
import { describe, it, expect } from 'test-anywhere';
import {
  USAGE,
  formatDiagnostic,
  main,
  parseArgs,
  readJson,
} from '../src/cli.js';
import { importA2ui, importLottie, importJsonForms } from '../src/index.js';
import { FIXTURES_DIR, fixture, fixtureText } from './helpers.js';

/** Run the CLI with `files` (name -> text; `0` is stdin). */
function run(argv, files = {}) {
  let stdout = '';
  let stderr = '';
  const code = main(argv, {
    stdout: { write: (text) => (stdout += text) },
    stderr: { write: (text) => (stderr += text) },
    readFile: (file) => {
      if (!(file in files)) {
        throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
      }
      return files[file];
    },
  });
  return { code, stdout, stderr };
}

const json = (format, name) => ({ 'in.json': fixtureText(format, name) });

describe('ui-convert import', () => {
  it('detects the format and writes LiNo', () => {
    const out = run(['import', 'in.json'], json('json-forms', 'rule.json'));
    expect(out.code).toBe(0);
    expect(out.stdout).toBe(
      importJsonForms(fixture('json-forms', 'rule.json')).lino
    );
    expect(out.stderr).toContain('warning unsupported-rule (json-forms');
  });

  it('reads stdin and JSON Lines', () => {
    const messages = fixture('a2ui', 'simple-text.json').messages;
    const jsonl = messages.map((m) => JSON.stringify(m)).join('\n');
    const out = run(['import', '-'], { 0: jsonl });
    expect(out.code).toBe(0);
    expect(out.stdout).toBe(importA2ui(messages).lino);
  });

  it('passes --style to the importer', () => {
    const files = json('lottie', 'fill.json');
    const out = run(['import', 'in.json', '--style=inline'], files);
    const { lino } = importLottie(fixture('lottie', 'fill.json'), {
      style: 'inline',
    });
    expect(out.stdout).toBe(lino);
    expect(out.stdout.trimEnd().includes('\n')).toBe(false);
  });

  it('exits 1 on error diagnostics and still writes the output', () => {
    const out = run(['import', 'in.json'], json('lottie', 'rejected.json'));
    expect(out.code).toBe(1);
    expect(out.stdout).toContain('rejected: document');
    expect(out.stderr).toContain('error expression (lottie /layers/1/ks/o/x)');
  });
});

describe('ui-convert export', () => {
  it('writes A2UI as JSON Lines that import reads back', () => {
    const lino = importA2ui(fixture('a2ui', 'row-layout.json')).lino;
    const out = run(['export', 'in.lino', '--format', 'a2ui'], {
      'in.lino': lino,
    });
    expect(out.code).toBe(0);
    const lines = out.stdout.trim().split('\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(run(['import', '-'], { 0: out.stdout }).stdout).toBe(lino);
  });

  it('passes --target-version to Adaptive Cards', () => {
    const lino = run(
      ['import', 'in.json'],
      json('adaptive-cards', 'Table.json')
    ).stdout;
    const out = run(
      [
        'export',
        'in.lino',
        '--format',
        'adaptive-cards',
        '--target-version',
        '1.4',
      ],
      { 'in.lino': lino }
    );
    expect(out.code).toBe(0);
    expect(JSON.parse(out.stdout).version).toBe('1.4');
    expect(out.stderr).toContain('warning version-drop');
  });

  it('passes --id to Lottie', () => {
    const out = run(
      ['export', 'in.lino', '--format=lottie', '--id=dot-pulse'],
      {
        'in.lino': fixtureText('lottie', 'dot-pulse.lino'),
      }
    );
    expect(out.code).toBe(0);
    expect(JSON.parse(out.stdout).nm).toBe('dot-pulse');
  });
});

describe('ui-convert usage', () => {
  it('prints the usage', () => {
    expect(run([]).code).toBe(2);
    const help = run(['--help']);
    expect(help.code).toBe(0);
    expect(help.stdout).toBe(`${USAGE}\n`);
  });

  it('exits 2 on usage errors and missing files', () => {
    for (const argv of [
      ['convert', 'x'],
      ['import'],
      ['import', 'a', 'b'],
      ['import', 'a', '--bogus'],
      ['import', 'a', '--format', 'svg'],
      ['import', 'a', '--format'],
      ['export', 'a.lino'],
      ['import', 'missing.json'],
    ]) {
      const out = run(argv);
      expect(out.code).toBe(2);
      expect(out.stderr).toContain('ui-convert: ');
    }
  });

  it('exits 2 when the input is not JSON or not detected', () => {
    expect(run(['import', 'a'], { a: 'nope' }).stderr).toContain(
      'a is not JSON'
    );
    expect(run(['import', 'a'], { a: '{}' }).stderr).toContain(
      'is not detected'
    );
  });

  it('parses arguments', () => {
    expect(
      parseArgs(['export', join(FIXTURES_DIR, 'x.lino'), '--format', 'lottie'])
    ).toEqual({
      command: 'export',
      file: join(FIXTURES_DIR, 'x.lino'),
      format: 'lottie',
    });
    expect(readJson('{"a":1}\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }]);
    expect(
      formatDiagnostic({
        severity: 'info',
        code: 'c',
        message: 'm',
        at: { format: 'a2ui', element: 'e' },
      })
    ).toBe('info c (a2ui e): m');
  });
});
