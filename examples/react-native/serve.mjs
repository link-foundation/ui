import { URL, fileURLToPath } from 'node:url';
import { startStaticServer } from '../../scripts/lib/static-server.mjs';
await startStaticServer({
  mounts: [
    { prefix: '/', dir: fileURLToPath(new URL('./dist', import.meta.url)) },
  ],
  port: 4174,
});
