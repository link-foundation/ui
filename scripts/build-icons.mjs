#!/usr/bin/env node
// Build the icon sets of @link-foundation/ui-components.
//
//   node scripts/build-icons.mjs                 # every set
//   node scripts/build-icons.mjs --sets own      # some sets (comma-separated)
//   node scripts/build-icons.mjs --names icons.lino # exact app-selected subset
//   node scripts/build-icons.mjs --check         # validate, write nothing,
//                                                # fail when own-icons.js is stale
//   node scripts/build-icons.mjs --root DIR --out DIR
//
// File sets are the directories under assets/icons/ (assets/icons/own/ is
// ours, CC0-1.0); their asset records come from assets/assets.lino. Adapter
// sets (lucide, tabler, material-symbols, brand) come from the npm packages and
// the records the adapters make. The build stops, writing nothing, when an
// icon has no record, a licence is not on the allow list, or a record
// names a source on the avoid list (Remix Icon, SF Symbols).
//
// For each set it writes <out>/<set>.js (`export default {set, icons,
// records}`) and a <set>.svg sprite (`<symbol id="<set>-<name>">`); then
// NOTICE.lino (every shipped record, in the assets.lino format),
// ATTRIBUTION.md, and licenses/<set>/ (the licence files and notices of
// the third-party sets). The own set is also written to
// packages/ui-components/src/icons/own-icons.js, which the runtime imports.
// SVGO cleans every icon, and fixed colours become currentColor.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize } from 'svgo';
import { readIconSubset } from './lib/icon-subsets.mjs';
import { SIMPLE_ICONS } from '../packages/ui-components/src/icons/adapters/simple-icons.js';
import {
  DEFAULT_POLICY,
  formatAssetRecord,
  listAssetFiles,
  matchesFile,
  parseAssetRecords,
  syncGeneratedFile,
  validateAssetRecords,
} from './lib/asset-records.mjs';
import { renderAttributions } from './render-attributions.mjs';
import { LUCIDE } from '../packages/ui-components/src/icons/adapters/lucide.js';
import { TABLER } from '../packages/ui-components/src/icons/adapters/tabler.js';
import { MATERIAL_SYMBOLS } from '../packages/ui-components/src/icons/adapters/material-symbols.js';
import {
  DEFAULT_ICON_SET,
  ICON_NAMES,
  MIRROR_IN_RTL,
} from '../packages/ui-components/src/icons/names.js';
import { splitSvg } from '../packages/ui-components/src/icons/svg.js';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));

/** The package the icons ship in, relative to the repository root. */
export const PACKAGE_DIR = 'packages/ui-components';
/** The runtime copy of the own set (imported by icon-registry.js). */
export const OWN_MODULE = `${PACKAGE_DIR}/src/icons/own-icons.js`;

/**
 * Sources that must never ship, whatever a record claims: checked against
 * the id, licence, source, copyright, notice and attribution of every
 * record, and against the dependencies of every package.json.
 */
export const AVOID_LIST = Object.freeze([
  Object.freeze({
    name: 'Remix Icon',
    pattern: /remix-?icon/i,
    reason: 'Remix Icon v1.0+ is under the non-free "Remix Icon License v1.0"',
  }),
  Object.freeze({
    name: 'SF Symbols',
    pattern: /sf-?symbols|sf-?pro\b/i,
    reason: 'Apple SF Symbols and SF Pro must never be bundled',
  }),
]);

/** The icon licence allow list (docs/licensing.md). */
export const ICON_POLICY = Object.freeze({
  ...DEFAULT_POLICY,
  allowed: [
    'CC0-1.0',
    'MIT',
    'ISC',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'Apache-2.0',
  ],
  optIn: ['CC-BY-4.0'],
});

/** The adapter sets the build knows, by set name. */
export const ADAPTERS = Object.freeze({
  brand: SIMPLE_ICONS,
  lucide: LUCIDE,
  tabler: TABLER,
  'material-symbols': MATERIAL_SYMBOLS,
});

