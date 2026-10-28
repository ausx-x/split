/**
 * Unified Server for Splitwise
 * Static File Server + REST API Router (/api/*) + Uploads Storage (/uploads/*)
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const routes = require('./backend/routes');
const uploads = require('./backend/uploads');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. Dispatch REST API requests
  if (pathname.startsWith('/api/')) {
    try {
      await routes.handleApiRequest(req, res, pathname, parsedUrl.query);
    } catch (err) {
      console.error('Unhandled API Error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal Server Error' }));
      }
    }
    return;
  }

  // 2. Serve /uploads/ files
  if (pathname.startsWith('/uploads/')) {
    const filename = path.basename(pathname);
    const filePath = path.join(uploads.UPLOADS_DIR, filename);

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(content);
      }
    });
    return;
  }

  // 3. Serve Frontend Static Assets
  let cleanUrl = pathname === '/' ? 'index.html' : pathname;
  let filePath = path.join(__dirname, cleanUrl);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.log(`Port ${PORT} in use, trying ${nextPort}...`);
    server.listen(nextPort);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  const address = server.address();
  console.log(`Splitwise full-stack server running at: http://localhost:${address.port}`);
});
