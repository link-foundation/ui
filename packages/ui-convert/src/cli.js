#!/usr/bin/env node
/**
 * The ui-convert command line:
 *
 *   ui-convert import <file.json> [--format <name>] [--style <style>]
 *   ui-convert import --from jsx|vue|html <file> [--mapping <name|file.lino>]
 *                     [--style <style>]
 *   ui-convert export <file.lino> --format <name> [--id <id>]
 *                     [--target-version <version>]
 *   ui-convert export --target react|vue|swiftui|compose <file.lino>
 *                     [--mode wrapper|eject] [--out <dir>]
 *
 * `import` writes LiNo to stdout (`--from` reads component markup: JSX or
 * TSX, a Vue single-file component or HTML; a `.jsx`, `.tsx`, `.vue`,
 * `.html` or `.htm` file needs no `--from`), `export` writes JSON (A2UI: one message
 * per line, the JSON Lines wire format), or source files with `--target`.
 * A file named `-` is stdin.
 * Diagnostics go to stderr, one per line; the exit code is 1 when one of
 * them is an error (the output is still written when there is one), 2 for a
 * usage error.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CONVERTERS, FORMATS, detectFormat } from './interop/index.js';
import { importHtml } from './html/import.js';
import { importJsx } from './jsx/import.js';
import { importVue } from './vue/import.js';
import { MAPPINGS } from './mappings/index.js';
import { TARGETS } from './export/index.js';
import { exportCommand } from './export/cli.js';

/** The component importers of `import --from`. */
export const SOURCES = {
  jsx: importJsx,
  vue: importVue,
  html: importHtml,
};

/** `--from` of a file by its extension. */
const EXTENSIONS = {
  '.jsx': 'jsx',
  '.tsx': 'jsx',
  '.vue': 'vue',
  '.html': 'html',
  '.htm': 'html',
};

const sourceOf = (file) =>
  Object.entries(EXTENSIONS).find(([extension]) =>
    file.toLowerCase().endsWith(extension)
  )?.[1];

export const USAGE = `Usage:
  ui-convert import <file.json> [--format <name>] [--style <style>]
  ui-convert import --from jsx|vue|html <file> [--mapping <name|file.lino>] [--style <style>]
  ui-convert export <file.lino> --format <name> [--id <id>] [--target-version <version>]

  ui-convert export --target react|vue|swiftui|compose [--mode wrapper|eject] [--component-name App] [--out <dir>] <file.lino>

Formats: ${FORMATS.join(', ')}. A file named - is read from stdin.
import detects the format when --format is missing.
--from reads component markup (.jsx, .tsx, .vue, .html files need no --from);
--mapping is a built-in mapping (mui, the default) or a .lino rule file;
  repeat it to try several, the first match wins.
--style is one of indented (default), multiline, inline.`;

const OPTIONS = {
  '--target': 'target',
  '--mode': 'mode',
  '--out': 'out',
  '--component-name': 'componentName',
  '--format': 'format',
  '--style': 'style',
  '--id': 'id',
  '--target-version': 'targetVersion',
  '--from': 'from',
  '--mapping': 'mapping',
};

class UsageError extends Error {}

/**
 * Parse the command line arguments.
 * @param {string[]} argv The arguments after the program name.
 * @returns {{ command: string, file: string, format?: string,
 *   style?: string, id?: string, targetVersion?: string, from?: string,
 *   mappings?: string[] }}
 */
export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command !== 'import' && command !== 'export') {
    throw new UsageError(
      command === undefined ? 'No command.' : `Unknown command "${command}".`
    );
  }
  const args = { command };
  for (let i = 0; i < rest.length; i++) {
    const [flag, inline] = rest[i].split(/=(.*)/s, 2);
    if (flag in OPTIONS) {
      const next = inline ?? rest[++i];
      if (next === undefined) {
        throw new UsageError(`${flag} needs a value.`);
      }
      if (flag === '--mapping') {
        args.mappings = [...(args.mappings ?? []), next];
      } else {
        args[OPTIONS[flag]] = next;
      }
    } else if (rest[i].startsWith('--')) {
      throw new UsageError(`Unknown option "${rest[i]}".`);
    } else if (args.file === undefined) {
      args.file = rest[i];
    } else {
      throw new UsageError(`Unexpected argument "${rest[i]}".`);
    }
  }
  return checkArgs(args);
}

/** Validate parsed arguments and fill in `from` for import. */
function checkArgs(args) {
  const { command } = args;
  if (args.file === undefined) {
    throw new UsageError(`${command} needs a file.`);
  }
  if (args.format !== undefined && !FORMATS.includes(args.format)) {
    throw new UsageError(`Unknown format "${args.format}".`);
  }
  if (command === 'import' && args.format === undefined) {
    args.from ??= sourceOf(args.file);
  }
  if (args.from !== undefined && !(args.from in SOURCES)) {
    throw new UsageError(`Unknown --from "${args.from}".`);
  }
  checkSourceArgs(args);
  if (
    command === 'export' &&
    args.format === undefined &&
    args.target === undefined
  ) {
    throw new UsageError('export needs --format.');
  }
  return args;
}

