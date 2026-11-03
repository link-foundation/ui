/**
 * A static module graph walk: every file that importing a specifier can
 * load, by reading `import`, `export … from`, `import()` and `require()`
 * specifiers and resolving them like Node.js (relative paths, packages in
 * `node_modules`, `exports` maps). Plain file reads only, so it gives the
 * same answer under Node.js, Bun and Deno.
 *
 * It over-approximates on purpose: every condition of an `exports` entry
 * (`import`, `require`, `react-server`, `default`, …) and both branches of
 * a conditional `require` are followed, so a module that is absent from
 * the graph is not loaded under any condition. Comments are stripped
 * first, so JSDoc `import('…')` types are not followed. The text of a
 * string can look like an import (React's warnings quote
 * `import X from './MyComponent'`), so specifiers that resolve to no file
 * are returned by name, for the caller to check.
 */

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g;

/** The source without block and line comments (URLs in strings are kept). */
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

/** The import specifiers of a module's source. */
export const specifiersOf = (source) =>
  [...stripComments(source).matchAll(SPECIFIER)].map((match) => match[2]);

const isFile = (path) => existsSync(path) && statSync(path).isFile();

/** A file path with Node.js's extension and `index` fallbacks. */
function asFile(path) {
  for (const candidate of [
    path,
    `${path}.js`,
    `${path}.mjs`,
    `${path}.cjs`,
    `${path}.json`,
    join(path, 'index.js'),
  ]) {
    if (isFile(candidate)) {
      return realpathSync(candidate);
    }
  }
  return null;
}

/** Every string target of an `exports` entry, under any condition. */
function targetsOf(entry) {
  if (typeof entry === 'string') {
    return [entry];
  }
  if (Array.isArray(entry)) {
    return entry.flatMap(targetsOf);
  }
  if (entry !== null && typeof entry === 'object') {
    return Object.values(entry).flatMap(targetsOf);
  }
  return [];
}

/** The `exports` entry of a subpath (`.` or `./hooks`), with `*` patterns. */
function exportEntry(exports, subpath) {
  const map =
    typeof exports === 'string' ||
    Array.isArray(exports) ||
    !Object.keys(exports).some((key) => key.startsWith('.'))
      ? { '.': exports }
      : exports;
  if (Object.hasOwn(map, subpath)) {
    return { entry: map[subpath], star: null };
  }
  for (const [key, entry] of Object.entries(map)) {
    const at = key.indexOf('*');
    if (
      at >= 0 &&
      subpath.startsWith(key.slice(0, at)) &&
      subpath.endsWith(key.slice(at + 1))
    ) {
      return {
        entry,
        star: subpath.slice(at, subpath.length - (key.length - at - 1)),
      };
    }
  }
  return null;
}

/** The package directory of `name`, looked up from `fromDir` upwards. */
function packageDir(name, fromDir) {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (isFile(join(candidate, 'package.json'))) {
      return candidate;
    }
    if (dirname(dir) === dir) {
      return null;
    }
  }
}

/** The files a bare specifier (`react`, `@scope/pkg/sub`) can resolve to. */
function resolvePackage(specifier, fromDir) {
  const parts = specifier.split('/');
  const nameLength = specifier.startsWith('@') ? 2 : 1;
  const name = parts.slice(0, nameLength).join('/');
  const subpath = ['.', ...parts.slice(nameLength)].join('/');
  const dir = packageDir(name, fromDir);
  if (dir === null) {
    return null;
  }
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  let targets;
  if (manifest.exports !== undefined) {
    const found = exportEntry(manifest.exports, subpath);
    targets =
      found === null
        ? []
        : targetsOf(found.entry).map((target) =>
            found.star === null ? target : target.replaceAll('*', found.star)
          );
  } else if (subpath === '.') {
    targets = [manifest.main ?? 'index.js', manifest.module].filter(Boolean);
  } else {
    targets = [subpath];
  }
  const files = targets
    .filter((target) => !target.endsWith('.d.ts'))
    .map((target) => asFile(resolve(dir, target)))
    .filter((file) => file !== null);
  return files.length > 0 ? files : null;
}

/** The files a specifier imported by `fromFile` can resolve to. */
function resolveSpecifier(specifier, fromFile) {
  const fromDir = dirname(fromFile);
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const file = asFile(resolve(fromDir, specifier));
    return file === null ? null : [file];
  }
  return resolvePackage(specifier, fromDir);
}

/**
 * Every file that importing `specifier` from `fromFile` can load.
 * @param {string} specifier  a bare or relative specifier
 * @param {string} fromFile  the path of the importing file
 * @returns {{files: string[], unresolved: string[]}} real file paths (the
 *   entry first), and the specifiers that resolve to no file
 */
export function moduleGraph(specifier, fromFile) {
  const entry = resolveSpecifier(specifier, fromFile);
  if (entry === null) {
    throw new Error(`cannot resolve ${specifier} from ${fromFile}`);
  }
  const seen = new Set();
  const unresolved = new Set();
  const queue = [...entry];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    if (file.endsWith('.json')) {
      continue;
    }
    for (const next of specifiersOf(readFileSync(file, 'utf8'))) {
      if (isBuiltin(next)) {
        continue;
      }
      const files = resolveSpecifier(next, file);
      if (files === null) {
        unresolved.add(next);
      } else {
        queue.push(...files);
      }
    }
  }
  return { files: [...seen], unresolved: [...unresolved] };
}
