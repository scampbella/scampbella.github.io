const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const WEBROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
};

const BLOCKED_SEGMENTS = new Set(['.git', 'node_modules', 'package-lock.json']);

function isPathSafe(resolved) {
  if (!resolved.startsWith(WEBROOT + path.sep) && resolved !== WEBROOT) return false;
  const relative = path.relative(WEBROOT, resolved);
  if (relative.startsWith('..')) return false;
  const segments = relative.split(path.sep);
  for (const seg of segments) {
    if (seg.startsWith('.') || BLOCKED_SEGMENTS.has(seg)) return false;
  }
  return true;
}

const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-cache');

  let safeUrl;
  try {
    safeUrl = decodeURIComponent(req.url);
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Bad Request');
    return;
  }

  const parsedUrl = safeUrl.split('?')[0];
  let filePath = path.join(WEBROOT, parsedUrl);
  let resolved = path.resolve(filePath);

  if (!isPathSafe(resolved)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Forbidden');
    return;
  }
  filePath = resolved;

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      // Redirect /dir -> /dir/ rather than quietly serving the index at the
      // slashless URL. Without the trailing slash the browser resolves relative
      // URLs against the PARENT directory, so a page whose assets sit in a
      // sibling folder (e.g. games/casino/poker/ importing ../js/…) silently
      // 404s with no obvious cause. GitHub Pages 301s here, so matching it
      // locally keeps dev honest.
      if (!parsedUrl.endsWith('/')) {
        const query = safeUrl.slice(parsedUrl.length);
        res.statusCode = 301;
        res.setHeader('Location', encodeURI(parsedUrl) + '/' + query);
        res.end();
        return;
      }
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          const path404 = path.join(WEBROOT, '404.html');
          fs.readFile(path404, (err404, data404) => {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/html');
            if (!err404) {
              res.end(data404);
            } else {
              res.end('<h1>404 Not Found</h1><p>The requested URL was not found on this server.</p>');
            }
          });
        } else {
          console.error('Server error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Internal Server Error');
        }
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.end(data);
    });
  });
});

server.timeout = 30000;
server.maxConnections = 100;

server.listen(PORT, () => {
  console.log(`\n🚀 Server is running at http://localhost:${PORT}`);
  console.log('Watching for changes... Server will restart automatically on save.\n');
});