/** Whether a colour value is a fixed colour that should follow the text. */
const isFixedColor = (value) =>
  !/^(none|currentcolor|inherit|transparent|context-fill|context-stroke)$/i.test(
    value.trim()
  ) && !value.trim().startsWith('url(');

const COLOR_ATTRIBUTES = [
  'fill',
  'stroke',
  'color',
  'stop-color',
  'flood-color',
  'lighting-color',
];

/** SVGO plugin: fixed colours (`#000`, `black`, `rgb()`) → currentColor. */
const currentColorPlugin = {
  name: 'currentColor',
  fn: () => ({
    element: {
      enter(node) {
        for (const name of COLOR_ATTRIBUTES) {
          const value = node.attributes[name];
          if (value !== undefined && isFixedColor(value)) {
            node.attributes[name] = 'currentColor';
          }
        }
        if (node.attributes.style !== undefined) {
          node.attributes.style = node.attributes.style.replace(
            /((?:^|;)\s*(?:fill|stroke|color|stop-color)\s*:\s*)([^;]+)/gi,
            (match, head, value) =>
              isFixedColor(value) ? `${head}currentColor` : match
          );
        }
      },
    },
  }),
};

/** SVGO plugin: drop shapes drawn with neither fill nor stroke. */
const removeInvisiblePlugin = {
  name: 'removeInvisible',
  fn: () => ({
    element: {
      enter(node, parent) {
        if (
          node.name !== 'svg' &&
          node.attributes.fill === 'none' &&
          node.attributes.stroke === 'none'
        ) {
          parent.children = parent.children.filter((child) => child !== node);
        }
      },
    },
  }),
};

/**
 * Clean an SVG document with SVGO and make its colours follow the text.
 * @param {string} text
 * @returns {string}
 */
export function optimizeSvg(text) {
  return optimize(text, {
    multipass: true,
    plugins: [
      removeInvisiblePlugin,
      'preset-default',
      'removeDimensions',
      currentColorPlugin,
    ],
  }).data;
}

/**
 * Avoid-list problems of a record.
 * @param {import('./lib/asset-records.mjs').AssetRecord} record
 * @returns {string[]}
 */
export function avoidListProblems(record) {
  const fields = [
    record.id,
    record.license,
    record.source,
    record.copyright,
    record.notice,
    record.attributionText,
  ].filter((value) => typeof value === 'string');
  return AVOID_LIST.filter(({ pattern }) =>
    fields.some((value) => pattern.test(value))
  ).map(
    ({ name, reason }) =>
      `record "${record.id}": ${name} is on the avoid list (${reason}; see docs/licensing.md)`
  );
}

/**
 * The package.json files of the repository: the root, packages/*,
 * examples/* and native/* (one level), relative to `root`.
 * @param {string} root
 */
function packageJsonFiles(root) {
  const files = ['package.json'];
  for (const parent of ['packages', 'examples', 'native']) {
    const dir = join(root, parent);
    const entries = existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
      : [];
    for (const entry of entries) {
      const file = `${parent}/${entry.name}/package.json`;
      if (entry.isDirectory() && existsSync(join(root, file))) {
        files.push(file);
      }
    }
  }
  return files.filter((file) => existsSync(join(root, file)));
}

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'bundleDependencies',
  'bundledDependencies',
];

/**
 * Dependencies on an avoid-list source in any package.json of the
 * repository (`remixicon`, `sf-symbols`, …).
 * @param {string} root
 * @returns {string[]} one problem per dependency
 */
export function avoidedDependencies(root) {
  const problems = [];
  for (const file of packageJsonFiles(root)) {
    const manifest = JSON.parse(readFileSync(join(root, file), 'utf8'));
    for (const field of DEPENDENCY_FIELDS) {
      const value = manifest[field] ?? {};
      const names = Array.isArray(value) ? value : Object.keys(value);
      for (const name of names) {
        const entry = AVOID_LIST.find(({ pattern }) => pattern.test(name));
        if (entry !== undefined) {
          problems.push(
            `${file}: ${field} "${name}" is on the avoid list (${entry.reason})`
          );
        }
      }
    }
  }
  return problems;
}

