// Run a released clink against the same data and rules as the reference server.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '@link-foundation/link-cli-client/process';
import {
  linksToLino,
  formatLino,
  named,
  group,
  parseLino,
} from '@link-foundation/ui-links';
import { connectLinks } from '@link-foundation/ui-links/tcp';

/** Start clink with a temporary database; close removes only this fixture. */
export async function startClink({
  links,
  names,
  rules = links,
  tokens = new Map(),
}) {
  const command = process.env.CLINK ?? 'clink';
  const directory = await mkdtemp(join(tmpdir(), 'ui-links-clink-'));
  const db = join(directory, 'data.links');
  const run = (args) => promisify(execFile)(command, ['--db', db, ...args]);
  let server;
  try {
    const input = join(directory, 'data.lino');
    await writeFile(input, linksToLino(links));
    await run(['--import', input]);
    // Keep numeric addresses, then install the same names through the protocol.
    server = await startServer({ command, db });
    const transport = await connectLinks(server.address);
    try {
      for (const [id, name] of names.entries()) {
        // The official formatter handles quoted names as well as simple ones.
        const reply = await transport.send(
          formatLino([named('set-name', [group([String(id), name])])])
        );
        if (parseLino(reply)[0]?.id === 'error') {
          throw new Error(reply);
        }
      }
    } finally {
      await transport.close();
    }
    await server.close();
    server = null;
    const tokenFile = join(directory, 'tokens.links');
    for (const [token, subject] of tokens) {
      await run([
        '--tokens',
        tokenFile,
        '--subject',
        String(subject),
        '--grant-token',
        token,
      ]);
    }
    let permissions = 'self';
    if (rules !== links) {
      permissions = join(directory, 'rules.links');
      const inputRules = join(directory, 'rules.lino');
      await writeFile(inputRules, linksToLino(rules));
      await promisify(execFile)(command, [
        '--db',
        permissions,
        '--import',
        inputRules,
      ]);
    }
    server = await startServer({
      command,
      db,
      args: ['--permissions', permissions, '--tokens', tokenFile],
    });
    return {
      address: server.address,
      async close() {
        await server.close();
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await server?.close();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

/** Start `clink --serve --triplets` on a temporary database, fresh. */
export async function startClinkTriplets() {
  const directory = await mkdtemp(join(tmpdir(), 'ui-links-clink-'));
  try {
    const server = await startServer({
      command: process.env.CLINK ?? 'clink',
      db: join(directory, 'data.links'),
      args: ['--triplets'],
    });
    return {
      address: server.address,
      async close() {
        await server.close();
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
