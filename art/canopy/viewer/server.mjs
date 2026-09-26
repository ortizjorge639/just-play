import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webRoot, assetRoot, checkedAssets } from './paths.mjs';

export { webRoot, workspaceRoot } from './paths.mjs';
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
};
const webFiles = new Set(['index.html', 'viewer.js', 'bootstrap.js', 'style.css']);
const exports = new Set(['environment', 'pip', 'sol', 'ember-small', 'hearth-deck',
  'hearth-enrichment', 'rain-postcard', 'collision-proxies', 'cameras'].map(name => `${name}.glb`));

export async function startServer({ port = 0, assets = assetRoot } = {}) {
  const art = await checkedAssets(assets);
  const web = await realpath(webRoot);
  const three = await realpath(resolve(webRoot, 'node_modules/three'));
  const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const reply = (status, message) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(message);
    };
    if (!/^127\.0\.0\.1(?::\d+)?$/.test(request.headers.host ?? '')) return reply(403, 'Loopback host required.');
    if (!['GET', 'HEAD'].includes(request.method)) return reply(405, 'Read-only server.');
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (pathname === '/' || pathname === '/web/' || pathname === '/web') pathname = '/web/index.html';
      if (pathname.split('/').some(part => part.startsWith('.')) || pathname.includes('\0') || pathname.includes('\\')) {
        return reply(403, 'Hidden or invalid paths are not served.');
      }
      let root, relative;
      if (pathname.startsWith('/web/') && webFiles.has(pathname.slice(5))) {
        root = web; relative = pathname.slice(5);
      } else if (/^\/web\/node_modules\/three\/(?:build|src|examples\/jsm)\/.+\.js$/.test(pathname)) {
        root = three; relative = pathname.slice('/web/node_modules/three/'.length);
      } else if (pathname === '/canopy-v001/manifest.json') {
        root = art; relative = 'manifest.json';
      } else if (pathname.startsWith('/canopy-v001/exports/') && exports.has(pathname.split('/').pop()) &&
                 pathname.split('/').length === 4) {
        root = art; relative = `exports/${pathname.split('/').pop()}`;
      } else {
        return reply(404, 'Not an inspection asset.');
      }
      const candidate = resolve(root, relative);
      if (!candidate.startsWith(`${root}${sep}`)) return reply(403, 'Path outside mount.');
      const filename = await realpath(candidate);
      if (!filename.startsWith(`${root}${sep}`)) return reply(403, 'Symlink outside mount.');
      const info = await stat(filename);
      if (!info.isFile()) return reply(404, 'No directory listing.');
      response.writeHead(200, { 'Content-Type': types[extname(filename)], 'Content-Length': info.size });
      if (request.method === 'HEAD') return response.end();
      createReadStream(filename).on('error', error => {
        console.error(`Asset stream failed: ${error.message}`);
        response.destroy(error);
      }).pipe(response);
    } catch (error) {
      if (error instanceof URIError) return reply(400, 'Invalid path.');
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) return reply(404, 'File not found.');
      console.error(error);
      reply(500, 'Asset read failed.');
    }
  });
  await new Promise((ready, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', ready);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}/web/`,
    close: () => new Promise((done, reject) => {
      server.close(error => error ? reject(error) : done());
      server.closeIdleConnections();
    }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be 0-65535.');
  const server = await startServer({ port });
  console.log(`Canopy diagnostic viewer: ${server.url}\nMounted assets: ${assetRoot}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
}
