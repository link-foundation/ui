/**
 * Opt-in site build timings. Silent unless `SITE_BUILD_TRACE=1`, so default
 * build and test output is unchanged. Each line names a phase, its duration and
 * the time since the process started, so a cancelled build still shows where
 * it stopped when its stderr is streamed.
 */
export const TRACE_PREFIX = '[site-build]';

/**
 * @param {{
 *   enabled?: boolean,
 *   now?: () => number,
 *   write?: (line: string) => void,
 * }} [options]
 */
export function createBuildTrace({
  enabled = globalThis.process?.env?.SITE_BUILD_TRACE === '1',
  now = () => globalThis.performance.now(),
  write = (line) => globalThis.process.stderr.write(`${line}\n`),
} = {}) {
  const starts = new Map();
  const line = (text) => {
    if (enabled) {
      write(`${TRACE_PREFIX} ${text} (at ${Math.round(now())}ms)`);
    }
  };
  return {
    enabled,
    /** Record a point in time, such as a process event. */
    mark(name) {
      line(name);
    },
    /** Start a named phase; `end(name)` reports its duration. */
    start(name) {
      if (enabled) {
        starts.set(name, now());
      }
    },
    end(name) {
      if (enabled && starts.has(name)) {
        line(`${name}: ${Math.round(now() - starts.get(name))}ms`);
        starts.delete(name);
      }
    },
  };
}
