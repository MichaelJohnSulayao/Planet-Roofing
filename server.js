const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// Mapping of redirect rules parsed from .htaccess
const redirects = new Map();

function normalizePath(p) {
  if (!p) return '';
  p = p.split('?')[0]; // Remove query string
  return p.toLowerCase().trim().replace(/^\/+|\/+$/g, '');
}

// 1. Load and parse .htaccess for custom 301 redirects and rewrites
try {
  const htaccessPath = path.join(ROOT, '.htaccess');
  if (fs.existsSync(htaccessPath)) {
    const content = fs.readFileSync(htaccessPath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Match: Redirect 301 /source/ /target/
      const redirectMatch = trimmed.match(/^Redirect\s+301\s+(\S+)\s+(\S+)/i);
      if (redirectMatch) {
        const src = normalizePath(redirectMatch[1]);
        const dest = redirectMatch[2];
        if (src && dest) {
          redirects.set(src, dest);
        }
        continue;
      }

      // Match: RewriteRule ^source/?$ /target [R=301,L]
      const rewriteMatch = trimmed.match(/^RewriteRule\s+\^?([^\$\s]+)\$?\/?\s+(\S+)(?:\s+\[.*R=301.*\])?/i);
      if (rewriteMatch) {
        const src = normalizePath(rewriteMatch[1].replace(/\/\?$/, '').replace(/\/?$/, ''));
        const dest = rewriteMatch[2];
        if (src && dest) {
          redirects.set(src, dest);
        }
      }
    }
    console.log(`\x1b[36m[System]\x1b[0m Successfully loaded ${redirects.size} redirect rules from .htaccess`);
  }
} catch (err) {
  console.error('\x1b[31m[Error]\x1b[0m Failed to parse .htaccess:', err.message);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

// 2. Start the HTTP server
const server = http.createServer((req, res) => {
  // Only handle GET and HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  const decodedUrl = decodeURIComponent(req.url);
  const normalizedReq = normalizePath(decodedUrl);

  // A. Check if the path matches a .htaccess redirect rule
  if (redirects.has(normalizedReq)) {
    const dest = redirects.get(normalizedReq);
    // Prevent infinite redirect loops if rule points to itself
    if (normalizePath(dest) !== normalizedReq) {
      console.log(`\x1b[33m[301 Redirect]\x1b[0m ${req.url} -> ${dest}`);
      res.writeHead(301, { 'Location': dest });
      res.end();
      return;
    }
  }

  // B. Resolve path on disk
  const urlPath = decodedUrl.split('?')[0];
  let filePath = path.join(ROOT, urlPath);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(ROOT)) {
    console.log(`\x1b[31m[403 Forbidden]\x1b[0m ${req.url} (Attempted directory traversal)`);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      // File/folder does not exist
      console.log(`\x1b[31m[404 Not Found]\x1b[0m ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1><p>The requested page or file does not exist.</p>');
      return;
    }

    // C. Handle Directory
    if (stats.isDirectory()) {
      // Enforce trailing slash on directory paths to ensure relative asset links work
      if (urlPath !== '/' && !urlPath.endsWith('/')) {
        const redirectUrl = urlPath + '/' + (decodedUrl.includes('?') ? '?' + decodedUrl.split('?')[1] : '');
        console.log(`\x1b[33m[301 Dir Slash]\x1b[0m ${req.url} -> ${redirectUrl}`);
        res.writeHead(301, { 'Location': redirectUrl });
        res.end();
        return;
      }

      // Serve index.html inside the directory
      const indexFile = path.join(filePath, 'index.html');
      fs.stat(indexFile, (indexErr, indexStats) => {
        if (indexErr || !indexStats.isFile()) {
          console.log(`\x1b[31m[404 Not Found]\x1b[0m ${req.url} (index.html missing in folder)`);
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>404 Not Found</h1><p>Index page not found in this directory.</p>');
          return;
        }

        serveFile(indexFile, indexStats, res, req.url);
      });
      return;
    }

    // D. Serve File
    if (stats.isFile()) {
      serveFile(filePath, stats, res, req.url);
    }
  });
});

function serveFile(filePath, stats, res, originalUrl) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stats.size,
    'Server': 'PlanetRoofing-LocalDevServer'
  });

  const stream = fs.createReadStream(filePath);
  stream.on('error', (streamErr) => {
    console.error(`\x1b[31m[Stream Error]\x1b[0m ${originalUrl}:`, streamErr.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  });
  stream.pipe(res);
  console.log(`\x1b[32m[200 OK]\x1b[0m ${originalUrl} (${contentType})`);
}

// 3. Start listening, with automatic port fallback if PORT is in use
function startServer(portToTry) {
  server.listen(portToTry, () => {
    console.log(`\n\x1b[32m==================================================\x1b[0m`);
    console.log(`\x1b[1mPlanet Roofing Website Local Server is Running!\x1b[0m`);
    console.log(`\x1b[36mLocal URL:\x1b[0m \x1b[4mhttp://localhost:${portToTry}\x1b[0m`);
    console.log(`\x1b[32m==================================================\x1b[0m\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\x1b[33m[Warning]\x1b[0m Port ${portToTry} is already in use. Trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error(`\x1b[31m[Fatal Server Error]\x1b[0m`, err);
    }
  });
}

startServer(PORT);
