const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

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
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  // Safe decoding of URL to handle spaces/special characters
  let safeUrl;
  try {
    safeUrl = decodeURIComponent(req.url);
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Bad Request');
    return;
  }

  // Resolve file path (removing query parameters/hashes)
  const parsedUrl = safeUrl.split('?')[0].split('#')[0];
  let filePath = path.join(__dirname, parsedUrl);

  // If path is a directory, look for index.html inside it
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    // Read and serve the file
    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // Serve 404 page if it exists, otherwise plain HTML
          const path404 = path.join(__dirname, '404.html');
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
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end(`Server Error: ${err.code}`);
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

server.listen(PORT, () => {
  console.log(`\n🚀 Server is running at http://localhost:${PORT}`);
  console.log(`Watching for changes... Server will restart automatically on save.\n`);
});
