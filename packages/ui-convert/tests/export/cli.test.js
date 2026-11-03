import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { URL, fileURLToPath } from 'node:url';
import { main } from '../../src/cli.js';
import { fixture } from './helpers.js';

const cli = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
const sample = fileURLToPath(
  new URL(
    '../../../../docs/case-studies/issue-1/samples/document.lino',
    import.meta.url
  )
);

test('CLI sample prints SwiftUI source', () => {
  const source = execFileSync(
    'node',
    [cli, 'export', '--target', 'swiftui', sample],
    { encoding: 'utf8' }
  );
  assert.match(source, /struct App: View/);
  assert.match(source, /Tokens.spaceMedium/);
});

test('CLI writes all files to --out and reports warnings separately', async () => {
  const out = mkdtempSync(join(tmpdir(), 'ui-export-'));
  try {
    let stdout = '';
    let stderr = '';
    const io = {
      stdout: {
        write: (s) => {
          stdout += s;
        },
      },
      stderr: {
        write: (s) => {
          stderr += s;
        },
      },
      readFile: () => fixture('unsupported'),
    };
    const status = await main(
      [
        'export',
        '--target=react',
        '--mode=eject',
        '--component-name',
        'Example',
        '--out',
        out,
        '-',
      ],
      io
    );
    assert.equal(status, 0);
    assert.equal(stdout, '');
    assert.match(stderr, /warning unsupported/);
    assert.deepEqual(readdirSync(out).sort(), ['Example.css', 'Example.jsx']);
    assert.match(
      readFileSync(join(out, 'Example.jsx'), 'utf8'),
      /function Example/
    );
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('CLI rejects invalid combinations with usage status', async () => {
  for (const flags of [
    ['--target', 'unknown'],
    ['--target', 'react', '--format', 'a2ui'],
    ['--target', 'vue', '--mode', 'unknown'],
    ['--out', 'out'],
    ['--target', 'react', '--component-name', '../Escape'],
  ]) {
    let stderr = '';
    const status = await main(['export', '-', ...flags], {
      stdout: { write() {} },
      stderr: {
        write(s) {
          stderr += s;
        },
      },
      readFile: () => '',
    });
    assert.equal(status, 2);
    assert.match(stderr, /ui-convert/);
  }
});
