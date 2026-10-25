// Real-time layer: caches the latest statistics and pushes updates to every
// open admin dashboard over Server-Sent Events.

import { n8n } from './n8n.js';

const clients = new Set();
let latest = null;
let inFlight = null;
let queued = false;

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function broadcast(event, data) {
  for (const res of clients) send(res, event, data);
}

export function getCachedStats() {
  return latest;
}

// Fetch fresh stats from n8n and broadcast them. Concurrent calls are coalesced:
// at most one request in flight plus one queued follow-up, so a burst of chat
// messages never floods n8n but the final state is always pushed.
export function refreshStats() {
  if (inFlight) {
    queued = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      latest = await n8n.stats();
      broadcast('stats', latest);
      return latest;
    } catch (err) {
      console.error('[stats] refresh failed:', err.message);
      return latest;
    } finally {
      inFlight = null;
      if (queued) {
        queued = false;
        refreshStats();
      }
    }
  })();
  return inFlight;
}

export function sseHandler(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  clients.add(res);
  send(res, 'hello', { clients: clients.size });
  if (latest) send(res, 'stats', latest);
  else refreshStats();

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}
