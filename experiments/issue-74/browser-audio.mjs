/** Serve an in-memory bundle for the Playwright MCP Web Audio probe. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['packages/ui-sound/src/index.js'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
});
const bundle = result.outputFiles[0].text;
const themes = Object.fromEntries(
  await Promise.all(
    ['quiet', 'immortality'].map(async (name) => [
      name,
      await readFile(`packages/ui-sound/themes/${name}.lino`, 'utf8'),
    ])
  )
);
const server = createServer((request, response) => {
  if (request.url === '/probe.js') {
    response.setHeader('Content-Type', 'text/javascript');
    readFile('experiments/issue-74/probe.js', 'utf8').then((text) =>
      response.end(text)
    );
  } else if (request.url === '/sound.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(bundle);
  } else if (request.url === '/themes') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(themes));
  } else {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><title>Sound API probe</title>');
  }
});
server.listen(8744, '127.0.0.1', () =>
  process.stdout.write('Audio probe: http://127.0.0.1:8744\n')
);
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
