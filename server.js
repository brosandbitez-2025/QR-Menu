const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3333;
const DATA_FILE = path.join(__dirname, 'menu_data.json');
const CONFIG_FILE = path.join(__dirname, 'admin_config.json');
const ASSETS_DIR = path.join(__dirname, 'Assets');

// Ensure admin config file exists with default PIN
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ adminPin: '1234' }, null, 2), 'utf8');
}

// Ensure Assets dir exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const sseClients = new Set();

function broadcastMenuUpdate(menuData) {
  const payload = `data: ${JSON.stringify({ type: 'menu_update', data: menuData })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// Keep-alive heartbeat every 20s
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': ping\n\n');
    } catch (err) {
      sseClients.delete(client);
    }
  }
}, 20000);

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const decodedPath = decodeURIComponent(parsedUrl.pathname);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Real-time Live Sync (SSE) for instant reflections on QR menu
  if (req.method === 'GET' && decodedPath === '/api/live-sync') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('data: {"type":"connected"}\n\n');
    sseClients.add(res);
    console.log(`[SSE] Client connected. Total active clients: ${sseClients.size}`);

    req.on('close', () => {
      sseClients.delete(res);
      console.log(`[SSE] Client disconnected. Remaining clients: ${sseClients.size}`);
    });
    return;
  }

  // API: Get current menu data
  if (req.method === 'GET' && decodedPath === '/api/menu') {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read menu data' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      }
    });
    return;
  }

  // API: Save menu data
  if (req.method === 'POST' && decodedPath === '/api/menu') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        // Validate JSON
        const parsed = JSON.parse(body);
        fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf8');

        console.log(`[API /api/menu] Saved menu data (${parsed.categories?.length} categories). Broadcasting to ${sseClients.size} clients.`);

        // Broadcast to all connected customer QR menu screens instantly
        broadcastMenuUpdate(parsed);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Menu data updated successfully' }));
      } catch (err) {
        console.error('[API /api/menu] Save error:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload: ' + err.message }));
      }
    });
    return;
  }

  // API: Verify PIN for login (returns valid: true/false, never exposes the real PIN)
  if (req.method === 'POST' && decodedPath === '/api/pin-verify') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { pin } = JSON.parse(body);
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const storedPin = cfg.adminPin || '1234';
        const valid = pin === storedPin;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error', valid: false }));
      }
    });
    return;
  }

  // API: Get current PIN (returns only length, never the real value)
  if (req.method === 'GET' && decodedPath === '/api/pin') {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      const pinLen = (cfg.adminPin || '1234').length;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ pinLength: pinLen }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Could not read PIN config' }));
    }
    return;
  }

  // API: Change admin PIN (requires current PIN verification)
  if (req.method === 'POST' && decodedPath === '/api/pin') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { currentPin, newPin } = JSON.parse(body);
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const storedPin = cfg.adminPin || '1234';

        if (!currentPin || !newPin) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing currentPin or newPin' }));
          return;
        }
        if (currentPin !== storedPin) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Current PIN is incorrect' }));
          return;
        }
        if (newPin.length < 4) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'New PIN must be at least 4 digits' }));
          return;
        }

        cfg.adminPin = newPin;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
        console.log('[API /api/pin] Admin PIN updated successfully.');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'PIN updated successfully' }));
      } catch (err) {
        console.error('[API /api/pin] Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error: ' + err.message }));
      }
    });
    return;
  }

  // API: File Upload (base64)
  if (req.method === 'POST' && decodedPath === '/api/upload') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        let { fileName, fileData } = payload;
        
        if (!fileName || !fileData) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing fileName or fileData' }));
          return;
        }

        // Clean file name
        const ext = path.extname(fileName) || '.png';
        const baseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeName = `${baseName}_${Date.now()}${ext}`;
        const savePath = path.join(ASSETS_DIR, safeName);

        // Strip data URL header if present
        const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(savePath, base64Data, 'base64');

        const publicUrl = `Assets/${safeName}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, filePath: publicUrl }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upload failed: ' + err.message }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, decodedPath === '/' ? 'index.html' : decodedPath);
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
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
