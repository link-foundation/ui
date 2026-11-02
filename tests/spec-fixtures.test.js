/**
 * Tests for the ui-dialect/0 specification checker.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  checkSpec,
  linoBlocks,
  MIN_FIXTURES,
  validateSchema,
} from '../scripts/check-spec-fixtures.mjs';
import {
  loadVocabulary,
  projectText,
} from '../scripts/spec-reference-projection.mjs';

const SPEC_DIR = 'docs/spec';
const SPEC_DOCUMENTS = [
  'README.md',
  'elements.md',
  'projection.md',
  'values.md',
  'ordering-and-ids.md',
  'behaviour.md',
  'limits.md',
  'open-questions.md',
];

/** Run `mutate` on a temporary copy of docs/spec and return its errors. */
function checkMutatedCopy(mutate) {
  const dir = mkdtempSync(path.join(tmpdir(), 'spec-'));
  try {
    cpSync(SPEC_DIR, dir, { recursive: true });
    mutate(dir);
    return checkSpec(dir).errors;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('docs/spec (ui-dialect/0)', () => {
  it('passes every check of scripts/check-spec-fixtures.mjs', () => {
    const { errors, fixtures } = checkSpec(SPEC_DIR);
    expect(errors).toEqual([]);
    expect(fixtures >= MIN_FIXTURES).toBe(true);
  });

  it('has all eight documents, each with RFC 2119 wording', () => {
    for (const document of SPEC_DOCUMENTS) {
      const text = readFileSync(path.join(SPEC_DIR, document), 'utf8');
      expect(/\b(MUST|SHOULD|MAY)\b/.test(text)).toBe(true);
    }
  });

  it('gives one tree for one-line, multi-line and indented input', () => {
    const vocabulary = loadVocabulary();
    const forms = [
      "(ok: button (label 'OK') (on press (navigate home)))",
      "(ok: button\n  (label 'OK')\n  (on press (navigate home)))",
      "ok: button\n  label 'OK'\n  on press\n    navigate home",
    ].map((text) => JSON.stringify(projectText(text, vocabulary).tree));
    expect(forms[1]).toBe(forms[0]);
    expect(forms[2]).toBe(forms[0]);
  });

  it('folds repeated groups and top-level heads the same in every form', () => {
    const vocabulary = loadVocabulary();
    const groups = [
      [
        '(ok: button (on press (navigate home)) (on press (navigate back)))',
        '(ok: button\n  (on press\n    (navigate home))\n  (on press\n    (navigate back)))',
        'ok: button\n  on press\n    navigate home\n  on press\n    navigate back',
      ],
      [
        "(s: stack (text 'A' (style x)) (text 'A' (style y)))",
        "(s: stack\n  (text 'A'\n    (style x))\n  (text 'A'\n    (style y)))",
        "s: stack\n  text 'A'\n    style x\n  text 'A'\n    style y",
      ],
      [
        "(text 'A' (style x))",
        "(text 'A'\n  (style x))",
        "text 'A'\n  style x",
      ],
      ['(foo bar (baz qux))', '(foo bar\n  (baz qux))', 'foo bar\n  baz qux'],
    ];
    for (const group of groups) {
      const [first, ...rest] = group.map((text) =>
        JSON.stringify(projectText(text, vocabulary).tree)
      );
      for (const tree of rest) {
        expect(tree).toBe(first);
      }
    }
  });

  it('covers every case-study sample', () => {
    const samples = readdirSync('docs/case-studies/issue-1/samples');
    const copies = readdirSync(path.join(SPEC_DIR, 'fixtures', 'samples'));
    for (const sample of samples) {
      expect(copies.includes(sample)).toBe(true);
    }
  });
});

describe('check-spec-fixtures.mjs detects broken fixtures', () => {
  const fixtures = (dir, ...parts) => path.join(dir, 'fixtures', ...parts);

  it('reports a missing sibling JSON', () => {
    const errors = checkMutatedCopy((dir) =>
      rmSync(fixtures(dir, 'elements', 'unknown-kind.tree.json'))
    );
    expect(errors.some((e) => e.includes('unknown-kind.lino'))).toBe(true);
  });

  it('reports a syntax-* fixture that parses', () => {
    const errors = checkMutatedCopy((dir) =>
      writeFileSync(
        fixtures(dir, 'errors', 'syntax-unquoted-hex.lino'),
        '(a b)'
      )
    );
    expect(errors.some((e) => e.includes('parsed without an error'))).toBe(
      true
    );
  });

  it('reports shapes whose trees differ', () => {
    const errors = checkMutatedCopy((dir) => {
      const file = fixtures(dir, 'shapes', 'button.indented.tree.json');
      writeFileSync(file, `${readFileSync(file, 'utf8')}\n`);
    });
    expect(errors.some((e) => e.includes('tree differs'))).toBe(true);
  });

  it('reports JSON that breaks the schema or the reference projection', () => {
    const errors = checkMutatedCopy((dir) => {
      const file = fixtures(dir, 'samples', 'document.tree.json');
      const json = JSON.parse(readFileSync(file, 'utf8'));
      json.elements[0].kind = 'page';
      json.elements[0].extra = true;
      writeFileSync(file, JSON.stringify(json));
    });
    expect(errors.some((e) => e.includes('unexpected extra'))).toBe(true);
    expect(errors.some((e) => e.includes('reference projection'))).toBe(true);
  });

  it('reports a fenced lino block that does not parse', () => {
    const errors = checkMutatedCopy((dir) =>
      writeFileSync(
        path.join(dir, 'limits.md'),
        'Text MUST.\n\n```lino\n(x #6750A4)\n```\n'
      )
    );
    expect(errors.some((e) => e.includes('limits.md: lino block 1'))).toBe(
      true
    );
  });
});

describe('check-spec-fixtures.mjs helpers', () => {
  it('extracts only fenced lino blocks', () => {
    const markdown = '```lino\n(a b)\n```\n\n```text\n(x #1)\n```\n';
    expect(linoBlocks(markdown)).toEqual(['(a b)\n']);
  });

  it('validates the schema subset', () => {
    const schema = {
      $defs: { name: { type: 'string', enum: ['a'] } },
      type: 'object',
      required: ['n'],
      additionalProperties: false,
      properties: { n: { $ref: '#/$defs/name' } },
    };
    expect(validateSchema(schema, { n: 'a' })).toEqual([]);
    expect(validateSchema(schema, { n: 'b' }).length).toBe(1);
    expect(validateSchema(schema, {}).length).toBe(1);
  });
});
