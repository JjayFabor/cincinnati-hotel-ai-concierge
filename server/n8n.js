// Thin client for the four n8n webhooks that hold all AI and data logic.

const BASE = (process.env.N8N_WEBHOOK_BASE_URL || '').replace(/\/+$/, '');
const SECRET = process.env.N8N_SHARED_SECRET || '';

export const n8nConfigured = () => Boolean(BASE && SECRET);

export class N8nError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function call(path, { method = 'POST', json, form, timeoutMs = 60000 } = {}) {
  if (!n8nConfigured()) {
    throw new N8nError('The automation backend is not configured (N8N_WEBHOOK_BASE_URL / N8N_SHARED_SECRET).', 503);
  }
  const headers = { 'x-hotel-secret': SECRET };
  let body;
  if (json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }

  let res;
  try {
    res = await fetch(`${BASE}/${path}`, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError';
    throw new N8nError(timedOut ? 'The assistant took too long to respond.' : 'Could not reach the automation backend.', timedOut ? 504 : 502);
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`[n8n] ${path} -> ${res.status}: ${text.slice(0, 500)}`);
    throw new N8nError(`Automation workflow failed (${res.status}).`, 502);
  }
  if (!text) {
    // n8n answers 200 with an empty body when the webhook's "only run if" check rejects the secret.
    throw new N8nError('Automation workflow returned no data (check N8N_SHARED_SECRET and that the workflow is published).', 502);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new N8nError('Automation workflow returned an invalid response.', 502);
  }
}

export const n8n = {
  chat: (payload) => call('cincinnati-hotel/chat', { json: payload, timeoutMs: 60000 }),
  contact: (payload) => call('cincinnati-hotel/contact', { json: payload, timeoutMs: 60000 }),
  stats: () => call('cincinnati-hotel/stats', { method: 'GET', timeoutMs: 30000 }),
  ingest: (buffer, fileName) => {
    const form = new FormData();
    form.append('fileName', fileName);
    form.append('data', new Blob([buffer], { type: 'application/pdf' }), fileName);
    return call('cincinnati-hotel/ingest', { form, timeoutMs: 120000 });
  },
};