/** The icon file sets: the directories under assets/icons/. */
function fileSets(root) {
  try {
    return readdirSync(join(root, 'assets/icons'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Read and check a file set (`assets/icons/<set>/*.svg`).
 * @returns {{icons: Map<string, {svg: string, record: object}>,
 *   records: object[], errors: string[]}}
 */
function readFileSet(root, set, allRecords) {
  const dir = `assets/icons/${set}/`;
  const files = listAssetFiles(root).filter((file) => file.startsWith(dir));
  const records = allRecords.filter((record) =>
    record.files.some(
      (pattern) =>
        pattern.startsWith(dir) ||
        files.some((file) => matchesFile(file, pattern))
    )
  );
  const errors = [
    ...validateAssetRecords(records, files, ICON_POLICY).errors,
    ...records.flatMap(avoidListProblems),
  ];
  for (const record of records) {
    if (record.kind !== 'icon') {
      errors.push(
        `record "${record.id}": kind must be icon, not ${record.kind}`
      );
    }
    if (
      set === DEFAULT_ICON_SET &&
      (record.license !== 'CC0-1.0' || record.copyright !== 'none')
    ) {
      errors.push(
        `record "${record.id}": the own set is ours alone: (license CC0-1.0) (copyright none)`
      );
    }
  }
  const icons = new Map();
  for (const file of files) {
    if (!file.endsWith('.svg')) {
      errors.push(`${file}: icon sets hold SVG files only`);
      continue;
    }
    const name = posix.basename(file, '.svg');
    const record = records.find((r) =>
      r.files.some((pattern) => matchesFile(file, pattern))
    );
    icons.set(name, { svg: readFileSync(join(root, file), 'utf8'), record });
  }
  if (set === DEFAULT_ICON_SET) {
    for (const name of ICON_NAMES) {
      if (!icons.has(name)) {
        errors.push(
          `icon "${name}" is used (ICON_NAMES) but ${dir}${name}.svg is missing`
        );
      }
    }
  }
  return { icons, records, errors };
}

/**
 * The directory of an installed package: node_modules/<name> in the
 * directory of this script or any directory above it. (Some packages, like
 * @tabler/icons, export only their icons, so the resolver cannot find
 * their LICENSE.)
 */
function findPackageDir(name, from = SCRIPTS) {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'node_modules', name, 'package.json'))) {
      return join(dir, 'node_modules', name);
    }
    if (dirname(dir) === dir) {
      return undefined;
    }
  }
}

/** Read and check an adapter set (every logical icon name). */
async function readAdapterSet(adapter, selected) {
  const errors = [];
  const icons = new Map();
  const packageDir = findPackageDir(adapter.packageName);
  if (packageDir === undefined) {
    return {
      icons,
      records: [],
      errors: [
        `${adapter.set}: the npm package ${adapter.packageName} is not installed (npm install, or build other sets with --sets)`,
      ],
    };
  }
  const names = selected
    ? [...selected].map((name) => [
        name,
        Object.hasOwn(adapter.names, name) ? adapter.names[name] : name,
      ])
    : Object.entries(adapter.names);
  for (const [name, library] of names) {
    const record = adapter.record(library);
    if (record === undefined) {
      errors.push(
        `${adapter.set}: icon "${name}" (${library}) has no asset record`
      );
      continue;
    }
    try {
      icons.set(name, { svg: await adapter.loadSvg(library), record });
    } catch (error) {
      errors.push(
        `${adapter.set}: icon "${name}" (${library}) cannot be read: ${error.message}`
      );
    }
  }
  const records = [
    ...new Map(
      [...icons.values()].map(({ record }) => [record.id, record])
    ).values(),
  ];
  errors.push(
    ...validateAssetRecords(records, [], ICON_POLICY).errors,
    ...records.flatMap(avoidListProblems)
  );
  const licenses = {};
  for (const file of adapter.licenseFiles) {
    const path = join(packageDir, file);
    if (existsSync(path)) {
      licenses[file] = readFileSync(path, 'utf8');
    } else {
      errors.push(`${adapter.set}: ${adapter.packageName}/${file} is missing`);
    }
  }
  Object.assign(licenses, adapter.notices);
  return { icons, records, errors, licenses };
}

