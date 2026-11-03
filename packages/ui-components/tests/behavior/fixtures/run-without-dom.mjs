// Run by no-dom.test.js in a separate process: load the `./behavior` entry
// point without `window` or `document` and print the toggled state.
if (typeof window !== 'undefined' || typeof document !== 'undefined') {
  throw new Error('expected no DOM globals');
}
const b = await import('@link-foundation/ui-components/behavior');
const service = b.interpret(b.createMachine(b.TOGGLE_MACHINE));
service.send('toggle');
console.log(JSON.stringify([service.state, service.attrs('root')]));
