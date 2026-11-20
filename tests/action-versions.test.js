import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'test-anywhere';

function yamlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules') {
      return [];
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return yamlFiles(path);
    }
    return /\.ya?ml$/.test(entry.name) ? [path] : [];
  });
}

describe('action versions', () => {
  it('use one ref per action across every workflow and composite action', () => {
    // A bump that misses some files leaves jobs on different majors.
    const refs = new Map();
    // Immutable releases used by reusable workflows and their callers.
    const pins = {
      '3d3c42e5aac5ba805825da76410c181273ba90b1': 'v7',
      '949feb2413d6458794dcd2491c4babbbce0c15c1': 'v7',
      f87e5991a6d7451dcb8d9637bfbc97413f497069: 'v4', // docker/setup-buildx-action
      c3c9e263c25d99ce0380d002d59b67737d91b0dc: 'v7', // docker/build-push-action
      e7477775783ea5526144ba13e8db5eec57747ce8: 'v2', // lycheeverse/lychee-action
    };
    for (const file of yamlFiles('.github')) {
      const text = readFileSync(file, 'utf8');
      for (const [, action, ref] of text.matchAll(
        /uses: ([\w.-]+\/[\w./-]+)@([\w.-]+)/g
      )) {
        refs.set(
          action,
          new Set([...(refs.get(action) ?? []), pins[ref] ?? ref])
        );
      }
    }

    expect(refs.get('actions/checkout')).toEqual(new Set(['v7']));
    for (const [action, versions] of refs) {
      expect(`${action} ${[...versions].join(', ')}`).toBe(
        `${action} ${[...versions][0]}`
      );
    }
  });
});
