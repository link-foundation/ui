// Asset records: parse `assets/assets.lino`, validate the records against
// the licence policy in docs/licensing.md, and generate REUSE.toml.
//
// The records are Links Notation, parsed with the official `links-notation`
// package; this module only projects the parsed links into plain objects.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'links-notation';

/**
 * @typedef {object} AssetRecord
 * @property {string} id
 * @property {string | undefined} kind
 * @property {string[]} files
 * @property {string | undefined} license
 * @property {string | undefined} copyright
 * @property {string} [source]
 * @property {string} [notice]
 * @property {'required' | 'none'} attribution
 * @property {string} [attributionText]
 * @property {'yes' | 'no'} [commercialUse]
 * @property {'yes' | 'no'} [modified]
 * @property {boolean} optIn
 * @property {string[]} parseErrors problems found while reading the record
 * @property {string[]} missing required fields that are absent
 */

/**
 * @typedef {object} LicensePolicy
 * @property {string[]} allowed SPDX identifiers allowed by default
 * @property {string[]} optIn identifiers that need `(opt-in true)`
 * @property {string[]} allowedLicenseRefs `LicenseRef-*` ids listed in docs/licensing.md
 * @property {{pattern: RegExp, reason: string}[]} denied
 */

export const KINDS = Object.freeze([
  'icon',
  'image',
  'font',
  'sound',
  'model',
  'animation',
  'data',
]);

export const REQUIRED_FIELDS = Object.freeze([
  'kind',
  'files',
  'license',
  'copyright',
]);

/** Licences that mark our own public-domain assets. */
export const PUBLIC_DOMAIN_LICENSES = Object.freeze(['CC0-1.0', 'Unlicense']);

/** Copyright holder of everything not covered by an asset record. */
export const REPOSITORY_COPYRIGHT = 'Link Foundation contributors';

/** Files in `assets/` that are not assets and need no record. */
export const NON_ASSET_FILES = Object.freeze([
  'assets/assets.lino',
  'assets/README.md',
  'assets/ATTRIBUTIONS.md',
]);

/** @type {LicensePolicy} */
export const DEFAULT_POLICY = Object.freeze({
  allowed: [
    'Unlicense',
    'CC0-1.0',
    'MIT',
    'ISC',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'Apache-2.0',
  ],
  optIn: ['CC-BY-4.0', 'CC-BY-3.0', 'CC-BY-SA-4.0'],
  allowedLicenseRefs: [],
  denied: [
    { pattern: /-NC(-|$)/i, reason: 'non-commercial licences are denied' },
    { pattern: /-ND(-|$)/i, reason: 'no-derivatives licences are denied' },
    { pattern: /remix-?icon/i, reason: 'Remix Icon v1.0+ is not free' },
    {
      pattern: /sf-?symbols|sf-?pro|segoe/i,
      reason: 'SF Symbols, SF Pro and Segoe must never be bundled',
    },
    {
      pattern: /^(NONE|NOASSERTION|unlicensed|see-repository|cc-ish)$/i,
      reason: 'unlicensed sources are denied',
    },
  ],
});

const FIELD_NAMES = new Set([
  ...REQUIRED_FIELDS,
  'source',
  'notice',
  'attribution',
  'attribution-text',
  'commercial-use',
  'modified',
  'opt-in',
]);

const ENUMS = {
  attribution: ['required', 'none'],
  'commercial-use': ['yes', 'no'],
  modified: ['yes', 'no'],
  'opt-in': ['true'],
};

const isReference = (link) =>
  Boolean(link) && link.id !== null && !(link.values?.length > 0);

/** `(<id>: asset ...)` — a link whose own id is set and that starts with `asset`. */
const isHead = (link) =>
  Boolean(link) &&
  link.id !== null &&
  link.values?.length > 0 &&
  isReference(link.values[0]) &&
  link.values[0].id === 'asset';

/** `(field value...)` — an anonymous link that starts with a plain word. */
const isField = (link) =>
  Boolean(link) &&
  link.id === null &&
  link.values?.length > 0 &&
  isReference(link.values[0]) &&
  link.values.slice(1).every(isReference);

