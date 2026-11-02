/**
 * The `link-ui-tokens` command line:
 *
 * ```sh
 * link-ui-tokens build tokens.lino --set material3 \
 *   --css out.css --dtcg out.json --swift Tokens.swift --kotlin Tokens.kt
 * link-ui-tokens import tokens.json --id material3 --out tokens.lino
 * ```
 *
 * `main(argv, io)` does the work and returns the exit code, so that tests
 * run it in-process on every runtime; `bin/cli.js` calls it.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { toCss } from './export/css.js';
import { toDtcg } from './export/dtcg.js';
import { toKotlin } from './export/kotlin.js';
import { toSwift } from './export/swift.js';
import { fromDtcg } from './import/dtcg.js';
import { readTokens } from './model.js';
import { resolveTokens } from './resolve.js';

export const USAGE = `Usage:
  link-ui-tokens build FILE.lino [--set ID] [--mode NAME]
      [--css FILE] [--dtcg FILE] [--swift FILE] [--kotlin FILE]
      [--prefix P] [--selector S] [--mode-media NAME=QUERY]...
      [--name Tokens] [--package com.example.tokens] [--resolve-aliases]
  link-ui-tokens import FILE.tokens.json [--id ID] [--out FILE.lino]

build   resolve one token set and write it; CSS goes to stdout when no
        output is given. --set may be left out when the file has one set.
import  write a DTCG 2025.10 token file as a Links Notation token set.
`;

const OPTIONS = {
  set: { type: 'string' },
  mode: { type: 'string' },
  css: { type: 'string' },
  dtcg: { type: 'string' },
  swift: { type: 'string' },
  kotlin: { type: 'string' },
  prefix: { type: 'string' },
  selector: { type: 'string' },
  'mode-media': { type: 'string', multiple: true },
  name: { type: 'string' },
  package: { type: 'string' },
  'resolve-aliases': { type: 'boolean' },
  id: { type: 'string' },
  out: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
};

/** @typedef {{ stdout: (text: string) => void, stderr: (text: string) => void }} Io */

const defaultIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

async function write(file, text) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
}

/** Print diagnostics; whether any is an error. */
function report(diagnostics, file, io) {
  for (const d of diagnostics) {
    io.stderr(`${file}: ${d.severity}: ${d.message} [${d.code}]\n`);
  }
  return diagnostics.some((d) => d.severity === 'error');
}

function modeMedia(entries = []) {
  return Object.fromEntries(
    entries.map((entry) => {
      const i = entry.indexOf('=');
      if (i <= 0) {
        throw new Error(`--mode-media wants NAME=QUERY, not "${entry}"`);
      }
      return [entry.slice(0, i), entry.slice(i + 1)];
    })
  );
}

async function build(file, values, io) {
  const { sets, diagnostics } = readTokens(await readFile(file, 'utf8'));
  if (report(diagnostics, file, io)) {
    return 1;
  }
  const setId =
    values.set ?? (sets.size === 1 ? [...sets.keys()][0] : undefined);
  if (setId === undefined) {
    io.stderr(
      `${file}: --set is needed; the sets are: ${[...sets.keys()].join(', ')}\n`
    );
    return 2;
  }
  const resolved = resolveTokens(sets, setId, { mode: values.mode ?? null });
  if (report(resolved.diagnostics, file, io)) {
    return 1;
  }
  const outputs = [
    [
      'css',
      () =>
        toCss(resolved, {
          prefix: values.prefix,
          selector: values.selector,
          modeMedia: modeMedia(values['mode-media']),
        }),
    ],
    [
      'dtcg',
      () =>
        `${JSON.stringify(toDtcg(resolved, { keepAliases: !values['resolve-aliases'] }), null, 2)}\n`,
    ],
    ['swift', () => toSwift(resolved, { name: values.name })],
    [
      'kotlin',
      () =>
        toKotlin(resolved, { name: values.name, packageName: values.package }),
    ],
  ];
  const wanted = outputs.filter(([key]) => values[key] !== undefined);
  if (wanted.length === 0) {
    io.stdout(outputs[0][1]());
  }
  for (const [key, render] of wanted) {
    await write(values[key], render());
  }
  return 0;
}

async function importDtcg(file, values, io) {
  const text = fromDtcg(await readFile(file, 'utf8'), { id: values.id });
  if (values.out === undefined) {
    io.stdout(text);
  } else {
    await write(values.out, text);
  }
  return 0;
}

/**
 * Run the command line.
 * @param {string[]} argv  the arguments after the program name
 * @param {Io} [io]
 * @returns {Promise<number>} the exit code
 */
export async function main(argv, io = defaultIo) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: OPTIONS,
      allowPositionals: true,
    });
  } catch (error) {
    io.stderr(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [command, file, ...extra] = positionals;
  if (values.help || command === 'help') {
    io.stdout(USAGE);
    return 0;
  }
  const commands = { build, import: importDtcg };
  if (
    !Object.hasOwn(commands, command ?? '') ||
    file === undefined ||
    extra.length > 0
  ) {
    io.stderr(USAGE);
    return 2;
  }
  try {
    return await commands[command](file, values, io);
  } catch (error) {
    io.stderr(`link-ui-tokens: ${error.message}\n`);
    return 1;
  }
}
