// Input validation shared by the API routes. Kept dependency-free and unit-tested.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-.\s\d]{7,25}$/;
const SESSION_RE = /^[A-Za-z0-9_-]{8,100}$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function cleanHistory(history, maxItems = 40) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-maxItems)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

export function validateChat(body = {}) {
  const sessionId = str(body.sessionId);
  const message = str(body.message);
  if (!SESSION_RE.test(sessionId)) return { error: 'Invalid session.' };
  if (!message) return { error: 'Please type a question.' };
  if (message.length > 1000) return { error: 'Please keep your question under 1,000 characters.' };
  return { value: { sessionId, message, history: cleanHistory(body.history, 8) } };
}

export function validateContact(body = {}) {
  const sessionId = str(body.sessionId);
  const name = str(body.name);
  const phone = str(body.phone);
  const email = str(body.email);
  const unansweredQuestion = str(body.unansweredQuestion).slice(0, 1000);
  const errors = {};
  if (!SESSION_RE.test(sessionId)) errors.session = 'Invalid session.';
  if (name.length < 2 || name.length > 120) errors.name = 'Please enter your name.';
  if (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 7) errors.phone = 'Please enter a valid phone number.';
  if (!EMAIL_RE.test(email) || email.length > 200) errors.email = 'Please enter a valid email address.';
  if (Object.keys(errors).length) return { errors };
  return {
    value: { sessionId, name, phone, email, unansweredQuestion, transcript: cleanHistory(body.transcript, 40) },
  };
}

export function isPdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 4 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

export function safeFileName(name) {
  const base = String(name || 'hotel-information.pdf').split(/[\\/]/).pop();
  const cleaned = base.replace(/[^\w.\- ()]+/g, '_').slice(0, 120);
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned || 'hotel-information'}.pdf`;
}
