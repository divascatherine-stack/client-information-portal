import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const store = getStore('client-information-records');
const adminKey = process.env.ADMIN_KEY;
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function authorized(event) {
  return Boolean(adminKey && event.headers['x-admin-key'] === adminKey);
}
async function readRecords() {
  return (await store.get('records', { type: 'json' })) || [];
}
function response(statusCode, body) {
  return new Response(JSON.stringify(body), { status: statusCode, headers });
}

export default async (event) => {
  try {
    if (event.httpMethod === 'POST') {
      const record = JSON.parse(event.body || '{}');
      if (!record.name || !record.email || !record.provider || !record.planTypes) return response(400, { error: 'Required fields are missing' });
      const records = await readRecords();
      records.unshift({ ...record, id: crypto.randomUUID(), receivedAt: new Date().toISOString() });
      await store.setJSON('records', records);
      return response(201, { ok: true });
    }
    if (!authorized(event)) return response(401, { error: 'Admin authorization required' });
    if (event.httpMethod === 'GET') return response(200, await readRecords());
    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
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
