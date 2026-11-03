/**
 * Dependency-free static file server shared by the preview-image script
 * (scripts/update-preview-images.mjs) and the Playwright web server
 * (scripts/serve-static.mjs).
 *
 * A server has one or more mounts: a URL prefix mapped to a directory. The
 * longest matching prefix wins. Requests that escape a mount get 403, missing
 * files get 404, and a directory serves its `index.html`.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

export const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.lino', 'text/plain; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

/**
 * @typedef {{prefix: string, dir: string}} Mount
 */

/**
 * Normalise mounts: prefixes start and end with `/`, longest first.
 * @param {Mount[]} mounts
 * @returns {Mount[]}
 */
export function normaliseMounts(mounts) {
  return mounts
    .map(({ prefix, dir }) => {
      let p = prefix.startsWith('/') ? prefix : `/${prefix}`;
      if (!p.endsWith('/')) {
        p = `${p}/`;
      }
      return { prefix: p, dir: path.resolve(dir) };
    })
    .sort((a, b) => b.prefix.length - a.prefix.length);
}

/**
 * Resolve a URL pathname to a file path inside one of the mounts.
 * @param {Mount[]} mounts normalised mounts
 * @param {string} pathname decoded URL pathname
 * @returns {{status: 200, file: string} | {status: 403 | 404}}
 */
export function resolveRequestPath(mounts, pathname) {
  const target = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const mount = mounts.find(({ prefix }) => target.startsWith(prefix));
  if (!mount) {
    return { status: 404 };
  }
  const file = path.resolve(
    mount.dir,
    `.${target.slice(mount.prefix.length - 1)}`
  );
  if (file !== mount.dir && !file.startsWith(`${mount.dir}${path.sep}`)) {
    return { status: 403 };
  }
  return { status: 200, file };
}

/**
 * Start a static server.
 * @param {{mounts: Mount[], port?: number, host?: string}} options
 * @returns {Promise<{url: string, close: () => Promise<void>}>}
 */
export async function startStaticServer({
  mounts,
  port = 0,
  host = '127.0.0.1',
}) {
  const normalised = normaliseMounts(mounts);

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', `http://${host}`);
      const resolved = resolveRequestPath(
        normalised,
        decodeURIComponent(requestUrl.pathname)
      );
      if (resolved.status !== 200) {
        response.writeHead(resolved.status);
        response.end(resolved.status === 403 ? 'Forbidden' : 'Not found');
        return;
      }
      const fileStat = await stat(resolved.file);
      const filePath = fileStat.isDirectory()
        ? path.join(resolved.file, 'index.html')
        : resolved.file;
      const body = await readFile(filePath);
      const contentType =
        contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream';
      response.writeHead(200, { 'content-type': contentType });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  return {
    url: `http://${host}:${address.port}/`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
