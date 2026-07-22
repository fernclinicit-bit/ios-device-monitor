const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Memory Cache to prevent API exhaustion and provide 0ms reads
let dbInMemory = { devices: [], logs: [] };

// JSONBin cloud storage config
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;

// Helper to read database from memory cache
function readDb() {
  return dbInMemory;
}

// Helper to write database to memory cache and persist it (Cloud or Local File)
function writeDb(data) {
  dbInMemory = data;
  if (JSONBIN_API_KEY && JSONBIN_BIN_ID) {
    saveToJsonBin(data)
      .then(() => console.log('Successfully synced database to JSONBin cloud!'))
      .catch((err) => console.error('Failed to sync to JSONBin cloud:', err.message));
  } else {
    try {
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Error writing local database:', err);
    }
  }
}

// JSONBin.io integration helpers
function fetchFromJsonBin() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.jsonbin.io',
      port: 443,
      path: `/v3/b/${JSONBIN_BIN_ID}/latest`,
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Bin-Meta': 'false'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error('Failed to parse JSONBin payload'));
          }
        } else {
          reject(new Error(`JSONBin error status: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}

function saveToJsonBin(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: 'api.jsonbin.io',
      port: 443,
      path: `/v3/b/${JSONBIN_BIN_ID}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`JSONBin save error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

// Initialize database
function initDb(callback) {
  if (JSONBIN_API_KEY && JSONBIN_BIN_ID) {
    console.log('Detected JSONBin config. Fetching database from cloud...');
    fetchFromJsonBin()
      .then((data) => {
        dbInMemory = data || { devices: [], logs: [] };
        console.log('Database successfully loaded from JSONBin cloud!');
        callback();
      })
      .catch((err) => {
        console.error('Failed to load database from JSONBin cloud, falling back to local file:', err.message);
        loadLocalDb();
        callback();
      });
  } else {
    console.log('Using local file system database.');
    loadLocalDb();
    callback();
  }
}

function loadLocalDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify({ devices: [], logs: [] }, null, 2));
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    dbInMemory = JSON.parse(data);
    console.log('Database successfully loaded from local file.');
  } catch (err) {
    console.error('Error reading local database:', err);
    dbInMemory = { devices: [], logs: [] };
  }
}

// Reverse Geocoding helper using OpenStreetMap Nominatim
function getAddressFromCoords(lat, lng) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=th`;
    const options = {
      headers: {
        'User-Agent': 'iOS-Device-Monitor-App'
      }
    };

    https.get(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.display_name || '');
          } catch (e) {
            resolve('');
          }
        } else {
          resolve('');
        }
      });
    }).on('error', (e) => {
      console.error('Nominatim reverse geocode error:', e.message);
      resolve('');
    });
  });
}

// Log actions
function addLog(db, deviceId, deviceName, action) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    deviceId,
    deviceName,
    action
  };
  db.logs.unshift(logEntry); // Add to the top of logs
  // Keep logs to a reasonable number (e.g. 100 max)
  if (db.logs.length > 100) {
    db.logs = db.logs.slice(0, 100);
  }
}

// Get local IPv4 address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

// Check verification status based on timestamps
function calculateDeviceStatus(lastVerifiedAtStr) {
  if (!lastVerifiedAtStr || lastVerifiedAtStr === '') {
    return {
      status: 'unverified',
      nextDueAt: '',
      daysRemaining: '-'
    };
  }

  const lastVerifiedAt = new Date(lastVerifiedAtStr).getTime();
  const now = Date.now();
  
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const CYCLE_MS = 30 * ONE_DAY_MS; // 30 days cycle
  const PENDING_WINDOW_MS = 5 * ONE_DAY_MS; // starts showing pending 5 days before due date
  
  const nextDueAt = lastVerifiedAt + CYCLE_MS;
  const msRemaining = nextDueAt - now;

  let status = 'active';
  if (msRemaining <= 0) {
    status = 'overdue';
  } else if (msRemaining <= PENDING_WINDOW_MS) {
    status = 'pending';
  }

  return {
    status,
    nextDueAt: new Date(nextDueAt).toISOString(),
    daysRemaining: Math.ceil(msRemaining / ONE_DAY_MS)
  };
}