/**
 * Parse the asset records in a Links Notation document.
 *
 * Both the one-line form `(id: asset (kind icon) ...)` and the multi-line
 * form with one field per line are accepted.
 *
 * @param {string} text
 * @returns {AssetRecord[]}
 */
export function parseAssetRecords(text) {
  const links = new Parser().parse(text);
  /** @type {Map<string, {fields: Map<string, string[]>, errors: string[]}>} */
  const raw = new Map();
  const order = [];

  const recordFor = (id) => {
    if (!raw.has(id)) {
      raw.set(id, { fields: new Map(), errors: [] });
      order.push(id);
    }
    return raw.get(id);
  };
  const addField = (record, link) => {
    const [name, ...values] = link.values.map((value) => value.id);
    if (record.fields.has(name)) {
      record.errors.push(`duplicate field "${name}"`);
      return;
    }
    record.fields.set(name, values);
  };
  const visit = (link, current) => {
    if (isHead(link)) {
      const record = recordFor(link.id);
      for (const value of link.values.slice(1)) {
        visit(value, record);
      }
      return;
    }
    if (isField(link)) {
      if (current) {
        addField(current, link);
      }
      return;
    }
    if (link.id === null && link.values?.length > 0) {
      // Multi-line records parse as (head (head field) (head field) ...).
      let scope = current;
      for (const value of link.values) {
        if (isHead(value) && value.values.length === 1) {
          scope = recordFor(value.id);
        } else {
          visit(value, scope);
        }
      }
    }
  };
  for (const link of links) {
    visit(link, null);
  }

  return order.map((id) => toRecord(id, raw.get(id)));
}

function toRecord(id, { fields, errors }) {
  const parseErrors = [...errors];
  const single = (name) => {
    const values = fields.get(name);
    if (!values) {
      return undefined;
    }
    if (values.length !== 1) {
      parseErrors.push(`field "${name}" needs exactly one value`);
    }
    return values[0];
  };
  for (const name of fields.keys()) {
    if (!FIELD_NAMES.has(name)) {
      parseErrors.push(`unknown field "${name}"`);
    }
  }
  for (const [name, allowed] of Object.entries(ENUMS)) {
    const value = single(name);
    if (value !== undefined && !allowed.includes(value)) {
      parseErrors.push(
        `field "${name}" must be one of ${allowed.join(', ')}, got "${value}"`
      );
    }
  }
  /** @type {AssetRecord} */
  const record = {
    id,
    kind: single('kind'),
    files: fields.get('files') ?? [],
    license: single('license'),
    copyright: single('copyright'),
    attribution: single('attribution') === 'required' ? 'required' : 'none',
    optIn: single('opt-in') === 'true',
    parseErrors,
  };
  const optional = {
    source: single('source'),
    notice: single('notice'),
    attributionText: single('attribution-text'),
    commercialUse: single('commercial-use'),
    modified: single('modified'),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) {
      record[key] = value;
    }
  }
  if (!fields.has('files')) {
    record.files = [];
  }
  record.missing = REQUIRED_FIELDS.filter((name) => !fields.has(name));
  return record;
}

/**
 * Split an SPDX expression into its licence identifiers.
 *
 * @param {string} expression
 * @returns {string[]}
 */
export function licenseIds(expression) {
  return expression
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !/^(AND|OR|WITH)$/.test(token))
    .map((token) => token.replace(/\+$/, ''));
}

/** A record of our own: copyright waived through a public-domain licence. */
export const isOwnAsset = (record) => record.copyright === 'none';

/**
 * Check one licence identifier against the policy.
 *
 * @param {string} id
 * @param {AssetRecord} record
 * @param {LicensePolicy} policy
 * @returns {string | null} the problem, or null when allowed
 */
function licenseProblem(id, record, policy) {
  if (id.startsWith('LicenseRef-')) {
    return policy.allowedLicenseRefs.includes(id)
      ? null
      : `licence "${id}" is a LicenseRef not listed in docs/licensing.md`;
  }
  for (const { pattern, reason } of policy.denied) {
    if (pattern.test(id)) {
      return `licence "${id}" is denied: ${reason}`;
    }
  }
  if (policy.allowed.includes(id)) {
    return null;
  }
  if (policy.optIn.includes(id)) {
    if (!record.optIn) {
      return `licence "${id}" needs (opt-in true)`;
    }
    if (record.attribution !== 'required') {
      return `opt-in licence "${id}" needs (attribution required)`;
    }
    return null;
  }
  return `licence "${id}" is not on the allow list in docs/licensing.md`;
}

