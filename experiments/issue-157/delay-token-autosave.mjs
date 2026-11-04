/** Widen the independent token autosave window to reproduce #157 deterministically. */
export async function delayTokenAutosave(page) {
  await page.addInitScript(() => {
    const schedule = globalThis.setTimeout.bind(globalThis);
    let drafts = 0;
    globalThis.setTimeout = (callback, delay, ...args) => {
      // The scenario edits document.lino first and tokens.lino second.
      if (delay === 500 && ++drafts === 2) {
        return schedule(callback, 2000, ...args);
      }
      return schedule(callback, delay, ...args);
    };
  });
}