/** The module text of a built set. */
function moduleText(data) {
  return [
    '// Generated by `node scripts/build-icons.mjs`. Do not edit by hand.',
    `export default ${JSON.stringify(data, null, 2)};`,
    '',
  ].join('\n');
}

/** The sprite of a built set: one `<symbol>` per icon. */
function spriteText(set, icons) {
  const symbols = Object.entries(icons).map(
    ([name, icon]) =>
      `  <symbol id="${set}-${name}" viewBox="${icon.viewBox}">${icon.body}</symbol>`
  );
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">',
    ...symbols,
    '</svg>',
    '',
  ].join('\n');
}

/** A record as plain data for a module (no validator bookkeeping). */
function plainRecord(record, files) {
  const plain = { ...record, files: files ?? record.files };
  delete plain.parseErrors;
  delete plain.missing;
  if (!plain.optIn) {
    delete plain.optIn;
  }
  return plain;
}

/** Compile the icons of a set into module data. */
function compileSet(set, read) {
  const adapter = ADAPTERS[set];
  const title = adapter?.title ?? (set === DEFAULT_ICON_SET ? 'Own' : set);
  const defaults = adapter?.defaults;
  const icons = {};
  for (const [name, { svg, record }] of [...read.icons.entries()].sort(
    ([a], [b]) => a.localeCompare(b)
  )) {
    const { title: iconTitle } = splitSvg(svg);
    const { viewBox, body } = splitSvg(optimizeSvg(svg), { defaults });
    icons[name] = {
      ...(iconTitle ? { title: iconTitle } : {}),
      viewBox,
      body,
      mirrorInRtl: MIRROR_IN_RTL.has(name),
      record: record.id,
    };
  }
  const files = read.licenses
    ? [`dist/icons/${set}.js`, `dist/icons/${set}.svg`]
    : undefined;
  const records = read.records
    .map((record) => plainRecord(record, files))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { set, title, icons, records };
}

/**
 * Parse the command line.
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const value = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  return {
    root: resolve(value('--root') ?? '.'),
    out: value('--out'),
    names: value('--names'),
    sets: value('--sets')
      ?.split(',')
      .map((set) => set.trim())
      .filter(Boolean),
    check: argv.includes('--check'),
  };
}

/**
 * Read and check the wanted sets (every set when `sets` is undefined).
 * @param {string} root
 * @param {string[]|undefined} sets
 */
async function readSets(root, sets, selected) {
  const fileSetNames = fileSets(root);
  const known = [...fileSetNames, ...Object.keys(ADAPTERS)];
  const wanted = sets ?? (selected ? [...selected.keys()] : known);
  const errors = [
    ...avoidedDependencies(root),
    ...wanted
      .filter((set) => !known.includes(set))
      .map((set) => `unknown icon set "${set}" (known: ${known.join(', ')})`),
  ];
  const lino = join(root, 'assets/assets.lino');
  const allRecords = existsSync(lino)
    ? parseAssetRecords(readFileSync(lino, 'utf8'))
    : [];
  const reads = new Map();
  for (const set of wanted.filter((name) => known.includes(name))) {
    const read = fileSetNames.includes(set)
      ? readFileSet(root, set, allRecords)
      : await readAdapterSet(ADAPTERS[set], selected?.get(set));
    if (selected) {
      const names = selected.get(set) ?? new Set();
      for (const name of names) {
        if (!read.icons.has(name)) {
          read.errors.push(`unknown icon "${set}:${name}"`);
        }
      }
      read.icons = new Map([...read.icons].filter(([name]) => names.has(name)));
      const ids = new Set(
        [...read.icons.values()].map(({ record }) => record?.id)
      );
      read.records = read.records.filter((record) => ids.has(record.id));
    }
    errors.push(...read.errors.map((error) => `${set}: ${error}`));
    reads.set(set, read);
  }
  return { errors, reads };
}

