// Print file-system operation counts and the exit-event time as the last
// stderr line; the parent measures how long the process lives after it.
process.on('exit', () => {
  const { fsRead, fsWrite } = process.resourceUsage();
  const exitAt = Date.now();
  process.stderr.write(`\n${JSON.stringify({ fsRead, fsWrite, exitAt })}\n`);
});
