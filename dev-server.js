const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

let PORT = 3000;
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const clients = [];

// Live-reload client script injected into HTML
const RELOAD_SCRIPT = `
<!-- Live Reload Script -->
<script>
(function() {
  const evtSource = new EventSource('/__live_reload__');
  evtSource.onmessage = function(e) {
    if (e.data === 'reload') {
      console.log('[LiveServer] File changed, reloading...');
      window.location.reload();
    }
  };
  evtSource.onerror = function() {
    // Auto-reconnect handled by browser
  };
})();
</script>
`;

// Watch files for changes
let reloadTimeout;
try {
  fs.watch(ROOT, { recursive: true }, (eventType, filename) => {
    if (!filename || filename === 'dev-server.js' || filename.startsWith('.')) return;
    const ext = path.extname(filename).toLowerCase();
    if (['.html', '.css', '.js', '.json', '.svg', '.png', '.jpg'].includes(ext)) {
      clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(() => {
        console.log(`[Change detected] ${filename} -> Reloading browser...`);
        clients.forEach((res) => {
          try {
            res.write('data: reload\n\n');
          } catch (err) {}
        });
      }, 150);
    }
  });
} catch (err) {
  console.log('File watching note:', err.message);
}

const server = http.createServer((req, res) => {
  if (req.url === '/__live_reload__') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('data: connected\n\n');
    clients.push(res);
    req.on('close', () => {
      const idx = clients.indexOf(res);
      if (idx !== -1) clients.splice(idx, 1);
    });
    return;
  }

  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  let filePath = path.join(ROOT, reqPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h2>404 Not Found</h2><p>${reqPath} does not exist.</p>`);
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end(`Error reading file: ${err.message}`);
        return;
      }

      if (contentType.startsWith('text/html')) {
        let html = data.toString('utf-8');
        if (html.includes('</body>')) {
          html = html.replace('</body>', RELOAD_SCRIPT + '</body>');
        } else {
          html += RELOAD_SCRIPT;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(html);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      }
    });
  });
});

function startServer(p) {
  server.listen(p, () => {
    const url = `http://localhost:${p}`;
    console.log(`\n===========================================`);
    console.log(`🚀 Live Server is ACTIVE at: ${url}`);
    console.log(`⚡ Auto-reload is enabled for changes.`);
    console.log(`===========================================\n`);

    // Automatically open in default browser on Windows
    exec(`start ${url}`);
  });
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    PORT++;
    startServer(PORT);
  } else {
    console.error('Server error:', e);
  }
});

startServer(PORT);
