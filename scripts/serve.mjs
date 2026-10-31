import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function serve({ directory = 'dist', port = 4173, base = '/' } = {}) {
  const root = resolve(directory);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8' };
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!pathname.startsWith(base)) { res.writeHead(404).end('Not found'); return; }
      const file = resolve(root, pathname.slice(base.length) || 'index.html');
      if (!file.startsWith(root + sep) && file !== root) { res.writeHead(403).end('Forbidden'); return; }
      if (!(await stat(file)).isFile()) { res.writeHead(404).end('Not found'); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise(resolve => server.listen(port, '0.0.0.0', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}${base}` };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { url } = await serve();
  console.log(`Squeek Pouch production preview: ${url}`);
}
