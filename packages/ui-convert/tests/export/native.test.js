import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportDocument } from '../../src/index.js';
import {
  readTokens,
  resolveTokens,
  toSwift,
  toKotlin,
} from '@link-foundation/ui-tokens';

const source = `app: document
  row: stack
    direction horizontal
    gap 8px
    padding 1rem
    name: text-field
      label Name
      value Alice
    enabled: switch
      label Enabled
      checked true
    ok: button
      label OK
      variant filled
      on press
        navigate home
`;

test('native outputs include editable state, spacing, padding and action arguments', async () => {
  const swift = (await exportDocument(source, { target: 'swiftui' })).files[0]
    .contents;
  assert.match(swift, /HStack\(spacing: 8\)/);
  assert.match(swift, /\.padding\(16\)/);
  assert.match(swift, /@State private var field0 = "Alice"/);
  assert.match(swift, /Toggle\("Enabled", isOn: \$field1\)/);
  assert.match(swift, /actions\["navigate"\]\?\(\["home"\]\)/);
  assert.match(swift, /\.buttonStyle\(\.borderedProminent\)/);
  const kotlin = (await exportDocument(source, { target: 'compose' })).files[0]
    .contents;
  assert.match(
    kotlin,
    /Row\(horizontalArrangement = Arrangement.spacedBy\(8.dp\), modifier = Modifier.padding\(16.dp\)\)/
  );
  assert.match(
    kotlin,
    /Switch\(checked = field1, onCheckedChange = \{ field1 = it \}\)/
  );
  assert.match(kotlin, /TextField\(value = field0, onValueChange/);
  assert.match(kotlin, /actions\["navigate"\]\?\.invoke\(listOf\("home"\)\)/);
  for (const text of [swift, kotlin]) {
    for (const line of text.split('\n')) {
      assert.equal(line.match(/^ */)[0].length % 4, 0);
    }
  }
});

test('native token references match the actual ui-tokens identifiers', async () => {
  const { sets } = readTokens('t: theme\n  token space.medium 16px\n');
  const resolved = resolveTokens(sets, 't');
  const document = 's: stack\n  gap\n    token space.medium\n';
  assert.match(toSwift(resolved), /static let spaceMedium/);
  assert.match(toKotlin(resolved), /val SpaceMedium/);
  assert.match(
    (await exportDocument(document, { target: 'swiftui' })).files[0].contents,
    /Tokens.spaceMedium/
  );
  assert.match(
    (await exportDocument(document, { target: 'compose' })).files[0].contents,
    /Tokens.SpaceMedium/
  );
});

test('native strings escape interpolation, controls, backslashes and quotes', async () => {
  const document = 't: text hi\n';
  const { parse } = await import('@link-foundation/ui-core');
  const tree = parse(document);
  tree.roots[0].positional = ['\\(danger) $danger "quoted"\n\u0001'];
  const swift = (await exportDocument(tree, { target: 'swiftui' })).files[0]
    .contents;
  const kotlin = (await exportDocument(tree, { target: 'compose' })).files[0]
    .contents;
  assert.ok(swift.includes('\\\\(danger) $danger \\"quoted\\"\\n\\u{1}'));
  assert.ok(kotlin.includes('\\\\(danger) \\$danger \\"quoted\\"\\n\\u0001'));
});

const available = (program, args) =>
  spawnSync(program, args, { encoding: 'utf8' }).status === 0;
const swiftAvailable =
  process.platform === 'darwin' &&
  available('swiftc', ['--version']) &&
  available('xcrun', ['--sdk', 'macosx', '--show-sdk-path']);
test(
  'optional real SwiftUI type check',
  {
    skip: swiftAvailable
      ? false
      : 'swiftc and an Apple SwiftUI SDK are required',
  },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-swift-export-'));
    try {
      const file = join(dir, 'App.swift');
      writeFileSync(
        file,
        (await exportDocument(source, { target: 'swiftui' })).files[0].contents
      );
      execFileSync('swiftc', ['-typecheck', file], { stdio: 'pipe' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);

const kotlinAvailable =
  Boolean(process.env.UI_CONVERT_COMPOSE_CLASSPATH) &&
  available('kotlinc', ['-version']);
test(
  'optional real Compose compilation',
  {
    skip: kotlinAvailable
      ? false
      : 'kotlinc plus UI_CONVERT_COMPOSE_CLASSPATH containing the Compose SDK are required',
  },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-kotlin-export-'));
    try {
      const file = join(dir, 'App.kt');
      writeFileSync(
        file,
        (await exportDocument(source, { target: 'compose' })).files[0].contents
      );
      execFileSync(
        'kotlinc',
        [
          '-J-Xmx512m',
          '-classpath',
          process.env.UI_CONVERT_COMPOSE_CLASSPATH,
          file,
          '-d',
          join(dir, 'out.jar'),
        ],
        { stdio: 'pipe' }
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);
