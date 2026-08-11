import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const store = getStore('client-information-records');
const adminKey = process.env.ADMIN_KEY;
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function methodOf(event) {
  return event instanceof Request ? event.method : event.httpMethod;
}
function headerOf(event, name) {
  return event instanceof Request ? event.headers.get(name) : event.headers?.[name.toLowerCase()];
}
function authorized(event) {
  return Boolean(adminKey && headerOf(event, 'x-admin-key') === adminKey);
}
async function readRecords() {
  return (await store.get('records', { type: 'json' })) || [];
}
function response(statusCode, body) {
  return new Response(JSON.stringify(body), { status: statusCode, headers });
}

export default async (event) => {
  try {
    const method = methodOf(event);
    if (method === 'POST') {
      const record = event instanceof Request ? await event.json() : JSON.parse(event.body || '{}');
      if (!record.name || !record.email || !record.provider || !record.planTypes) return response(400, { error: 'Required fields are missing' });
      const records = await readRecords();
      records.unshift({ ...record, id: crypto.randomUUID(), receivedAt: new Date().toISOString() });
      await store.setJSON('records', records);
      return response(201, { ok: true });
    }
    if (!authorized(event)) return response(401, { error: 'Admin authorization required' });
    if (method === 'GET') return response(200, await readRecords());
    if (method === 'DELETE') {
      const url = event instanceof Request ? new URL(event.url) : null;
      const id = url?.searchParams.get('id') || event.queryStringParameters?.id;
      const records = await readRecords();
      await store.setJSON('records', id ? records.filter((record) => record.id !== id) : []);
      return response(200, { ok: true });
    }
    return response(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return response(500, { error: 'Server error' });
  }
};
