import { readFileSync } from 'node:fs';

/** Read Linux identity and state together; a missing proc entry means reaped. */
export function readProcess(
  pid,
  { platform = process.platform, read = readFileSync } = {}
) {
  if (platform !== 'linux') {
    return { pid };
  }
  let stat;
  try {
    stat = read(`/proc/${pid}/stat`, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ESRCH') {
      return null;
    }
    throw error;
  }
  // comm may itself contain spaces and closing parentheses. Fields after its
  // final ')' start at field 3 (state); pgrp is 5 and starttime is 22.
  const fields = stat
    .slice(stat.lastIndexOf(')') + 2)
    .trim()
    .split(/\s+/);
  if (fields.length < 20) {
    throw new Error(`Incomplete proc stat for ${pid}`);
  }
  return { pid, state: fields[0], group: fields[2], startTime: fields[19] };
}

/**
 * Check the captured process identity and its current execution state.
 * On Linux /proc is authoritative: kill(0) and a later read are not atomic.
 * Unexpected probe/read errors fail verification.
 */
export function isProcessAlive(
  identity,
  {
    platform = process.platform,
    read = readFileSync,
    kill = (pid, signal) => process.kill(pid, signal),
    trace = process.env.BOUNDED_RUN_TRACE === '1'
      ? (entry) => console.error(JSON.stringify(entry))
      : undefined,
  } = {}
) {
  // Linux needs no signal probe except when collecting diagnostic evidence.
  const probe =
    platform !== 'linux' || trace ? signalProbe(identity.pid, kill) : undefined;
  const observed = readProcess(identity.pid, { platform, read });
  const alive =
    platform === 'linux'
      ? observed !== null &&
        observed.startTime === identity.startTime &&
        !['Z', 'X', 'x'].includes(observed.state)
      : probe !== 'ESRCH';
  trace?.({ expected: identity, observed, probe, alive });
  return alive;
}

function signalProbe(pid, kill) {
  try {
    kill(pid, 0);
    return 'ok';
  } catch (error) {
    if (error.code !== 'ESRCH' && error.code !== 'EPERM') {
      throw error;
    }
    return error.code;
  }
}
