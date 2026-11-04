// Bounded probe of the original kill(0)/proc observation across real exits.
// Run with node, bun run, or deno run -A; no project dependencies required.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';

let conflicts = 0;
for (let trial = 0; trial < 20; trial++) {
  const child = spawn('node', ['-e', 'setTimeout(() => {}, 10)']);
  const closed = new Promise((resolve) => child.once('close', resolve));
  const deadline = Date.now() + 500;
  let previous;
  while (Date.now() < deadline) {
    let probe = 'ok';
    try {
      process.kill(child.pid, 0);
    } catch (error) {
      probe = error.code;
    }
    let stat;
    try {
      const raw = readFileSync(`/proc/${child.pid}/stat`, 'utf8');
      const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
      stat = { state: fields[0], group: fields[2], startTime: fields[19] };
    } catch (error) {
      stat = { error: error.code };
    }
    const observation = { pid: child.pid, probe, ...stat };
    const originalAlive =
      probe === 'EPERM' || (probe === 'ok' && stat.state !== 'Z');
    if (previous?.alive === false && originalAlive) {
      conflicts++;
      console.log(
        JSON.stringify({
          trial,
          previous,
          next: { ...observation, alive: originalAlive },
        })
      );
    }
    if (previous?.state !== stat.state || previous?.error !== stat.error) {
      console.log(
        JSON.stringify({ trial, ...observation, alive: originalAlive })
      );
    }
    previous = { ...observation, alive: originalAlive };
    if (probe === 'ESRCH' && stat.error === 'ENOENT') {
      break;
    }
    await setImmediate();
  }
  child.kill('SIGKILL');
  await closed;
}
console.log(JSON.stringify({ trials: 20, conflicts }));