/**
 * Validate asset records against the files under `assets/` and the policy.
 *
 * @param {AssetRecord[]} records
 * @param {string[]} files repository-relative paths, `/`-separated
 * @param {LicensePolicy} [policy]
 * @returns {{errors: string[]}}
 */
export function validateAssetRecords(records, files, policy = DEFAULT_POLICY) {
  const errors = [];
  const seen = new Set();
  for (const record of records) {
    const where = `record "${record.id}"`;
    if (seen.has(record.id)) {
      errors.push(`${where}: duplicate record id`);
    }
    seen.add(record.id);
    const problems = [
      ...fieldProblems(record),
      ...fileProblems(record, files),
      ...licenseIds(record.license ?? '')
        .map((id) => licenseProblem(id, record, policy))
        .filter(Boolean),
      ...ownershipProblems(record),
    ];
    errors.push(...problems.map((problem) => `${where}: ${problem}`));
  }
  for (const file of files) {
    const owners = records.filter((record) =>
      record.files.some((pattern) => matchesFile(file, pattern))
    );
    if (owners.length === 0) {
      errors.push(`${file}: no record in assets/assets.lino`);
    } else if (owners.length > 1) {
      const ids = owners.map((record) => record.id).join(', ');
      errors.push(`${file}: matched by more than one record (${ids})`);
    }
  }
  return { errors };
}

/** @param {AssetRecord} record */
function fieldProblems(record) {
  const problems = [
    ...(record.parseErrors ?? []),
    ...(record.missing ?? []).map((name) => `missing required field "${name}"`),
  ];
  if (record.kind !== undefined && !KINDS.includes(record.kind)) {
    problems.push(`kind "${record.kind}" is not one of ${KINDS.join(', ')}`);
  }
  return problems;
}

/**
 * @param {AssetRecord} record
 * @param {string[]} files
 */
function fileProblems(record, files) {
  return record.files.flatMap((pattern) => {
    if (!pattern.startsWith('assets/')) {
      return [`files entry "${pattern}" is not under assets/`];
    }
    return files.some((file) => matchesFile(file, pattern))
      ? []
      : [`files entry "${pattern}" matches no file`];
  });
}

/** @param {AssetRecord} record */
function ownershipProblems(record) {
  if (isOwnAsset(record)) {
    return PUBLIC_DOMAIN_LICENSES.includes(record.license ?? '')
      ? []
      : ['(copyright none) is only for our own CC0-1.0 or Unlicense assets'];
  }
  if (record.copyright === undefined) {
    return [];
  }
  return [
    ...(record.source ? [] : ["third-party asset needs a (source 'URL')"]),
    ...(record.notice ? [] : ["third-party asset needs a (notice 'URL')"]),
  ];
}

/**
 * @param {string} file
 * @param {string} pattern
 */
export function matchesFile(file, pattern) {
  return file === pattern || posix.matchesGlob(file, pattern);
}

/**
 * List the asset files under `<root>/assets`, as `/`-separated paths
 * relative to `root`, skipping the files that describe the assets.
 *
 * @param {string} root
 * @returns {string[]}
 */
