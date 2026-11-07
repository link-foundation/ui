import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareConsumer } from './prepare.mjs';

/** Build with the consumer's installed Vite, with no source aliases. */
export async function buildConsumer(consumer) {
  const require = createRequire(path.join(consumer.app, 'package.json'));
  const { build, preview } = await import(require.resolve('vite'));
  const warnings = [];
  const config = {
    root: consumer.app,
    configFile: false,
    base: '/consumer/',
    logLevel: 'silent',
  };
  await build({
    ...config,
    build: {
      target: 'es2022',
      rollupOptions: { onwarn: (warning) => warnings.push(warning.message) },
    },
  });
  return {
    ...consumer,
    warnings,
    serve: () =>
      preview({
        ...config,
        preview: { host: '127.0.0.1', port: 0 },
      }),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = process.argv[2];
  const consumer = await buildConsumer(
    root ? { root, app: path.join(root, 'app') } : await prepareConsumer()
  );
  console.log(
    JSON.stringify({ root: consumer.root, warnings: consumer.warnings })
  );
  const server = await consumer.serve();
  console.log(server.resolvedUrls.local[0]);
}
