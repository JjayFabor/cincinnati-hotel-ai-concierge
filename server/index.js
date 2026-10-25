import express from 'express';
import compression from 'compression';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { n8n, n8nConfigured, N8nError } from './n8n.js';
import { broadcast, getCachedStats, refreshStats, sseHandler } from './live.js';
import { validateChat, validateContact, isPdf, safeFileName } from './validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../client/dist');
const PORT = Number(process.env.PORT) || 3001;
const MAX_PDF_MB = Number(process.env.MAX_PDF_MB) || 15;

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Never compress the SSE stream, or events get buffered instead of pushed.
app.use(compression({ filter: (req, res) => !req.path.endsWith('/events') && compression.filter(req, res) }));
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' });
  next();
});

const chatLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many messages — please wait a moment.' } });
const contactLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests — please try again later.' } });
const uploadLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many uploads — please try again later.' } });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_MB * 1024 * 1024, files: 1 },
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Health ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, n8n: n8nConfigured(), time: new Date().toISOString() });
});

// ---------- Guest chat ----------
app.post('/api/chat', chatLimiter, wrap(async (req, res) => {
  const { value, error } = validateChat(req.body);
  if (error) return res.status(400).json({ error });

  const result = await n8n.chat(value);
  const reply = {
    answer: String(result.answer || ''),
    answered: result.answered === true,
    category: result.category || 'General',
  };
  res.json(reply);

  broadcast('activity', { type: 'question', category: reply.category, answered: reply.answered, at: new Date().toISOString() });
  refreshStats();
}));

app.post('/api/contact', contactLimiter, wrap(async (req, res) => {
  const { value, errors } = validateContact(req.body);
  if (errors) return res.status(400).json({ error: 'Please check the highlighted fields.', fields: errors });

  await n8n.contact(value);
  res.json({ ok: true });

  broadcast('activity', { type: 'contact', at: new Date().toISOString() });
  refreshStats();
}));

// ---------- Admin ----------
app.post('/api/admin/upload', uploadLimiter, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please choose a PDF file.' });
  if (!isPdf(req.file.buffer)) return res.status(400).json({ error: 'That file is not a valid PDF.' });

  const fileName = safeFileName(req.file.originalname);
  const result = await n8n.ingest(req.file.buffer, fileName);
  res.json({ ok: true, document: result.document || null });

  broadcast('activity', { type: 'upload', fileName, at: new Date().toISOString() });
  refreshStats();
}));

app.get('/api/admin/stats', wrap(async (req, res) => {
  const fresh = req.query.fresh === '1' || !getCachedStats();
  const stats = fresh ? await refreshStats() : getCachedStats();
  if (!stats) throw new N8nError('Statistics are temporarily unavailable.', 502);
  res.json(stats);
}));

app.get('/api/admin/events', sseHandler);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- Frontend ----------
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h', setHeaders: (res, file) => {
    if (file.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
  } }));
  app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

// ---------- Errors ----------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `The PDF must be smaller than ${MAX_PDF_MB} MB.` : 'Upload failed.';
    return res.status(400).json({ error: msg });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !(err instanceof N8nError) ? 'Something went wrong.' : err.message });
});

app.listen(PORT, () => {
  console.log(`Cincinnati Hotel server on http://localhost:${PORT} (n8n configured: ${n8nConfigured()})`);
  if (n8nConfigured()) refreshStats();
});
