// netlify/functions/tvl-history.mjs
import { getStore } from '@netlify/blobs';

const BLOB_PATH = 'whalecoin/tvl-history.json';
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 20 * 60 * 1000;
const RETENTION_MS = 2 * DAY_MS;
const store = getStore('whalecoin-v4');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

async function readJson(path, fallback) {
  try {
    const data = await store.get(path, { type: 'json' });
    return data ?? fallback;
  } catch (_) {
    return fallback;
  }
}

async function writeJson(path, data) {
  await store.set(path, JSON.stringify(data));
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  let history = await readJson(BLOB_PATH, []);

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const value = Number(body?.value);
      if (value && value > 0) {
        const now = Date.now();
        const last = history[history.length - 1];
        if (!last || now - last.t > MIN_GAP_MS) {
          history.push({ t: now, v: value });
        } else {
          last.v = value;
        }
        const cutoff = now - RETENTION_MS;
        history = history.filter((p) => p.t >= cutoff);
        await writeJson(BLOB_PATH, history);
      }
    } catch (_) {}
  }

  return json({ history });
};