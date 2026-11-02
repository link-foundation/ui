// Validate the DTCG golden files of ui-tokens with Terrazzo (parser and
// recommended lint rules) and Style Dictionary, installed outside the repo:
//   mkdir /tmp/dtcg-validate && cd /tmp/dtcg-validate && npm init -y &&
//   npm install --ignore-scripts @terrazzo/parser style-dictionary
//   node experiments/ui-tokens-validate-dtcg.mjs /tmp/dtcg-validate
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [tools] = process.argv.slice(2);
const require = createRequire(join(tools, 'package.json'));
const load = async (name) => import(pathToFileURL(require.resolve(name)).href);
const version = (name) =>
  JSON.parse(
    readFileSync(join(tools, 'node_modules', name, 'package.json'), 'utf8')
  ).version;

const golden = new URL('../packages/ui-tokens/tests/golden/', import.meta.url);
const files = ['material3.tokens.json', 'full/brand.tokens.json'];

const terrazzo = await load('@terrazzo/parser');
console.log(`@terrazzo/parser ${version('@terrazzo/parser')}`);
for (const name of files) {
  const filename = new URL(name, golden);
  // Terrazzo's core/valid-shadow (2.10.0) rejects a reference as a layer
  // of a shadow array, which DTCG 2025.10 section 9.6 allows ("each element
  // must be either an explicit shadow object or a reference to another
  // shadow token", Example 54): LENIENT=1 turns that one rule off.
  const rules = { ...terrazzo.RECOMMENDED_CONFIG };
  if (process.env.LENIENT) {
    rules['core/valid-shadow'] = 'off';
  }
  const config = terrazzo.defineConfig(
    { lint: { rules } },
    { cwd: new URL('./', golden) }
  );
  let tokens;
  try {
    ({ tokens } = await terrazzo.parse(
      [{ src: readFileSync(filename, 'utf8'), filename }],
      { config, logger: new terrazzo.Logger({ level: 'warn' }) }
    ));
  } catch (error) {
    process.exitCode = 1;
    console.log(`  ${name}: INVALID\n${error.message}`);
    continue;
  }
  const summary = Object.values(tokens).map((t) => `${t.id}:${t.$type}`);
  console.log(
    `  ${name}: valid, ${summary.length} tokens: ${summary.join(' ')}`
  );
}

const { default: StyleDictionary } = await load('style-dictionary');
console.log(`style-dictionary ${version('style-dictionary')}`);
for (const name of files) {
  const sd = new StyleDictionary({
    source: [new URL(name, golden).pathname],
    log: {
      verbosity: 'verbose',
      warnings: 'warn',
      errors: { brokenReferences: 'throw' },
    },
    platforms: { css: { transformGroup: 'css', files: [] } },
  });
  let dictionary;
  try {
    dictionary = await sd.getPlatformTokens('css');
  } catch (error) {
    process.exitCode = 1;
    console.log(`  ${name}: INVALID\n${error.message}`);
    continue;
  }
  const list = dictionary.allTokens.map(
    (t) => `${t.name}=${JSON.stringify(t.$value ?? t.value)}`
  );
  console.log(`  ${name}: valid, ${list.length} tokens`);
  console.log(`    ${list.join('\n    ')}`);
}

// buildWithStyleDictionary with the real Style Dictionary: light and dark.
const { mkdtempSync, rmSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { readTokens, resolveTokens } =
  await import('@link-foundation/ui-tokens');
const { buildWithStyleDictionary } =
  await import('@link-foundation/ui-tokens/style-dictionary');
const full = new URL(
  '../packages/ui-tokens/tests/fixtures/full.lino',
  import.meta.url
);
const { sets } = readTokens(readFileSync(full, 'utf8'));
const out = mkdtempSync(join(tmpdir(), 'sd-build-'));
try {
  for (const mode of [null, 'dark']) {
    const file = `${mode ?? 'light'}.css`;
    await buildWithStyleDictionary(
      resolveTokens(sets, 'brand', { mode }),
      {
        log: { verbosity: 'silent' },
        platforms: {
          css: {
            transformGroup: 'css',
            buildPath: `${out}/`,
            files: [{ destination: file, format: 'css/variables' }],
          },
        },
      },
      { StyleDictionary }
    );
    console.log(
      `buildWithStyleDictionary ${file}:\n${readFileSync(join(out, file), 'utf8')}`
    );
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}
