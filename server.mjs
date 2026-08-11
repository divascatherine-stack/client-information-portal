import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(root, 'data', 'records.json');
const port = Number(process.env.PORT || 3000);
const adminKey = process.env.ADMIN_KEY;

if (!adminKey) {
  console.error('Set ADMIN_KEY before starting the server. Example: $env:ADMIN_KEY="use-a-long-random-secret"');
  process.exit(1);
}

async function readRecords() {
  try { return JSON.parse(await fs.readFile(dataFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function writeRecords(records) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(records, null, 2), 'utf8');
}
function sameSecret(value) {
  if (!value || value.length !== adminKey.length) return false;
  return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(adminKey));
}
function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(body));
}
async function body(request) {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  if (raw.length > 100_000) throw new Error('Request too large');
  return JSON.parse(raw || '{}');
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/api/records' && request.method === 'POST') {
      const record = await body(request);
      if (!record.name || !record.email || !record.provider || !record.planTypes) return send(response, 400, { error: 'Required fields are missing' });
      const records = await readRecords();
      records.unshift({ ...record, id: crypto.randomUUID(), receivedAt: new Date().toISOString() });
      await writeRecords(records);
      return send(response, 201, { ok: true });
    }
    if (url.pathname === '/api/records' && request.method === 'DELETE') {
      if (!sameSecret(request.headers['x-admin-key'])) return send(response, 401, { error: 'Admin authorization required' });
      await writeRecords([]);
      return send(response, 200, { ok: true });
    }
    if (url.pathname.startsWith('/api/records/') && request.method === 'DELETE') {
      if (!sameSecret(request.headers['x-admin-key'])) return send(response, 401, { error: 'Admin authorization required' });
      const records = await readRecords();
      const id = url.pathname.split('/').pop();
      await writeRecords(records.filter((record) => record.id !== id));
      return send(response, 200, { ok: true });
    }
    if (url.pathname === '/api/records' && request.method === 'GET') {
      if (!sameSecret(request.headers['x-admin-key'])) return send(response, 401, { error: 'Admin authorization required' });
      return send(response, 200, await readRecords());
    }
    const requested = url.pathname === '/' ? '/html/index.html' : url.pathname === '/admin' ? '/html/admin.html' : url.pathname;
    const file = path.resolve(root, `.${requested}`);
    if (!file.startsWith(root) || !(await fs.stat(file).catch(() => false))) return send(response, 404, { error: 'Not found' });
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(await fs.readFile(file));
  } catch (error) { console.error(error); send(response, 500, { error: 'Server error' }); }
});
server.listen(port, () => console.log(`Open http://localhost:${port}/ and http://localhost:${port}/admin`));
