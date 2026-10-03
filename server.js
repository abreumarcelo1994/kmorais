const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function serveFile(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - Arquivo não encontrado</h1>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const totalSize = stats.size;

    // Suporte a Streaming de Vídeo (Range Requests) para navegadores
    const range = req.headers.range;
    if (range && (ext === '.mp4' || ext === '.webm')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': req.headers.origin || '*'
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
      return;
    }

    // Resposta Padrão
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': totalSize,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': req.headers.origin || '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(url.pathname);

  // Endpoint de salvamento direto no disco para desenvolvimento local
  if (req.method === 'POST' && pathname === '/api/save-content') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': req.headers.origin || '*' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        fs.writeFileSync(path.join(BASE_DIR, 'content.json'), JSON.stringify(parsed, null, 2), 'utf-8');
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': req.headers.origin || '*'
        });
        res.end(JSON.stringify({ success: true, message: 'content.json salvo no disco!' }));
      } catch (err) {
        res.writeHead(400, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': req.headers.origin || '*'
        });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Endpoint para carregar configuracao local do GitHub sem comitar no repositorio
  if (req.method === 'GET' && pathname === '/api/github-config') {
    const configPath = path.join(BASE_DIR, 'local-config.json');
    if (fs.existsSync(configPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': req.headers.origin || '*'
      });
      res.end(fs.readFileSync(configPath, 'utf8'));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Config not found' }));
    return;
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Prevenção de Path Traversal
  let safePath = path.normalize(path.join(BASE_DIR, pathname));
  if (!safePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Suporte a Clean URLs (ex: /admin -> admin.html)
  if (!fs.existsSync(safePath) && fs.existsSync(safePath + '.html')) {
    safePath += '.html';
  }

  serveFile(req, res, safePath);
});

let currentPort = parseInt(PORT, 10);

server.on('listening', () => {
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : currentPort;
  console.log('----------------------------------------------------');
  console.log(`🚀 Servidor local KMORAIS ativo!`);
  console.log(`👉 Site público:       http://localhost:${actualPort}/index.html`);
  console.log(`👉 Painel Admin (CMS): http://localhost:${actualPort}/admin.html`);
  console.log('----------------------------------------------------');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️  Porta ${currentPort} já está em uso.`);
    currentPort += 1;
    console.log(`🔄 Tentando porta ${currentPort}...`);
    server.listen(currentPort);
  } else {
    console.error('❌ Erro no servidor:', err);
    process.exit(1);
  }
});

server.listen(currentPort);

