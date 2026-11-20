/** Install a staged release or published packages in an isolated consumer. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listReleasePackagesSync } from '../../scripts/workspace-packages.mjs';

const repo = fileURLToPath(new globalThis.URL('../../', import.meta.url));
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const registryUrl = 'https://registry.npmjs.org/';

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    },
  });
}

/** Every concrete export/type/bin target must be present in the archive. */
export function checkArchive(manifest, paths) {
  const files = new Set(paths);
  for (const file of ['LICENSE', 'README.md', 'package.json']) {
    assert.ok(files.has(file), `${manifest.name}: missing ${file}`);
  }
  function target(value) {
    if (typeof value === 'string' && value.startsWith('./')) {
      const path = value.slice(2);
      const [prefix, suffix = ''] = path.split('*');
      assert.ok(
        path.includes('*')
          ? paths.some(
              (file) => file.startsWith(prefix) && file.endsWith(suffix)
            )
          : files.has(path),
        `${manifest.name}: missing export ${value}`
      );
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(target);
    }
  }
  target(manifest.exports);
  target(manifest.bin);
  target(manifest.types);
}

async function packRelease(root, packages) {
  // Use the semver implementation declared by the release CLI itself.
  const require = createRequire(join(repo, 'package.json'));
  const { satisfies, gte } = createRequire(
    require.resolve('@changesets/cli/package.json')
  )('semver');
  const stage = join(root, 'release');
  await mkdir(stage);
  for (const file of [
    'package.json',
    'package-lock.json',
    '.prettierrc',
    '.changeset',
    'scripts',
    'assets',
  ]) {
    await cp(join(repo, file), join(stage, file), { recursive: true });
  }
  // Copy package sources only; never copy a dependency tree or stale dist.
  for (const pkg of packages) {
    await cp(join(repo, pkg.dir), join(stage, pkg.dir), {
      recursive: true,
      filter: (source) =>
        !['node_modules', 'dist', 'tests', 'e2e'].includes(
          source.split(/[\\/]/).at(-1)
        ),
    });
  }
  await symlink(
    join(repo, 'node_modules'),
    join(stage, 'node_modules'),
    'junction'
  );
  const changesets = await readdir(join(stage, '.changeset'));
  if (changesets.some((file) => file.endsWith('.md') && file !== 'README.md')) {
    run(
      process.execPath,
      [join(stage, 'scripts/changeset-version.mjs')],
      stage
    );
  }
  const manifests = await Promise.all(
    packages.map((pkg) => json(join(stage, pkg.dir, 'package.json')))
  );
  const versions = new Map(manifests.map((p) => [p.name, p.version]));
  for (const manifest of manifests) {
    assert.ok(
      gte(manifest.version, '0.1.0'),
      `${manifest.name}: unreleased version`
    );
    for (const field of [
      'dependencies',
      'optionalDependencies',
      'peerDependencies',
      'devDependencies',
    ]) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        if (versions.has(name)) {
          assert.ok(
            satisfies(versions.get(name), range),
            `${manifest.name}: ${name}@${range} excludes released sibling`
          );
        }
      }
    }
  }
  const archives = [];
  for (const pkg of packages) {
    // Intentionally run prepack: ignoring it hid missing icons and workers.
    const output = run(
      npm,
      ['pack', '--json', '--pack-destination', root],
      join(stage, pkg.dir)
    );
    const [archive] = JSON.parse(output.slice(output.indexOf('[\n')));
    const manifest = manifests.find((p) => p.name === pkg.name);
    checkArchive(
      manifest,
      archive.files.map((f) => f.path)
    );
    if (pkg.name === '@link-foundation/ui-components') {
      for (const asset of [
        'icons/own.js',
        'icons/lucide.js',
        'icons/tabler.js',
        'icons/material-symbols.js',
        'icons/NOTICE.lino',
        'icons/ATTRIBUTION.md',
        'icons/licenses/lucide/LICENSE',
        'icons/licenses/tabler/LICENSE',
        'icons/licenses/material-symbols/LICENSE',
        'network-layout.worker.mjs',
        'network-layout-NOTICE.md',
        'network-layout-dagre-LICENSE.txt',
        'network-layout-d3-force-LICENSE.txt',
        'network-layout-d3-dispatch-LICENSE.txt',
        'network-layout-d3-quadtree-LICENSE.txt',
        'network-layout-d3-timer-LICENSE.txt',
      ]) {
        assert.ok(
          archive.files.some((f) => f.path === `dist/${asset}`),
          `Missing generated asset ${asset}`
        );
      }
    }
    archives.push({
      name: pkg.name,
      version: manifest.version,
      filename: archive.filename,
      shasum: archive.shasum,
      integrity: archive.integrity,
    });
  }
  // The consumer must remain usable after its release source disappears.
  await rm(stage, { recursive: true, force: true });
  return archives;
}

export async function prepareConsumer() {
  const registry = process.env.UI_RELEASE_REGISTRY === '1';
  const root = await mkdtemp(join(tmpdir(), 'ui-published-consumer-'));
  const app = join(root, 'app');
  try {
    await mkdir(app);
    const packages = listReleasePackagesSync(repo);
    const archives = registry ? [] : await packRelease(root, packages);
    const dependencies = Object.fromEntries(
      registry
        ? packages.map(({ name, version }) => [name, version])
        : archives.map(({ name, filename }) => [
            name,
            `file:${join(root, filename)}`,
          ])
    );
    const locked = await json(join(repo, 'package-lock.json'));
    for (const name of ['react', 'react-dom', 'vue', 'vite']) {
      dependencies[name] = locked.packages[`node_modules/${name}`].version;
    }
    await writeFile(
      join(app, 'package.json'),
      JSON.stringify(
        {
          name: 'external-ui-consumer',
          private: true,
          type: 'module',
          dependencies,
        },
        null,
        2
      )
    );
    // No symlinks, source aliases, devDependencies, or lifecycle bypass.
    const installArgs = ['install', '--omit=dev', '--legacy-peer-deps'];
    if (registry) {
      installArgs.push(`--registry=${registryUrl}`, '--prefer-online');
    }
    run(npm, installArgs, app);
    if (registry) {
      const lock = await json(join(app, 'package-lock.json'));
      for (const [path, entry] of Object.entries(lock.packages)) {
        if (path) {
          assert.ok(
            !entry.link &&
              entry.resolved?.startsWith(registryUrl) &&
              entry.integrity,
            `${path}: expected an npm registry archive with an integrity hash`
          );
        }
      }
    } else {
      await writeFile(
        join(root, 'archives.json'),
        JSON.stringify(archives, null, 2)
      );
    }
    for (const file of ['index.html', 'main.js']) {
      await cp(
        join(repo, 'experiments/published-consumer', file),
        join(app, file)
      );
    }
    return { root, app, archives };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const consumer = await prepareConsumer();
  console.log(JSON.stringify(consumer, null, 2));
}
