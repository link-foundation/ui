import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { URL } from 'node:url';

test('native export tests do not launch compilers without usable SDKs', () => {
  const fixture = new URL('./native.test.js', import.meta.url).href;
  const env = { ...process.env, UI_CONVERT_COMPOSE_CLASSPATH: '' };
  delete env.NODE_TEST_CONTEXT;
  execFileSync(
    'node',
    [
      '--input-type=module',
      '-e',
      `import childProcess from 'node:child_process';
       import { syncBuiltinESMExports } from 'node:module';
       childProcess.spawnSync = (program) => {
         throw new Error('Unexpected compiler probe without an SDK: ' + program);
       };
       syncBuiltinESMExports();
       Object.defineProperty(process, 'platform', { value: 'win32' });
       await import(${JSON.stringify(fixture)});`,
    ],
    {
      encoding: 'utf8',
      env,
    }
  );
});