// MIME Types mapping
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Strip query string for robust routing and file serving
  const qPos = req.url.indexOf('?');
  const pathname = qPos !== -1 ? req.url.substring(0, qPos) : req.url;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API Routes ---

  // GET /api/devices - Get all devices and status
  if (req.method === 'GET' && pathname === '/api/devices') {
    const db = readDb();
    
    // Dynamically calculate current status for each device
    const processedDevices = db.devices.map(device => {
      const { status, nextDueAt, daysRemaining } = calculateDeviceStatus(device.lastVerifiedAt);
      return {
        ...device,
        status,
        nextDueAt,
        daysRemaining
      };
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      devices: processedDevices, 
      logs: db.logs,
      serverIp: getLocalIpAddress()
    }));
    return;
  }

  // POST /api/register - Register a new device
  if (req.method === 'POST' && pathname === '/api/register') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { name, position, deviceNumber, accessories, userAgent, isIOS } = data;

        if (!name || name.trim() === '') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Device name is required.' }));
          return;
        }

        const db = readDb();
        const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown';
        const deviceId = 'dev-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

        const newDevice = {
          id: deviceId,
          name: name.trim(),
          userName: name.trim(),
          position: (position || '').trim(),
          deviceNumber: (deviceNumber || '').trim(),
          accessories: (accessories || '').trim(),
          userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
          ip: clientIp,
          isIOS: !!isIOS,
          registeredAt: new Date().toISOString(),
          lastVerifiedAt: ''
        };

        db.devices.push(newDevice);
        addLog(db, deviceId, newDevice.name, 'Registered device');
        writeDb(db);

        console.log(`Device Registered: ${newDevice.name} (ID: ${deviceId})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Device registered successfully', device: newDevice }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid payload' }));
      }
    });
    return;
  }

  // POST /api/verify - Verify device presence
  if (req.method === 'POST' && pathname === '/api/verify') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { deviceId, latitude, longitude } = data;

        if (!deviceId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Device ID is required.' }));
          return;
        }

        const db = readDb();
        const deviceIndex = db.devices.findIndex(d => d.id === deviceId);

        if (deviceIndex === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Device not found.' }));
          return;
        }

        // Update verification time and GPS coordinates
        const now = new Date().toISOString();
        db.devices[deviceIndex].lastVerifiedAt = now;
        
        let logMsg = 'Confirmed presence (Monthly Check)';
        if (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null) {
          db.devices[deviceIndex].latitude = latitude;
          db.devices[deviceIndex].longitude = longitude;
          db.devices[deviceIndex].lastLocationTime = now;
          
          // Get physical address from OpenStreetMap Nominatim
          const address = await getAddressFromCoords(latitude, longitude);
          db.devices[deviceIndex].address = address || '';
          
          if (address) {
            logMsg += ` at ${address}`;
          } else {
            logMsg += ` at [Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}]`;
          }
        }
        
        addLog(db, deviceId, db.devices[deviceIndex].name, logMsg);
        writeDb(db);

        console.log(`Device Verified: ${db.devices[deviceIndex].name} (${deviceId})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Device verification recorded successfully' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid payload' }));
      }
    });
    return;
  }

  // POST /api/delete-device - Remove device
  if (req.method === 'POST' && pathname === '/api/delete-device') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { deviceId } = data;

        if (!deviceId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Device ID is required.' }));
          return;
        }

        const db = readDb();
        const device = db.devices.find(d => d.id === deviceId);
        if (!device) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Device not found.' }));
          return;
        }

        db.devices = db.devices.filter(d => d.id !== deviceId);
        addLog(db, deviceId, device.name, 'Removed device from system');
        writeDb(db);

        console.log(`Device Deleted: ${device.name} (${deviceId})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Device removed successfully.' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid payload' }));
      }
    });
    return;
  }

  // POST /api/edit-device - Edit device details
  if (req.method === 'POST' && pathname === '/api/edit-device') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { deviceId, name, position, deviceNumber, accessories, isIOS } = data;

        if (!deviceId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Device ID is required.' }));
          return;
        }

        if (!name || name.trim() === '') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Device name is required.' }));
          return;
        }

        const db = readDb();
        const deviceIndex = db.devices.findIndex(d => d.id === deviceId);
        if (deviceIndex === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Device not found.' }));
          return;
        }

        // Update fields
        db.devices[deviceIndex].name = name.trim();
        db.devices[deviceIndex].userName = name.trim();
        db.devices[deviceIndex].position = (position || '').trim();
        db.devices[deviceIndex].deviceNumber = (deviceNumber || '').trim();
        db.devices[deviceIndex].accessories = (accessories || '').trim();
        db.devices[deviceIndex].isIOS = !!isIOS;

        addLog(db, deviceId, name.trim(), 'Edited device details');
        writeDb(db);

        console.log(`Device Edited: ${name.trim()} (${deviceId})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Device details updated successfully.' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid payload' }));
      }
    });
    return;
  }

  // --- Static File Server ---
  let reqUrl = pathname === '/' ? '/index.html' : pathname;
  // Prevent directory traversal attacks
  const safeSuffix = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safeSuffix);

  // Check if file is inside public directory
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`500 Internal Server Error: ${err.code}`);
      }
    } else {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

initDb(() => {
  server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`📱 iOS Device Monitor server is running locally!`);
    console.log(`🔗 Access Portal: http://localhost:${PORT}`);
    console.log(`==================================================`);
  });
});
