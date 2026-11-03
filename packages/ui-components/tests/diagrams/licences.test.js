/**
 * Only permissive licences are shipped: no EPL-licensed package (ELK.js,
 * Graphviz builds such as `@hpcc-js/wasm-graphviz`) is in the `dependencies`
 * of any workspace package. Such layout engines may only be registered as
 * plugins by an app (see src/diagrams/layout-plugins.js).
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, it, expect } from 'test-anywhere';

const ROOT = new URL('../../../../', import.meta.url);
const read = (url) => JSON.parse(readFileSync(url, 'utf8'));

/** Every package.json of the repository: the root and each workspace. */
function manifests() {
  const packages = new URL('packages/', ROOT);
  return [
    { name: 'package.json', json: read(new URL('package.json', ROOT)) },
    ...readdirSync(packages)
      .filter((dir) => existsSync(new URL(`${dir}/package.json`, packages)))
      .sort()
      .map((dir) => ({
        name: `packages/${dir}/package.json`,
        json: read(new URL(`${dir}/package.json`, packages)),
      })),
  ];
}

/** Packages known to be EPL licensed. */
const EPL_PACKAGES = [/^elkjs$/, /^@hpcc-js\//, /^graphviz/, /^viz\.js$/];
const isEpl = (licence) => /\bEPL\b|Eclipse Public License/i.test(licence);

/** The licence of an installed package, or null when it is not installed. */
function installedLicence(name) {
  const file = new URL(`node_modules/${name}/package.json`, ROOT);
  if (!existsSync(file)) {
    return null;
  }
  const { license, licenses } = read(file);
  if (typeof license === 'string') {
    return license;
  }
  return JSON.stringify(license ?? licenses ?? '');
}

describe('licences', () => {
  const all = manifests();

  it('finds the workspace packages', () => {
    const names = all.map((entry) => entry.name);
    expect(names).toContain('packages/ui-components/package.json');
    expect(names.length > 2).toBe(true);
  });

  for (const { name, json } of all) {
    it(`ships no EPL package in the dependencies of ${name}`, () => {
      for (const dependency of Object.keys(json.dependencies ?? {})) {
        expect(EPL_PACKAGES.some((re) => re.test(dependency))).toBe(false);
        const licence = installedLicence(dependency);
        if (licence !== null) {
          expect(isEpl(licence)).toBe(false);
        }
      }
    });
  }

  it('recognises EPL licences', () => {
    expect(isEpl('EPL-2.0')).toBe(true);
    expect(isEpl('(MIT OR EPL-1.0)')).toBe(true);
    expect(isEpl('MIT')).toBe(false);
    expect(EPL_PACKAGES.some((re) => re.test('elkjs'))).toBe(true);
  });

  it('uses Dagre (MIT) for layout and keeps Mermaid (MIT) an optional peer', () => {
    const { json } = all.find(
      (entry) => entry.name === 'packages/ui-components/package.json'
    );
    expect(Object.keys(json.dependencies)).toContain('@dagrejs/dagre');
    expect(installedLicence('@dagrejs/dagre')).toBe('MIT');
    expect(installedLicence('mermaid')).toBe('MIT');
    expect(Object.keys(json.dependencies).includes('mermaid')).toBe(false);
    expect(json.peerDependencies.mermaid).toBe('^11.0.0 || ^12.0.0');
    // Mermaid 12 depends on elkjs (EPL-2.0); the copy used by the tests (11)
    // does not, so no EPL package is in the lock either.
    expect(installedLicence('elkjs')).toBeNull();
    expect(json.peerDependenciesMeta.mermaid.optional).toBe(true);
  });
});
