import { Linter } from 'eslint';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readFileSync,
  readdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import {
  linoToNetwork,
  networkToLino,
} from '../../src/links-view/lino-to-network.js';
import {
  buildNetwork,
  networkIds,
} from '../../src/links-view/network-model.js';

const fixture = (name) =>
  readFileSync(new URL(`./fixtures/${name}.lino`, import.meta.url), 'utf8');
const convert = (text, options) => {
  const result = linoToNetwork(text, options);
  assert.deepEqual(
    result.diagnostics.filter((d) => d.severity === 'error'),
    []
  );
  return { ...result, network: buildNetwork(result.links) };
};
const ends = (network) =>
  [...network.links.values()].map(({ id, source, target }) => ({
    id,
    source,
    target,
  }));

test('binary links map source and target, including forward references', () => {
  const { network, diagnostics } = convert(
    "(1: 1 2)\n(2: 2 1)\n(greeting: hello 'world')"
  );
  assert.deepEqual(ends(network).slice(0, 2), [
    { id: '1', source: '1', target: '2' },
    { id: '2', source: '2', target: '1' },
  ]);
  const greeting = network.links.get('greeting');
  assert.equal(greeting.source, 'hello');
  assert.equal(network.points.get(greeting.target).kind, 'value');
  assert.deepEqual(diagnostics, []);
});

test('more than two values form an ordered sequence from its anchor', () => {
  const { network } = convert('a: b c d');
  assert.deepEqual(ends(network), [
    { id: 'a', source: 'a', target: 'b' },
    { id: 'a/1', source: 'b', target: 'c' },
    { id: 'a/2', source: 'c', target: 'd' },
  ]);
});

test('anonymous nested links have stable path IDs', () => {
  const { network } = convert('a: (b c) d');
  assert.deepEqual(network.links.get('a/0').source, 'b');
  assert.equal(network.links.get('a').source, 'a/0');
  assert.deepEqual(convert('a: (b c) d').links, convert('a: (b c) d').links);
  assert.ok(convert('a: (b) c').network.links.has('a/0'));
  assert.deepEqual(convert('()\nhello').sourceMap.get('@0'), {
    line: 1,
    column: 1,
  });
});

test('bare words become labelled points, including isolated words', () => {
  const { network } = convert('hello');
  assert.equal(network.points.get('hello').label, 'hello');
  assert.equal(network.links.size, 0);
  assert.deepEqual(networkIds(network), ['hello']);
});

test('quoted values stay separate from references with the same spelling', () => {
  const { network } = convert("a: 'a' 'world'\nb: world a");
  const a = network.links.get('a');
  assert.notEqual(a.source, 'a');
  assert.equal(network.points.get(a.source).label, 'a');
  assert.equal(network.points.get(a.target).kind, 'value');
  assert.ok(network.points.has('world'));
});

test('self-references and cycles are retained', () => {
  const { network } = convert('a: a a\nb: a b');
  assert.deepEqual(ends(network), [
    { id: 'a', source: 'a', target: 'a' },
    { id: 'b', source: 'a', target: 'b' },
  ]);
});

test('duplicate IDs warn at the second definition and the first wins', () => {
  const { network, diagnostics } = convert('a: b c\na: d e');
  assert.equal(network.links.get('a').source, 'b');
  assert.equal(network.points.has('d'), false);
  assert.equal(diagnostics[0].code, 'duplicate-id');
  assert.deepEqual([diagnostics[0].line, diagnostics[0].column], [2, 1]);
});

test('unresolved numeric references warn with their source position', () => {
  const { network, diagnostics } = convert('a: hello 42');
  assert.ok(network.points.has('42'));
  assert.deepEqual(
    diagnostics.map(({ code, severity, line, column }) => ({
      code,
      severity,
      line,
      column,
    })),
    [{ code: 'unknown-reference', severity: 'warning', line: 1, column: 10 }]
  );
});

test('all three parse shapes give the same network', () => {
  const networks = ['same-one-line', 'same-multi-line', 'same-indented'].map(
    (name) => convert(fixture(name)).links
  );
  assert.deepEqual(networks[0], networks[1]);
  assert.deepEqual(networks[0], networks[2]);
});

test('every case-study sample converts without errors', () => {
  const folder = new URL(
    '../../../../docs/case-studies/issue-1/samples/',
    import.meta.url
  );
  for (const name of readdirSync(folder).filter((name) =>
    name.endsWith('.lino')
  )) {
    convert(readFileSync(new URL(name, folder), 'utf8'));
  }
});

