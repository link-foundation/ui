// Released clink fixtures shared by the DeepClient and browser checks.
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';

export async function startDeepClink({
  rows = [],
  packageFile,
  rules,
  args = [],
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'ui-deep-clink-'));
  const command = process.env.CLINK ?? 'clink';
  const db = join(directory, 'data.links');
  let child, exited;
  const stop = async () => {
    if (child && child.exitCode === null && !child.killed) {
      child.kill();
    }
    await exited;
  };
  const start = async () => {
    child = spawn(
      command,
      [
        '--db',
        db,
        '--serve',
        '127.0.0.1:0',
        '--graphql',
        '--deep-package',
        packageFile,
        ...args,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    exited = once(child, 'exit');
    let errors = '';
    child.stderr.on('data', (chunk) => {
      errors += chunk;
    });
    const lines = createInterface({ input: child.stdout });
    const address = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', () =>
        reject(new Error(`clink exited before listening: ${errors}`))
      );
      lines.on('line', (line) => {
        const prefix = 'clink GraphQL server listening on ';
        if (line.startsWith(prefix)) {
          resolve(line.slice(prefix.length));
        }
      });
    });
    lines.close();
    return `http://${address}/v1/graphql`;
  };
  try {
    if (!packageFile) {
      packageFile = join(directory, 'package.json');
      await writeFile(packageFile, JSON.stringify(rows));
    }
    if (rules) {
      await promisify(execFile)(command, [
        '--db',
        db,
        '--auto-create-missing-references',
        rules,
      ]);
    }
    const fixture = {
      url: await start(),
      async restart() {
        await stop();
        fixture.url = await start();
      },
      async close() {
        await stop();
        await rm(directory, { recursive: true, force: true });
      },
    };
    return fixture;
  } catch (error) {
    await stop().catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