export function listAssetFiles(root) {
  const result = [];
  const walk = (relative) => {
    let entries;
    try {
      entries = readdirSync(join(root, relative), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
    for (const entry of entries) {
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(path);
      } else if (!NON_ASSET_FILES.includes(path)) {
        result.push(path);
      }
    }
  };
  walk('assets');
  return result.sort();
}

/**
 * Quote a value for Links Notation output: plain words stay bare, anything
 * else is single-quoted (double-quoted when it contains `'`).
 *
 * @param {string} value
 * @returns {string}
 */
export function linoValue(value) {
  const text = String(value);
  if (/^[A-Za-z0-9._/-]+$/.test(text)) {
    return text;
  }
  if (!text.includes("'")) {
    return `'${text}'`;
  }
  if (!text.includes('"')) {
    return `"${text}"`;
  }
  throw new Error(
    `linoValue: cannot quote a value with both quote marks: ${text}`
  );
}

/** Record fields in the order of assets/assets.lino. */
const RECORD_FIELDS = [
  ['kind', 'kind'],
  ['files', 'files'],
  ['license', 'license'],
  ['copyright', 'copyright'],
  ['source', 'source'],
  ['notice', 'notice'],
  ['attribution', 'attribution'],
  ['attribution-text', 'attributionText'],
  ['commercial-use', 'commercialUse'],
  ['modified', 'modified'],
];

/**
 * Write an asset record in the multi-line form of assets/assets.lino, so
 * parseAssetRecords() reads it back. `(attribution none)` and an empty
 * `files` list are left out.
 *
 * @param {Partial<AssetRecord> & {id: string}} record
 * @returns {string}
 */
export function formatAssetRecord(record) {
  const lines = [`(${record.id}: asset`];
  for (const [field, key] of RECORD_FIELDS) {
    const value = record[key];
    if (
      value === undefined ||
      (key === 'attribution' && value === 'none') ||
      (Array.isArray(value) && value.length === 0)
    ) {
      continue;
    }
    const values = Array.isArray(value) ? value : [value];
    lines.push(`  (${field} ${values.map(linoValue).join(' ')})`);
  }
  if (record.optIn) {
    lines.push('  (opt-in true)');
  }
  return `${lines.join('\n')})`;
}

const tomlString = (value) => JSON.stringify(value);

/**
 * Generate REUSE.toml: the repository as Unlicense, then one annotation per
 * asset record. In REUSE.toml the last matching annotation wins, so the
 * asset records override the repository-wide block.
 *
 * @param {AssetRecord[]} records
 * @returns {string}
 */
export function generateReuseToml(records) {
  const blocks = [
    [
      '# Generated by `node scripts/check-assets.mjs --write` from',
      '# assets/assets.lino. Do not edit by hand.',
      'version = 1',
    ].join('\n'),
    annotation('**', REPOSITORY_COPYRIGHT, 'Unlicense'),
  ];
  for (const record of records) {
    const copyright = isOwnAsset(record)
      ? REPOSITORY_COPYRIGHT
      : (record.copyright ?? '');
    blocks.push(
      annotation(
        record.files.length === 1 ? record.files[0] : record.files,
        copyright,
        record.license ?? ''
      )
    );
  }
  return `${blocks.join('\n\n')}\n`;
}

function annotation(path, copyright, license) {
  const pathValue = Array.isArray(path)
    ? `[${path.map(tomlString).join(', ')}]`
    : tomlString(path);
  return [
    '[[annotations]]',
    `path = ${pathValue}`,
    'precedence = "aggregate"',
    `SPDX-FileCopyrightText = ${tomlString(copyright)}`,
    `SPDX-License-Identifier = ${tomlString(license)}`,
  ].join('\n');
}

/**
 * Compare a generated file with its expected content and, unless only
 * checking, rewrite it when it differs.
 *
 * @param {string} path
 * @param {string} expected
 * @param {{write: boolean}} options
 * @returns {{stale: boolean}}
 */
export function syncGeneratedFile(path, expected, { write }) {
  // Git may check text files out with CRLF (core.autocrlf on Windows).
  const actual = existsSync(path)
    ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    : null;
  const stale = actual !== expected;
  if (stale && write) {
    writeFileSync(path, expected);
  }
  return { stale };
}

/**
 * Run `main(root, argv)` when the module at `moduleUrl` is the entry point.
 * `--root DIR` selects the repository root (default: the current directory).
 *
 * @param {string} moduleUrl `import.meta.url` of the CLI module
 * @param {(root: string, argv: string[]) => number} main
 */
export function runCli(moduleUrl, main) {
  if (
    !process.argv[1] ||
    resolve(process.argv[1]) !== fileURLToPath(moduleUrl)
  ) {
    return;
  }
  const argv = process.argv.slice(2);
  const rootIndex = argv.indexOf('--root');
  const root = resolve(rootIndex === -1 ? '.' : argv[rootIndex + 1]);
  process.exitCode = main(root, argv);
}
