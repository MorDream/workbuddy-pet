import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { HOST, DEFAULT_PORT, RUNTIME_DIR, PORT_FILE, LOG_FILE, ROOT, WORK_TIERS } from './config.mjs';
import { PetState } from './state.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webm': 'video/webm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('payload-too-large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({ _raw: raw });
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, extraHeaders = {}) {
  const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
  const data = isObj ? JSON.stringify(body) : body;
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    ...extraHeaders,
  });
  res.end(data);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, { error: 'not-found', path: filePath });
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(buf);
  });
}

export async function startServer({ port = DEFAULT_PORT, host = HOST, writePortFile = true } = {}) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const state = new PetState();
  const waiters = new Set();

  state.on('change', (snap) => {
    for (const w of waiters) {
      if (snap.counter !== w.since) {
        clearTimeout(w.timer);
        waiters.delete(w);
        if (!w.res.writableEnded) send(w.res, 200, snap);
      }
    }
  });

  const rendererDir = path.join(ROOT, 'renderer');
  const webmDir = path.join(ROOT, 'assets', 'webm');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);
    const p = url.pathname;

    if (req.method === 'OPTIONS') return send(res, 204, '');

    try {
      // Health / discovery
      if (p === '/health' || p === '/') {
        if (p === '/health') {
          return send(res, 200, {
            ok: true,
            name: 'workbuddy-pet',
            version: '0.1.0',
            port,
            pid: process.pid,
            uptimeSec: Math.round(process.uptime()),
            animDir: webmDir,
          });
        }
      }

      // Web UI (also usable as a no-Electron fallback page)
      if (p === '/' || p === '/index.html') return serveFile(res, path.join(rendererDir, 'index.html'));
      if (p === '/style.css') return serveFile(res, path.join(rendererDir, 'style.css'));
      if (p === '/renderer.js') return serveFile(res, path.join(rendererDir, 'renderer.js'));

      // State (supports long-poll: ?since=<counter>&timeout=<ms>)
      if (p === '/state' && req.method === 'GET') {
        const sinceRaw = url.searchParams.get('since');
        const timeoutRaw = url.searchParams.get('timeout');
        const snap = state.snapshot();
        if (sinceRaw === null) return send(res, 200, snap);
        const since = Number(sinceRaw);
        if (!Number.isFinite(since)) return send(res, 400, { error: 'bad-since' });
        if (snap.counter !== since) return send(res, 200, snap);
        const timeout = Math.min(10_000, Math.max(100, Number(timeoutRaw) || 5_000));
        const w = { res, since, timer: null };
        w.timer = setTimeout(() => {
          waiters.delete(w);
          if (!res.writableEnded) send(res, 200, state.snapshot());
        }, timeout);
        waiters.add(w);
        req.on('close', () => {
          clearTimeout(w.timer);
          waiters.delete(w);
        });
        return;
      }

      // Agent hook forwarder entry point
      if (p === '/event' && req.method === 'POST') {
        const body = await readBody(req);
        const result = state.applyHook(body);
        return send(res, result.ok ? 200 : 202, result);
      }

      // External work-status slot (mirrors dsh-pet's /work-status)
      if (p === '/work-status' && req.method === 'POST') {
        const body = await readBody(req);
        const tier = String(body.state ?? body.tier ?? '').toLowerCase();
        if (!WORK_TIERS.includes(tier)) {
          return send(res, 400, { ok: false, error: 'bad-state', allowed: WORK_TIERS });
        }
        return send(res, 200, state.setWorkTier(tier, { source: 'api:work-status', ...body }));
      }
      if (p === '/work-status' && req.method === 'DELETE') {
        return send(res, 200, state.setIdle('api:work-status-clear'));
      }

      if (p === '/anim' && req.method === 'POST') {
        const body = await readBody(req);
        const name = body.name ?? body.anim;
        if (!name) return send(res, 400, { ok: false, error: 'missing-name' });
        return send(res, 200, state.setAnim(name, 'api:anim'));
      }

      if (p === '/say' && req.method === 'POST') {
        const body = await readBody(req);
        if (!body.text) return send(res, 400, { ok: false, error: 'missing-text' });
        return send(res, 200, state.setBubble(body.text, 'api:say'));
      }

      if (p === '/idle' && req.method === 'POST') return send(res, 200, state.setIdle('api:idle'));
      if (p === '/sleep' && req.method === 'POST') return send(res, 200, state.sleep());
      if (p === '/wake' && req.method === 'POST') return send(res, 200, state.wake());

      if (p === '/animations' && req.method === 'GET') {
        const files = fs.existsSync(webmDir)
          ? fs.readdirSync(webmDir).filter((f) => f.endsWith('.webm')).map((f) => f.replace(/\.webm$/, ''))
          : [];
        return send(res, 200, { count: files.length, animations: files.sort() });
      }

      if (p.startsWith('/assets/webm/')) {
        const name = decodeURIComponent(p.slice('/assets/webm/'.length));
        // Prevent traversal: only flat file names.
        if (name.includes('/') || name.includes('\\') || !name.endsWith('.webm')) {
          return send(res, 400, { error: 'bad-asset-path' });
        }
        return serveFile(res, path.join(webmDir, name));
      }

      if (p === '/shutdown' && req.method === 'POST') {
        send(res, 200, { ok: true, shuttingDown: true });
        setTimeout(() => server.close(() => process.exit(0)), 50);
        return;
      }

      return send(res, 404, { error: 'not-found', path: p });
    } catch (err) {
      return send(res, 500, { error: 'internal', message: err.message });
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[wb-pet] port ${port} is already in use. Another pet server may be running.`);
      process.exitCode = 1;
    } else {
      console.error('[wb-pet] server error:', err);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
    server.listen(port, host);
  });

  if (writePortFile) fs.writeFileSync(PORT_FILE, String(port), 'utf8');
  appendLog(`server started on ${host}:${port} pid=${process.pid}`);

  return { server, state, port, host };
}

export function appendLog(line) {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`, 'utf8');
  } catch {
    // logging is best-effort
  }
}

// Run standalone: `node src/server.mjs [port]`
import { fileURLToPath } from 'node:url';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argPort = Number(process.argv[2]);
  const { port } = await startServer({ port: Number.isFinite(argPort) ? argPort : DEFAULT_PORT });
  console.log(`[wb-pet] control service listening on http://${HOST}:${port}`);
  console.log(`[wb-pet] Web UI: http://${HOST}:${port}/`);
}