/**
 * The files of the built sets: modules, sprites, licences, NOTICE.lino and
 * ATTRIBUTION.md, by path.
 */
function outputFiles(outDir, built, reads) {
  const outputs = new Map();
  for (const [set, data] of Object.entries(built)) {
    outputs.set(join(outDir, `${set}.js`), moduleText(data));
    outputs.set(join(outDir, `${set}.svg`), spriteText(set, data.icons));
    for (const [file, text] of Object.entries(reads.get(set).licenses ?? {})) {
      outputs.set(join(outDir, 'licenses', set, file), text);
    }
  }
  const records = Object.values(built).flatMap((data) => data.records);
  outputs.set(
    join(outDir, 'NOTICE.lino'),
    [
      '# Generated by `node scripts/build-icons.mjs`: the asset record of every',
      '# shipped icon, in the format of assets/assets.lino. Do not edit by hand.',
      '',
      ...records.map((record) => `${formatAssetRecord(record)}\n`),
    ].join('\n')
  );
  outputs.set(
    join(outDir, 'ATTRIBUTION.md'),
    renderAttributions(records, {
      title: 'Icon attributions',
      generator: '`node scripts/build-icons.mjs` from the icon asset records',
    })
  );
  return outputs;
}

const relativePath = (root, path) => relative(root, path).split('\\').join('/');

/**
 * Build the icon sets.
 * @param {{root?: string, out?: string, sets?: string[], names?: string, check?: boolean}} [options]
 *   `check` validates and compares own-icons.js, writing nothing
 * @returns {Promise<{errors: string[], written: string[], stale: string[],
 *   built: Record<string, object>}>}
 */
export async function buildIcons({
  root = '.',
  out,
  sets,
  names,
  check = false,
} = {}) {
  root = resolve(root);
  let selected;
  try {
    selected = names ? readIconSubset(resolve(root, names), sets) : undefined;
  } catch (error) {
    return { errors: [error.message], written: [], stale: [], built: {} };
  }
  const { errors, reads } = await readSets(root, sets, selected);
  if (errors.length > 0) {
    return { errors, written: [], stale: [], built: {} };
  }
  const built = {};
  for (const [set, read] of reads) {
    built[set] = compileSet(set, read);
  }

  const stale = [];
  const ownModule = join(root, OWN_MODULE);
  if (!selected && built[DEFAULT_ICON_SET] && existsSync(dirname(ownModule))) {
    const text = moduleText(built[DEFAULT_ICON_SET]);
    if (syncGeneratedFile(ownModule, text, { write: !check }).stale) {
      stale.push(relativePath(root, ownModule));
    }
  }
  if (check) {
    return { errors, written: [], stale, built };
  }
  const outDir = resolve(root, out ?? `${PACKAGE_DIR}/dist/icons`);
  rmSync(join(outDir, 'licenses'), { recursive: true, force: true });
  const written = [];
  for (const [path, text] of outputFiles(outDir, built, reads)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    written.push(relativePath(root, path));
  }
  return { errors, written, stale, built };
}

async function main(argv) {
  const options = parseArgs(argv);
  const { errors, written, stale, built } = await buildIcons(options);
  if (errors.length > 0) {
    console.error(`build-icons: ${errors.length} problem(s), nothing written:`);
    for (const error of errors) {
      console.error(`::error::${error}`);
    }
    return 1;
  }
  const summary = Object.entries(built)
    .map(([set, data]) => `${set} (${Object.keys(data.icons).length})`)
    .join(', ');
  if (options.check) {
    if (stale.length > 0) {
      console.error(
        `::error::${stale.join(', ')} is stale; run: node scripts/build-icons.mjs`
      );
      return 1;
    }
    console.log(`Icon sets are valid: ${summary}.`);
    return 0;
  }
  console.log(`Built icon sets: ${summary}; wrote ${written.length} files.`);
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(process.argv.slice(2));
}
