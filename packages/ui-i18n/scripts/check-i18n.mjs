#!/usr/bin/env node
/**
 * `npm run check:i18n`: the CI checks of @link-foundation/ui-i18n.
 *
 * 1. Key parity: `lino-i18n check --dir <dir> --reference <locale>` (default
 *    `packages/ui-i18n/locales`, `en`): every locale has exactly the keys of
 *    the reference.
 * 2. No hard-coded text: `checkHardcodedText` on every `.lino` document
 *    (default: all of the repository except `node_modules`, `.git` and
 *    `locales` directories); only documents with `(i18n required)` count.
 *
 * Usage: node packages/ui-i18n/scripts/check-i18n.mjs
 *          [--dir DIR] [--reference LOCALE] [FILE_OR_DIR ...]
 * Exit code 0 when both checks pass, 1 otherwise.
 */

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { checkHardcodedText } from '../src/lint.js';

const SKIPPED_DIRS = new Set(['node_modules', '.git', 'locales']);

/** The default catalog directory: this package's `locales/`. */
export const DEFAULT_LOCALES_DIR = fileURLToPath(
  new URL('../locales/', import.meta.url)
);

/**
 * `runCli` of the lino-i18n CLI. Imported from its real path because its
 * entry-point check fails behind the npm bin symlink, so `npx lino-i18n`
 * prints nothing and exits 0 (link-foundation/lino-i18n#39).
 */
async function linoI18nCli() {
  const entry = fileURLToPath(import.meta.resolve('lino-i18n'));
  const bin = path.join(path.dirname(entry), '..', 'bin', 'lino-i18n.js');
  const { runCli } = await import(pathToFileURL(bin).href);
  return runCli;
}

/** Every `.lino` file under `target` (a file or a directory). */
export function linoFiles(target) {
  if (statSync(target).isFile()) {
    return [target];
  }
  const found = [];
  const entries = readdirSync(target, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );
  for (const entry of entries) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory() && !SKIPPED_DIRS.has(entry.name)) {
      found.push(...linoFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.lino')) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Run both checks.
 * @param {{ dir?: string, reference?: string, targets?: string[],
 *           log?: (line: string) => void, err?: (line: string) => void }} [options]
 * @returns {Promise<number>} the exit code
 */
export async function runCheck(options = {}) {
  const log = options.log ?? console.log;
  const err = options.err ?? console.error;
  const dir = options.dir ?? DEFAULT_LOCALES_DIR;
  const reference = options.reference ?? 'en';
  const runCli = await linoI18nCli();
  const parity = await runCli(
    ['check', '--dir', dir, '--reference', reference],
    {
      log,
      err,
    }
  );
  let failures = parity === 0 ? 0 : 1;
  if (parity !== 0) {
    err(`check:i18n: the catalogs in ${dir} differ from '${reference}'`);
  }
  const targets = options.targets?.length ? options.targets : [process.cwd()];
  let documents = 0;
  for (const file of targets.flatMap(linoFiles)) {
    const diagnostics = checkHardcodedText(readFileSync(file, 'utf8'));
    documents += 1;
    for (const d of diagnostics) {
      err(`${path.relative(process.cwd(), file)}: ${d.code}: ${d.message}`);
      failures += 1;
    }
  }
  log(
    failures === 0
      ? `check:i18n: catalogs aligned, no hard-coded text in ${documents} LiNo files`
      : `check:i18n: ${failures} problem(s)`
  );
  return failures === 0 ? 0 : 1;
}

/** `--dir`, `--reference` and the files or directories to lint. */
export function parseArgs(argv) {
  const options = { targets: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dir' || arg === '--reference') {
      options[arg.slice(2)] = argv[(i += 1)];
    } else {
      options.targets.push(arg);
    }
  }
  return options;
}

const isMain = () => {
  try {
    return (
      realpathSync(process.argv[1] ?? '') ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
};

if (isMain()) {
  process.exitCode = await runCheck(parseArgs(process.argv.slice(2)));
}
