import { describe, it, expect } from 'test-anywhere';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  isWorkspaceRoot,
  listPublishablePackages,
  listReleasePackagesSync,
  listWorkspacePackages,
  packagePath,
  resolveReleasePackage,
} from '../scripts/workspace-packages.mjs';

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(rootManifest, packages = {}) {
  const root = mkdtempSync(join(tmpdir(), 'workspace-packages-'));
  writeJson(join(root, 'package.json'), rootManifest);
  for (const [dir, manifest] of Object.entries(packages)) {
    mkdirSync(join(root, dir), { recursive: true });
    writeJson(join(root, dir, 'package.json'), manifest);
  }
  return root;
}

function withFixture(rootManifest, packages, run) {
  const root = fixture(rootManifest, packages);
  return Promise.resolve(run(root)).finally(() =>
    rmSync(root, { recursive: true, force: true })
  );
}

const WORKSPACE_ROOT = {
  name: 'root',
  version: '1.0.0',
  private: true,
  workspaces: ['packages/*'],
};
const PACKAGES = {
  'packages/b': { name: '@scope/b', version: '0.2.0' },
  'packages/a': { name: '@scope/a', version: '0.1.0' },
  'packages/internal': {
    name: '@scope/internal',
    version: '0.0.1',
    private: true,
  },
};

describe('workspace-packages', () => {
  it('lists every workspace package sorted by name', () =>
    withFixture(WORKSPACE_ROOT, PACKAGES, async (root) => {
      mkdirSync(join(root, 'packages', 'not-a-package'));
      expect(isWorkspaceRoot(root)).toBe(true);
      expect(await listWorkspacePackages(root)).toEqual([
        {
          dir: 'packages/a',
          name: '@scope/a',
          version: '0.1.0',
          private: false,
        },
        {
          dir: 'packages/b',
          name: '@scope/b',
          version: '0.2.0',
          private: false,
        },
        {
          dir: 'packages/internal',
          name: '@scope/internal',
          version: '0.0.1',
          private: true,
        },
      ]);
    }));

  it('filters private packages from the publishable list', () =>
    withFixture(WORKSPACE_ROOT, PACKAGES, async (root) => {
      const names = (await listPublishablePackages(root)).map((p) => p.name);
      expect(names).toEqual(['@scope/a', '@scope/b']);
      expect(listReleasePackagesSync(root).map((p) => p.name)).toEqual(names);
    }));

  it('falls back to the root package without workspaces', () =>
    withFixture({ name: 'single', version: '3.0.0' }, {}, async (root) => {
      expect(isWorkspaceRoot(root)).toBe(false);
      expect(await listWorkspacePackages(root)).toEqual([]);
      expect(listReleasePackagesSync(root)).toEqual([
        { dir: '.', name: 'single', version: '3.0.0', private: false },
      ]);
      expect(resolveReleasePackage(root, { env: {} }).name).toBe('single');
    }));

  it('rejects duplicate package names', () =>
    withFixture(
      WORKSPACE_ROOT,
      {
        'packages/x': { name: '@scope/same', version: '1.0.0' },
        'packages/y': { name: '@scope/same', version: '1.0.0' },
      },
      async (root) => {
        let error;
        try {
          await listWorkspacePackages(root);
        } catch (caught) {
          error = caught;
        }
        expect(error?.message).toContain('Duplicate workspace package name');
      }
    ));

  it('resolves the release package from RELEASE_PACKAGE when ambiguous', () =>
    withFixture(WORKSPACE_ROOT, PACKAGES, (root) => {
      expect(() => resolveReleasePackage(root, { env: {} })).toThrow(
        'RELEASE_PACKAGE'
      );
      expect(
        resolveReleasePackage(root, { env: { RELEASE_PACKAGE: '@scope/b' } })
          .dir
      ).toBe('packages/b');
      expect(() =>
        resolveReleasePackage(root, { packageName: '@scope/internal' })
      ).toThrow('Unknown release package');
    }));

  it('joins package paths without redundant dot segments', () => {
    expect(packagePath('.', '.', 'CHANGELOG.md')).toBe('CHANGELOG.md');
    expect(packagePath('.', 'packages/a', 'CHANGELOG.md')).toBe(
      'packages/a/CHANGELOG.md'
    );
    expect(packagePath('js', 'packages/a')).toBe('js/packages/a');
    expect(packagePath('.', '.')).toBe('.');
  });
});

describe('repository workspace', () => {
  it('publishes ui-animation, ui-components, ui-config, ui-convert, ui-core, ui-dom, ui-i18n, ui-links, ui-settings, ui-store, ui-style and ui-tokens from packages/', async () => {
    const names = (await listPublishablePackages('.')).map((p) => p.dir);
    expect(names).toEqual([
      'packages/ui-animation',
      'packages/ui-components',
      'packages/ui-config',
      'packages/ui-convert',
      'packages/ui-core',
      'packages/ui-dom',
      'packages/ui-i18n',
      'packages/ui-links',
      'packages/ui-settings',
      'packages/ui-store',
      'packages/ui-style',
      'packages/ui-tokens',
    ]);
  });
});
