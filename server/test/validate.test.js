import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateChat, validateContact, isPdf, safeFileName, cleanHistory } from '../validate.js';

const SID = 'session_12345678';

test('chat: accepts a normal question and trims history to 8', () => {
  const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  const { value, error } = validateChat({ sessionId: SID, message: '  Is there a pool? ', history });
  assert.equal(error, undefined);
  assert.equal(value.message, 'Is there a pool?');
  assert.equal(value.history.length, 8);
});

test('chat: rejects empty, oversized and bad-session input', () => {
  assert.ok(validateChat({ sessionId: SID, message: '   ' }).error);
  assert.ok(validateChat({ sessionId: SID, message: 'x'.repeat(1001) }).error);
  assert.ok(validateChat({ sessionId: 'bad id!', message: 'hi' }).error);
});

test('history: drops unknown roles and non-strings', () => {
  const out = cleanHistory([{ role: 'system', content: 'x' }, { role: 'user', content: 5 }, { role: 'user', content: 'ok' }]);
  assert.deepEqual(out, [{ role: 'user', content: 'ok' }]);
});

test('contact: valid submission passes', () => {
  const { value, errors } = validateContact({ sessionId: SID, name: 'Jane Doe', phone: '+1 (513) 555-0142', email: 'jane@example.com', unansweredQuestion: 'Pets?' });
  assert.equal(errors, undefined);
  assert.equal(value.email, 'jane@example.com');
});

test('contact: reports each invalid field', () => {
  const { errors } = validateContact({ sessionId: SID, name: 'J', phone: 'abc', email: 'nope' });
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'name', 'phone']);
});

test('pdf: magic-byte check and safe file names', () => {
  assert.equal(isPdf(Buffer.from('%PDF-1.7 ...')), true);
  assert.equal(isPdf(Buffer.from('<html>')), false);
  assert.equal(safeFileName('../../etc/passwd'), 'passwd.pdf');
  assert.equal(safeFileName('Hotel Guide 2026.PDF'), 'Hotel Guide 2026.PDF');
});