test('syntax errors return parser line and column without throwing', () => {
  const result = linoToNetwork('a b\nstage: rust: nextest');
  assert.deepEqual(result.links, []);
  assert.equal(result.diagnostics[0].severity, 'error');
  assert.deepEqual(
    [result.diagnostics[0].line, result.diagnostics[0].column],
    [2, 12]
  );
});

test('size and depth limits return diagnostics', () => {
  assert.equal(
    linoToNetwork('a: b c', { maxInputSize: 3 }).diagnostics[0].code,
    'input-too-large'
  );
  assert.equal(
    linoToNetwork('(a (b (c d)))', { maxDepth: 1 }).diagnostics[0].code,
    'depth-exceeded'
  );
  assert.equal(linoToNetwork(null).diagnostics[0].severity, 'error');
});

test('source positions track definitions, nested links, comments, CRLF and quotes', () => {
  const text = "# comment\r\na: hello\r\n  b: 'hello' 'two\nlines'";
  const { network, sourceMap } = convert(text);
  assert.deepEqual(sourceMap.get('a'), { line: 2, column: 1 });
  assert.deepEqual(sourceMap.get('b'), { line: 3, column: 3 });
  assert.deepEqual(sourceMap.get('hello'), { line: 2, column: 4 });
  assert.deepEqual(sourceMap.get(network.links.get('b').source), {
    line: 3,
    column: 6,
  });
});

test('synthetic IDs avoid explicit IDs, points and the reserved zero ID', () => {
  const result = convert('a: (b c) a/0\na/1: x y\n0: 0 a');
  assert.equal(result.network.points.get('a/0').label, 'a/0');
  assert.notEqual(result.network.links.get('a').source, 'a/0');
  assert.ok(
    [...result.network.links.values()].some((link) => link.label === '0')
  );
  assert.equal(result.network.links.has('0'), false);
});

test('all fixtures round trip IDs, references, point kinds and ordering', () => {
  for (const name of readdirSync(
    new URL('./fixtures/', import.meta.url)
  ).filter((name) => name.endsWith('.lino'))) {
    const original = convert(fixture(name.slice(0, -5)));
    const text = networkToLino(original.network);
    assert.deepEqual(convert(text).links, original.links, name);
    assert.deepEqual(
      convert(networkToLino(original)).links,
      original.links,
      name
    );
  }
  assert.equal(networkToLino(linoToNetwork('')), '');
  assert.throws(
    () =>
      networkToLino(
        buildNetwork([{ id: 'external', source: 'a', target: 'b' }])
      ),
    /LiNo/
  );
});

test('CLI writes valid SVG and refuses invalid syntax or options', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lino-network-'));
  const cli = new URL('../../bin/lino-network.mjs', import.meta.url);
  try {
    const out = join(dir, 'cycle.svg');
    execFileSync(process.execPath, [
      fileURLToPath(cli),
      fileURLToPath(new URL('./fixtures/cycle.lino', import.meta.url)),
      '--layout',
      'force',
      '--out',
      out,
    ]);
    const svg = new JSDOM(readFileSync(out, 'utf8'), {
      contentType: 'image/svg+xml',
    });
    assert.equal(svg.window.document.documentElement.localName, 'svg');
    assert.equal(svg.window.document.querySelectorAll('[data-id]').length, 2);
    svg.window.close();
    const invalid = join(dir, 'invalid.lino');
    const invalidOut = join(dir, 'invalid.svg');
    writeFileSync(invalid, 'stage: rust: nextest');
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [fileURLToPath(cli), invalid, '--out', invalidOut],
          { stdio: 'pipe' }
        ),
      (error) => {
        assert.equal(error.status, 1);
        assert.ok(error.stderr.toString().includes('1:12'));
        return true;
      }
    );
    assert.throws(() =>
      execFileSync(process.execPath, [fileURLToPath(cli), '--layout', 'bad'], {
        stdio: 'pipe',
      })
    );
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [
          fileURLToPath(cli),
          fileURLToPath(new URL('./fixtures/cycle.lino', import.meta.url)),
          '--out',
        ],
        { stdio: 'pipe' }
      )
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('LiNo readers contain no regular expressions', () => {
  const linter = new Linter();
  for (const file of [
    'src/links-view/lino-to-network.js',
    'src/links-view/lino-network-source.js',
    'src/links-view/lino-network.js',
    'bin/lino-network.mjs',
  ]) {
    const source = readFileSync(
      new URL(`../../${file}`, import.meta.url),
      'utf8'
    );
    const messages = linter.verify(source, {
      rules: {
        'no-restricted-syntax': [
          'error',
          'Literal[regex]',
          "Identifier[name='RegExp']",
        ],
      },
    });
    assert.deepEqual(messages, [], file);
  }
});
