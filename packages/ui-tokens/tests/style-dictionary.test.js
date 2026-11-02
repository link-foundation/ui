/**
 * `buildWithStyleDictionary(resolved, config)`: Style Dictionary as an
 * optional peer dependency, tried with a stand-in class.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'test-anywhere';
import { buildWithStyleDictionary } from '@link-foundation/ui-tokens/style-dictionary';
import { PACKAGE, sample } from './helpers.js';

/** A stand-in of the StyleDictionary class that records what it was given. */
function fakeStyleDictionary() {
  const seen = {};
  class FakeStyleDictionary {
    constructor(config) {
      seen.config = config;
      seen.source = JSON.parse(readFileSync(config.source[0], 'utf8'));
    }

    buildAllPlatforms() {
      seen.built = true;
      return Promise.resolve();
    }
  }
  return { FakeStyleDictionary, seen };
}

describe('buildWithStyleDictionary', () => {
  it('builds the DTCG form of the tokens and removes the temporary file', async () => {
    const { FakeStyleDictionary, seen } = fakeStyleDictionary();
    const config = { platforms: { css: { transformGroup: 'css', files: [] } } };
    const sd = await buildWithStyleDictionary(sample(), config, {
      StyleDictionary: FakeStyleDictionary,
    });
    expect(sd instanceof FakeStyleDictionary).toBe(true);
    expect(seen.built).toBe(true);
    expect(seen.config.platforms).toEqual(config.platforms);
    expect(seen.source.space.medium).toEqual({
      $type: 'dimension',
      $value: { value: 16, unit: 'px' },
    });
    expect(existsSync(seen.config.source[0])).toBe(false);
  });

  it('names the peer dependency when it is not installed', async () => {
    let error;
    try {
      await buildWithStyleDictionary(sample(), { platforms: {} });
    } catch (caught) {
      error = caught;
    }
    // style-dictionary is never installed by this repository.
    expect(error.message).toContain('npm install --save-dev style-dictionary');
  });

  it('is an optional peer dependency only', () => {
    const pkg = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8'));
    expect(pkg.peerDependencies['style-dictionary']).toBe('>=4.0.0');
    expect(pkg.peerDependenciesMeta['style-dictionary']).toEqual({
      optional: true,
    });
    expect(pkg.dependencies['style-dictionary']).toBeUndefined();
    expect(pkg.devDependencies?.['style-dictionary']).toBeUndefined();
  });
});
