import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'test-anywhere';
import { listReleasePackagesSync } from '../scripts/workspace-packages.mjs';
import { checkArchive } from '../experiments/published-consumer/prepare.mjs';

describe('external runtime release', () => {
  it('queues an initial minor release for every public runtime package', () => {
    const pending = listReleasePackagesSync().filter(
      (pkg) => pkg.version === '0.0.0'
    );
    if (!pending.length) {
      return;
    }
    const fragment = readFileSync(
      '.changeset/external-runtime-release.md',
      'utf8'
    );
    for (const pkg of pending) {
      assert.ok(fragment.includes(`'${pkg.name}': minor`), pkg.name);
    }
  });

  it('rejects missing generated exports and licenses in an archive', () => {
    const manifest = {
      name: 'fixture',
      exports: { './icons/*': './dist/icons/*' },
    };
    assert.throws(
      () => checkArchive(manifest, ['package.json', 'README.md']),
      /LICENSE/
    );
    const files = ['package.json', 'README.md', 'LICENSE'];
    assert.throws(() => checkArchive(manifest, files), /missing export/);
    checkArchive(manifest, [...files, 'dist/icons/own.js']);
  });
});
