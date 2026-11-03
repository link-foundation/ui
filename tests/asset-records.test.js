import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateReuseToml,
  licenseIds,
  parseAssetRecords,
  validateAssetRecords,
} from '../scripts/lib/asset-records.mjs';
import { renderAttributions } from '../scripts/render-attributions.mjs';

const LUCIDE = `(lucide-check: asset
  (kind icon)
  (files 'assets/icons/check.svg')
  (source 'https://lucide.dev/icons/check')
  (license ISC)
  (copyright 'Lucide Contributors')
  (notice 'https://github.com/lucide-icons/lucide/blob/main/LICENSE'))`;

const OWN = `(links-ui-logo: asset (kind image) (files 'assets/links-ui-logo.svg') (license CC0-1.0) (copyright none))`;

const validate = (text, files) =>
  validateAssetRecords(parseAssetRecords(text), files).errors;

test('parses multi-line and one-line records into plain objects', () => {
  const records = parseAssetRecords(`${LUCIDE}\n${OWN}`);
  assert.deepEqual(
    records.map((record) => {
      const rest = { ...record };
      delete rest.parseErrors;
      delete rest.missing;
      return rest;
    }),
    [
      {
        id: 'lucide-check',
        kind: 'icon',
        files: ['assets/icons/check.svg'],
        license: 'ISC',
        copyright: 'Lucide Contributors',
        source: 'https://lucide.dev/icons/check',
        notice: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE',
        attribution: 'none',
        optIn: false,
      },
      {
        id: 'links-ui-logo',
        kind: 'image',
        files: ['assets/links-ui-logo.svg'],
        license: 'CC0-1.0',
        copyright: 'none',
        attribution: 'none',
        optIn: false,
      },
    ]
  );
  assert.deepEqual(
    records.flatMap((r) => [...r.parseErrors, ...r.missing]),
    []
  );
});

test('parses optional fields, several files and quoted SPDX expressions', () => {
  const [record] = parseAssetRecords(
    `(set: asset (kind icon) (files 'assets/a/*.svg' 'assets/b.svg') (license 'MIT OR ISC') (copyright 'X') (source 'https://x') (notice 'https://x/l') (attribution required) (attribution-text 'Icons by X') (commercial-use yes) (modified no) (opt-in true))`
  );
  assert.deepEqual(record.files, ['assets/a/*.svg', 'assets/b.svg']);
  assert.equal(record.license, 'MIT OR ISC');
  assert.equal(record.attribution, 'required');
  assert.equal(record.attributionText, 'Icons by X');
  assert.equal(record.commercialUse, 'yes');
  assert.equal(record.modified, 'no');
  assert.equal(record.optIn, true);
});

test('splits SPDX expressions into identifiers', () => {
  assert.deepEqual(licenseIds('(MIT OR Apache-2.0) AND CC-BY-4.0'), [
    'MIT',
    'Apache-2.0',
    'CC-BY-4.0',
  ]);
});

test('accepts a Lucide ISC record and our own CC0 record', () => {
  assert.deepEqual(
    validate(`${LUCIDE}\n${OWN}`, [
      'assets/icons/check.svg',
      'assets/links-ui-logo.svg',
    ]),
    []
  );
});

test('rejects CC-BY-NC-4.0', () => {
  const errors = validate(
    LUCIDE.replace('(license ISC)', '(license CC-BY-NC-4.0)'),
    ['assets/icons/check.svg']
  );
  assert.match(errors.join('\n'), /CC-BY-NC-4.0" is denied: non-commercial/);
});

test('rejects a Remix Icon LicenseRef', () => {
  const errors = validate(
    LUCIDE.replace('(license ISC)', '(license LicenseRef-RemixIcon-1.0)'),
    ['assets/icons/check.svg']
  );
  assert.match(errors.join('\n'), /LicenseRef-RemixIcon-1.0" is a LicenseRef/);
});

test('rejects opt-in licences without (opt-in true) and accepts them with it', () => {
  const ccBy = LUCIDE.replace('(license ISC)', '(license CC-BY-4.0)');
  assert.match(
    validate(ccBy, ['assets/icons/check.svg']).join('\n'),
    /needs \(opt-in true\)/
  );
  const optedIn = ccBy.replace(
    '(license CC-BY-4.0)',
    '(license CC-BY-4.0) (opt-in true) (attribution required)'
  );
  assert.deepEqual(validate(optedIn, ['assets/icons/check.svg']), []);
});

test('rejects third-party records without source', () => {
  const errors = validate(
    LUCIDE.replace("(source 'https://lucide.dev/icons/check')", ''),
    ['assets/icons/check.svg']
  );
  assert.match(errors.join('\n'), /third-party asset needs a \(source 'URL'\)/);
});

test('rejects denied fonts, unknown licences and missing fields', () => {
  const errors = validate(
    `(sf: asset (kind font) (files 'assets/f.otf') (license LicenseRef-SF-Pro) (copyright 'Apple'))
(bad: asset (kind font) (files 'assets/g.otf') (license 'See repository') (copyright 'X') (source 'https://x') (notice 'https://x'))
(empty: asset (kind wat))`,
    ['assets/f.otf', 'assets/g.otf']
  ).join('\n');
  assert.match(errors, /LicenseRef-SF-Pro/);
  assert.match(errors, /"See" is not on the allow list/);
  assert.match(errors, /record "empty": missing required field "files"/);
  assert.match(errors, /kind "wat" is not one of/);
});

test('reports files without a record, with two records, and unused patterns', () => {
  const errors = validate(
    `${OWN}\n(dup: asset (kind image) (files 'assets/*.svg' 'assets/gone.png') (license CC0-1.0) (copyright none))`,
    ['assets/links-ui-logo.svg', 'assets/tmp.bin']
  ).join('\n');
  assert.match(errors, /assets\/tmp.bin: no record/);
  assert.match(errors, /links-ui-logo.svg: matched by more than one record/);
  assert.match(errors, /"assets\/gone.png" matches no file/);
});

test('generates REUSE.toml annotations from records', () => {
  const toml = generateReuseToml(parseAssetRecords(`${LUCIDE}\n${OWN}`));
  assert.match(
    toml,
    /path = "\*\*"\nprecedence = "aggregate"\nSPDX-FileCopyrightText = "Link Foundation contributors"\nSPDX-License-Identifier = "Unlicense"/
  );
  assert.match(
    toml,
    /path = "assets\/icons\/check.svg"\nprecedence = "aggregate"\nSPDX-FileCopyrightText = "Lucide Contributors"\nSPDX-License-Identifier = "ISC"/
  );
});

test('renders attributions grouped by licence in every format', () => {
  const records = parseAssetRecords(`${LUCIDE}\n${OWN}`);
  const markdown = renderAttributions(records);
  assert.ok(markdown.indexOf('## Public domain') < markdown.indexOf('## ISC'));
  assert.match(
    markdown,
    /\[lucide-check\]\(https:\/\/lucide.dev\/icons\/check\)/
  );
  assert.match(markdown, /Copyright: Lucide Contributors/);
  assert.match(markdown, /Copyright: public domain/);
  assert.match(
    renderAttributions(records, { format: 'html' }),
    /<a href="https:\/\/lucide.dev\/icons\/check">lucide-check<\/a>/
  );
  assert.match(
    renderAttributions(records, { format: 'lino' }),
    /^lucide-check: attribution\n {2}group ISC\n {2}copyright /m
  );
  assert.throws(() => renderAttributions(records, { format: 'pdf' }));
});
