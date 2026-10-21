// Local preview only. It never modifies files or exposes the server to the LAN.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (relative.includes('\\') || relative.split('/').some(part => part.startsWith('.'))) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const target = path.resolve(root, relative);
    const relation = path.relative(root, target);
    if (relation.startsWith('..') || path.isAbsolute(relation)) { res.writeHead(404); res.end('Not found'); return; }
    const real = await fs.promises.realpath(target);
    const realRelation = path.relative(root, real);
    if (realRelation.startsWith('..') || path.isAbsolute(realRelation)) { res.writeHead(404); res.end('Not found'); return; }
    const stat = await fs.promises.stat(real);
    if (!stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(real)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') res.end();
    else pipeline(fs.createReadStream(real), res, () => {});
  } catch { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }
});
server.on('error', err => { console.error(`Preview failed: ${err.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Kanji Maker: http://127.0.0.1:${port}\nPress Ctrl+C to stop.`));
