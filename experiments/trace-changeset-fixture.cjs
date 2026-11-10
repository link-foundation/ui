// Optional preload for diagnosing the real Changesets release fixture.
// Log commands and file writes, never the child's environment or file contents.
// Enable with DEBUG_CHANGESET_FIXTURE=1 and node --require this-file.cjs.
if (process.env.DEBUG_CHANGESET_FIXTURE) {
  const childProcess = require('node:child_process');
  const fs = require('node:fs');
  const { syncBuiltinESMExports } = require('node:module');
  const started = Date.now();
  let reporting = false;
  const report = (operation, value) => {
    reporting = true;
    const line = `[changeset fixture pid=${process.pid} +${Date.now() - started}ms] ${operation}: ${JSON.stringify(value)}`;
    if (process.env.CHANGESET_FIXTURE_TRACE_FILE) {
      fs.appendFileSync(process.env.CHANGESET_FIXTURE_TRACE_FILE, `${line}\n`);
    }
    if (
      !process.env.CHANGESET_FIXTURE_TRACE_FILE ||
      process.env.CHANGESET_FIXTURE_TRACE_STDERR
    ) {
      console.error(line);
    }
    reporting = false;
  };
  // Time between process start and this preload: slow runner startup.
  report('preload', {
    entry: process.argv[1],
    sinceFixtureStartMs: process.env.CHANGESET_FIXTURE_STARTED_AT
      ? Date.now() - Number(process.env.CHANGESET_FIXTURE_STARTED_AT)
      : undefined,
    sinceProcessStartMs: Math.round(
      require('node:perf_hooks').performance.now()
    ),
  });
  // Issue #253: tell CPU-bound work in this process, other busy processes and
  // waiting (disk, scanning) apart. Machine CPU comes from os.cpus() idle time.
  const os = require('node:os');
  const machineIdle = () => {
    let idle = 0;
    let total = 0;
    for (const { times } of os.cpus()) {
      idle += times.idle;
      total += times.user + times.nice + times.sys + times.idle + times.irq;
    }
    return { idle, total };
  };
  const sample = () => ({
    at: Date.now(),
    cpu: process.cpuUsage(),
    machine: machineIdle(),
    modules: Object.keys(require.cache).length,
  });
  const usageSince = (before) => {
    const after = sample();
    const machineTotal = after.machine.total - before.machine.total;
    return {
      ms: after.at - before.at,
      cpuMs: Math.round(
        (after.cpu.user -
          before.cpu.user +
          after.cpu.system -
          before.cpu.system) /
          1000
      ),
      machineBusyPercent: machineTotal
        ? Math.round(
            100 *
              (1 - (after.machine.idle - before.machine.idle) / machineTotal)
          )
        : undefined,
      modulesLoaded: after.modules - before.modules,
    };
  };
  // A blocked event loop delays every timer; report each gap of 1 s or more.
  const STALL_MS = 1000;
  let lastTick = sample();
  const checkStall = () => {
    const usage = usageSince(lastTick);
    if (usage.ms >= STALL_MS + 250) {
      report('eventLoopStall', { ...usage, cpus: os.cpus().length });
    }
    lastTick = sample();
  };
  setInterval(checkStall, 250).unref();
  // A stall just before exit has no later timer tick to reveal it.
  process.on('exit', checkStall);
  // Outermost synchronous require calls that take 1 s or more, such as
  // npm loading a command module. Nested requires are covered by the outer one.
  const Module = require('node:module');
  const originalLoad = Module._load;
  let requireDepth = 0;
  Module._load = function (request, parent, isMain, ...rest) {
    // The entry point stays untimed so the requires inside it are reported.
    if (requireDepth > 0 || isMain) {
      return originalLoad.call(this, request, parent, isMain, ...rest);
    }
    const before = sample();
    requireDepth += 1;
    try {
      return originalLoad.call(this, request, parent, isMain, ...rest);
    } finally {
      requireDepth -= 1;
      const usage = usageSince(before);
      if (usage.ms >= STALL_MS) {
        report('slowRequire', { request, ...usage });
      }
    }
  };
  // npm writes its debug log with synchronous writes (fs-minipass).
  for (const method of ['openSync', 'writeSync', 'closeSync']) {
    const original = fs[method];
    fs[method] = function (...args) {
      const before = Date.now();
      try {
        return original.apply(this, args);
      } finally {
        const ms = Date.now() - before;
        if (ms >= STALL_MS && !reporting) {
          report('slowSyncFs', {
            method,
            ms,
            file: typeof args[0] === 'string' ? args[0] : undefined,
          });
        }
      }
    };
  }
  process.on('beforeExit', (code) => report('beforeExit', { code }));
  process.on('exit', (code) => report('processExit', { code }));
  // Finite snapshots before the fixture's 25 s guard. Unref so diagnostics
  // never keep a successful process alive or change its exit conditions.
  for (const delay of [10000, 20000]) {
    setTimeout(() => {
      report(
        'activeHandles',
        process._getActiveHandles().map((handle) => ({
          type: handle.constructor.name,
          pid: handle.pid,
          exitCode: handle.exitCode,
          readableEnded: handle.readableEnded,
          writableLength: handle.writableLength,
        }))
      );
    }, delay).unref();
  }
  for (const method of ['spawn', 'execFile']) {
    const original = childProcess[method];
    childProcess[method] = function (command, args, ...rest) {
      report(method, { command, args });
      const child = original.call(this, command, args, ...rest);
      report('spawned', { command, pid: child.pid });
      child.on('exit', (code, signal) =>
        report('exit', { command, code, signal })
      );
      child.on('close', (code, signal) =>
        report('close', { command, code, signal })
      );
      // Formatter failures are otherwise swallowed by the parent's pipe.
      for (const stream of ['stdout', 'stderr']) {
        child[stream]?.on('end', () => report('end', { command, stream }));
        child[stream]?.on('data', (data) =>
          report(stream, { command, data: String(data) })
        );
      }
      child.on('error', (error) =>
        report('error', { command, message: error.message })
      );
      return child;
    };
  }
  for (const method of ['writeFile', 'readFile']) {
    const original = fs.promises[method];
    fs.promises[method] = async function (file, ...args) {
      report(method, String(file));
      return await original.call(this, file, ...args);
    };
  }
  syncBuiltinESMExports();
}
