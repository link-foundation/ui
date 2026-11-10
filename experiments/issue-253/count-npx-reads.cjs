// Count the file reads and writes of one nested `npx prettier --version`
// for each Node compile-cache state. Usage: node count-npx-reads.cjs <npx-cli.js>
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const npxCli = process.argv[2];
const probe = path.join(__dirname, 'resource-usage-at-exit.cjs');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'npx-compile-cache-'));
const run = (label, tmp, extraEnv) => {
  fs.mkdirSync(tmp, { recursive: true });
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    ['--require', probe, npxCli, 'prettier', '--version'],
    {
      encoding: 'utf8',
      timeout: 60000,
      env: {
        ...process.env,
        TMPDIR: tmp,
        TEMP: tmp,
        TMP: tmp,
        npm_config_offline: 'true',
        npm_config_yes: 'false',
        ...extraEnv,
      },
    }
  );
  const ended = Date.now();
  const { exitAt, ...usage } = JSON.parse(
    result.stderr.trim().split('\n').pop()
  );
  const cacheFiles = fs.existsSync(path.join(tmp, 'node-compile-cache'))
    ? fs.readdirSync(path.join(tmp, 'node-compile-cache'), { recursive: true })
        .length
    : 0;
  console.log(
    JSON.stringify({
      label,
      ms: ended - started,
      afterExitEventMs: ended - exitAt,
      ...usage,
      cacheFiles,
    })
  );
};
try {
  run('cold compile cache', path.join(base, 'a'), {});
  run('warm compile cache', path.join(base, 'a'), {});
  run('compile cache disabled', path.join(base, 'b'), {
    NODE_DISABLE_COMPILE_CACHE: '1',
  });
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}
