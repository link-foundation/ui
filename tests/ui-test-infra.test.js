import { describe, it, expect } from 'test-anywhere';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { checkPlaywrightVersion } from '../scripts/check-playwright-version.mjs';
import { defaultMounts } from '../scripts/serve-static.mjs';
import {
  normaliseMounts,
  resolveRequestPath,
  startStaticServer,
} from '../scripts/lib/static-server.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const checker = path.join(repoRoot, 'scripts', 'check-playwright-version.mjs');
const DIGEST = 'a'.repeat(64);

function fixture(pin, tag) {
  const root = mkdtempSync(path.join(tmpdir(), 'pw-version-'));
  mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ devDependencies: { '@playwright/test': pin } })
  );
  writeFileSync(
    path.join(root, '.github', 'workflows', 'ui.yml'),
    `    container:\n      image: mcr.microsoft.com/playwright@sha256:${DIGEST} # v${tag}-noble\n`
  );
  return root;
}

function runChecker(root) {
  return spawnSync(process.execPath, [checker, '--root', root], {
    encoding: 'utf8',
  });
}

describe('check-playwright-version', () => {
  it('passes for this repository', () => {
    const result = checkPlaywrightVersion(repoRoot);
    expect(result.problems).toEqual([]);
    expect(result.checked).toBeGreaterThan(0);
  });

  it('exits 0 when the npm pin and the container tag agree', () => {
    const root = fixture('1.59.1', '1.59.1');
    try {
      expect(runChecker(root).status).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exits 1 when the package.json version differs', () => {
    const root = fixture('1.60.0', '1.59.1');
    try {
      const result = runChecker(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('ui.yml:2');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exits 1 when the pin is a version range', () => {
    const root = fixture('^1.59.1', '1.59.1');
    try {
      expect(runChecker(root).status).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('shared static server', () => {
  const mounts = normaliseMounts([
    { prefix: '/', dir: '/srv/root' },
    { prefix: 'app', dir: '/srv/app' },
  ]);

  it('picks the longest mount and serves index.html for directories', () => {
    expect(resolveRequestPath(mounts, '/app/')).toEqual({
      status: 200,
      file: path.resolve('/srv/app/index.html'),
    });
    expect(resolveRequestPath(mounts, '/a.css')).toEqual({
      status: 200,
      file: path.resolve('/srv/root/a.css'),
    });
  });

  it('serves the ui-dom example with its import map targets', () => {
    const served = normaliseMounts(defaultMounts(repoRoot));
    for (const [url, file] of [
      ['/examples/ui-dom/', 'examples/ui-dom/index.html'],
      ['/packages/ui-dom/src/index.js', 'packages/ui-dom/src/index.js'],
      [
        '/packages/ui-components/examples/layout.html',
        'packages/ui-components/examples/layout.html',
      ],
      ['/packages/ui-core/src/index.js', 'packages/ui-core/src/index.js'],
      [
        '/node_modules/links-notation/dist/index.js',
        'node_modules/links-notation/dist/index.js',
      ],
      [
        '/packages/ui-components/examples/charts.html',
        'packages/ui-components/examples/charts.html',
      ],
      [
        '/node_modules/d3-scale/src/index.js',
        'node_modules/d3-scale/src/index.js',
      ],
      [
        '/node_modules/d3-shape/src/index.js',
        'node_modules/d3-shape/src/index.js',
      ],
      [
        '/node_modules/echarts/dist/echarts.esm.min.mjs',
        'node_modules/echarts/dist/echarts.esm.min.mjs',
      ],
      [
        '/docs/case-studies/issue-1/samples/document.lino',
        'docs/case-studies/issue-1/samples/document.lino',
      ],
    ]) {
      expect(resolveRequestPath(served, url)).toEqual({
        status: 200,
        file: path.resolve(repoRoot, file),
      });
    }
    // Only src/ of a package is served, not its tests or package.json.
    expect(
      resolveRequestPath(
        served,
        '/packages/ui-components/tests/icons/helpers.js'
      ).status
    ).toBe(404);
    expect(
      resolveRequestPath(served, '/packages/ui-dom/package.json').status
    ).toBe(404);
  });

  it('serves package examples and build output (the icon gallery)', () => {
    const mounted = defaultMounts(repoRoot).map((mount) => mount.prefix);
    expect(mounted).toContain('/packages/ui-components/examples/');
    const served = normaliseMounts(defaultMounts(repoRoot));
    expect(
      resolveRequestPath(served, '/packages/ui-components/examples/icons.html')
    ).toEqual({
      status: 200,
      file: path.resolve(
        repoRoot,
        'packages/ui-components/examples/icons.html'
      ),
    });
    // dist/ (the output of `node scripts/build-icons.mjs`) is mounted
    // when it exists.
    const dist = path.join(repoRoot, 'packages/ui-components/dist');
    expect(mounted.includes('/packages/ui-components/dist/')).toBe(
      existsSync(dist)
    );
  });

  it('serves the diagrams example with Dagre and the lazily loaded Mermaid', () => {
    const served = normaliseMounts(defaultMounts(repoRoot));
    for (const [url, file] of [
      [
        '/packages/ui-components/examples/diagrams.html',
        'packages/ui-components/examples/diagrams.html',
      ],
      [
        '/packages/ui-components/src/index.js',
        'packages/ui-components/src/index.js',
      ],
      [
        '/node_modules/@dagrejs/dagre/dist/dagre.esm.js',
        'node_modules/@dagrejs/dagre/dist/dagre.esm.js',
      ],
      [
        '/node_modules/mermaid/dist/mermaid.esm.min.mjs',
        'node_modules/mermaid/dist/mermaid.esm.min.mjs',
      ],
    ]) {
      expect(resolveRequestPath(served, url)).toEqual({
        status: 200,
        file: path.resolve(repoRoot, file),
      });
    }
    // The tests and fixtures of a package stay unserved.
    expect(
      resolveRequestPath(
        served,
        '/packages/ui-components/tests/diagrams/fixtures/login-flow.lino'
      ).status
    ).toBe(404);
  });

  it('refuses paths that escape a mount', () => {
    expect(resolveRequestPath(mounts, '/app/../../etc/passwd').status).toBe(
      403
    );
  });

  it('serves files over HTTP', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'static-'));
    writeFileSync(path.join(dir, 'index.html'), '<p>ok</p>');
    const server = await startStaticServer({ mounts: [{ prefix: '/', dir }] });
    try {
      const ok = await fetch(server.url);
      expect(ok.status).toBe(200);
      expect(ok.headers.get('content-type')).toContain('text/html');
      expect(await ok.text()).toBe('<p>ok</p>');
      expect((await fetch(`${server.url}missing.js`)).status).toBe(404);
    } finally {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Playwright e2e files stay out of unit test runners', () => {
  const pkg = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );
  const deno = JSON.parse(
    readFileSync(path.join(repoRoot, 'deno.json'), 'utf8')
  );
  const config = readFileSync(
    path.join(repoRoot, 'playwright.config.mjs'),
    'utf8'
  );

  it('discovers *.e2e.mjs in tests/ui and packages/*/e2e, *.spec.js in tests/e2e and packages/*/tests/e2e', () => {
    for (const pattern of [
      "'tests/ui/**/*.e2e.mjs'",
      "'packages/*/e2e/**/*.e2e.mjs'",
      "'tests/e2e/**/*.spec.js'",
      "'packages/*/tests/e2e/**/*.spec.js'",
    ]) {
      expect(config).toContain(pattern);
    }
  });

  it('keeps tests/e2e and packages/*/tests/e2e specs out of bun test', () => {
    const bunfig = readFileSync(path.join(repoRoot, 'bunfig.toml'), 'utf8');
    expect(bunfig).toContain('"tests/e2e/**"');
    expect(bunfig).toContain('"packages/*/tests/e2e/**"');
  });

  it('uses a suffix that node, bun and deno default patterns do not match', () => {
    // node --test: explicit *.test.js globs in package.json.
    // bun test: *.test.*, *_test.*, *.spec.*, *_spec.*.
    // deno test: {*_,*.,}test.{js,mjs,ts,...}.
    const defaults = [
      /\.test\.[cm]?[jt]sx?$/,
      /_test\.[cm]?[jt]sx?$/,
      /[._]spec\.[cm]?[jt]sx?$/,
      /(^|\/)test\.[cm]?[jt]sx?$/,
    ];
    for (const name of ['tests/ui/smoke.e2e.mjs', 'packages/x/e2e/a.e2e.mjs']) {
      expect(defaults.some((pattern) => pattern.test(name))).toBe(false);
    }
    expect(pkg.scripts.test).not.toContain('e2e');
    expect(JSON.stringify(deno.test)).not.toContain('e2e');
  });

  it('pins @playwright/test exactly and exposes the npm scripts', () => {
    expect(pkg.devDependencies['@playwright/test']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.scripts['test:ui']).toBe('playwright test');
    expect(pkg.scripts['test:ui:update']).toBe(
      'playwright test --update-snapshots'
    );
    expect(pkg.scripts['test:ui:docker']).toContain(
      `mcr.microsoft.com/playwright:v${pkg.devDependencies['@playwright/test']}-noble`
    );
  });
});