/** Validate source-export flags separately from interop flags. */
function checkSourceArgs(args) {
  const { command } = args;
  if (args.target !== undefined) {
    if (
      command !== 'export' ||
      args.format !== undefined ||
      !TARGETS.includes(args.target)
    ) {
      throw new UsageError(
        'Use export --target react|vue|swiftui|compose without --format.'
      );
    }
    if (args.mode !== undefined && !['wrapper', 'eject'].includes(args.mode)) {
      throw new UsageError('Unknown --mode.');
    }
  } else if (
    args.mode !== undefined ||
    args.out !== undefined ||
    args.componentName !== undefined
  ) {
    throw new UsageError('--mode, --out and --component-name need --target.');
  }
}

/**
 * Read JSON text: one JSON value, or JSON Lines (A2UI streams).
 * @param {string} text
 * @returns {unknown}
 */
export function readJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    if (lines.length < 2) {
      throw error;
    }
    return lines.map((line) => JSON.parse(line));
  }
}

/** One diagnostic as a line of text. */
export const formatDiagnostic = ({ severity, code, message, at, id, span }) => {
  const where = [
    at?.format,
    at?.path ?? at?.element ?? id ?? undefined,
    span ? `${span.start}-${span.end}` : undefined,
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(' ');
  return `${severity} ${code}${where ? ` (${where})` : ''}: ${message}`;
};

/** The output text of an export. */
const writeJson = (format, json) =>
  format === 'a2ui'
    ? `${json.map((message) => JSON.stringify(message)).join('\n')}\n`
    : `${JSON.stringify(json, null, 2)}\n`;

function convert(args, text) {
  if (args.command === 'import' && args.from !== undefined) {
    const { text: lino, diagnostics } = SOURCES[args.from](text, {
      mappings: args.mappings,
      style: args.style,
    });
    return { output: lino.endsWith('\n') ? lino : `${lino}\n`, diagnostics };
  }
  if (args.command === 'export') {
    const { json, diagnostics } = CONVERTERS[args.format].export(text, args);
    const output = json === null ? '' : writeJson(args.format, json);
    return { output, diagnostics };
  }
  let json;
  try {
    json = readJson(text);
  } catch (error) {
    throw new UsageError(`${args.file} is not JSON: ${error.message}`);
  }
  const format = args.format ?? detectFormat(json);
  if (format === null) {
    throw new UsageError(
      `The format of ${args.file} is not detected; pass --format.`
    );
  }
  const { lino, diagnostics } = CONVERTERS[format].import(json, args);
  return { output: lino.endsWith('\n') ? lino : `${lino}\n`, diagnostics };
}

/**
 * Run the command line.
 * @param {string[]} argv The arguments after the program name.
 * @param {{ stdout: { write(text: string): void },
 *   stderr: { write(text: string): void },
 *   readFile?: (file: string) => string }} io
 * @returns {number | Promise<number>} The exit code (source export is asynchronous).
 */
export function main(argv, io) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    io.stdout.write(`${USAGE}\n`);
    return argv.length === 0 ? 2 : 0;
  }
  const readFile = io.readFile ?? ((file) => readFileSync(file, 'utf8'));
  try {
    const args = parseArgs(argv);
    // A mapping is a built-in name (mui) or a rule file.
    args.mappings = args.mappings?.map((mapping) =>
      MAPPINGS.includes(mapping) ? mapping : readFile(mapping)
    );
    const text = readFile(args.file === '-' ? 0 : args.file);
    if (args.target !== undefined) {
      return exportCommand(args, text, io, formatDiagnostic).catch((error) => {
        io.stderr.write(`ui-convert: ${error.message}\n`);
        return 2;
      });
    }
    const { output, diagnostics } = convert(args, text);
    io.stdout.write(output);
    for (const diagnostic of diagnostics) {
      io.stderr.write(`${formatDiagnostic(diagnostic)}\n`);
    }
    return diagnostics.some((d) => d.severity === 'error') ? 1 : 0;
  } catch (error) {
    if (!(error instanceof UsageError) && error?.code !== 'ENOENT') {
      throw error;
    }
    io.stderr.write(`ui-convert: ${error.message}\n\n${USAGE}\n`);
    return 2;
  }
}

/** Whether this module is the program (also through an npm bin link). */
function isProgram() {
  try {
    const program = process.argv[1];
    return (
      program !== undefined &&
      import.meta.url === pathToFileURL(realpathSync(program)).href
    );
  } catch {
    return false;
  }
}

if (isProgram()) {
  process.exitCode = await main(process.argv.slice(2), process);
}
