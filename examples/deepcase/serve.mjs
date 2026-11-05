import { startDeepcase } from './server.mjs';

const server = await startDeepcase();
console.log(server.url);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close().then(() => process.exit(0)));
}
