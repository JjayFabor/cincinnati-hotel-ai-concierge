import { useEffect, useRef, useState } from 'react';
import { TopBar } from '../components/Brand.jsx';
import ContactForm from '../components/ContactForm.jsx';
import { api, newSessionId } from '../api.js';

const STORE_KEY = 'cincinnati-chat-v1';
const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  content: "Welcome to the Cincinnati Hotel! I'm your virtual concierge. Ask me anything about our rooms, rates, dining, amenities or services.",
  local: true,
};
const SUGGESTIONS = ['What room types do you offer?', 'What time is check-in?', 'Is there a pool or gym?', 'Where can I park?'];

function loadState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY));
    if (saved?.sessionId && Array.isArray(saved.messages)) return saved;
  } catch { /* ignore */ }
  return { sessionId: newSessionId(), messages: [WELCOME] };
}

// Lightweight formatting: paragraphs + "- " / "• " bullet lists. No HTML injection.
function RichText({ text }) {
  const blocks = [];
  let list = null;
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^\s*(?:[-•*]|\d+\.)\s+(.*)$/);
    if (m) {
      if (!list) { list = []; blocks.push({ type: 'ul', items: list, key: i }); }
      list.push(m[1]);
    } else {
      list = null;
      if (line.trim()) blocks.push({ type: 'p', text: line, key: i });
    }
  });
  return blocks.map((b) => (b.type === 'ul'
    ? <ul key={b.key}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
    : <p key={b.key}>{b.text}</p>));
}

export default function Chat() {
  const [state, setState] = useState(loadState);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const { sessionId, messages } = state;

  useEffect(() => {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [state, busy]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const update = (fn) => setState((s) => ({ ...s, messages: fn(s.messages) }));
  const conversation = (msgs) => msgs.filter((m) => !m.local && !m.error).map(({ role, content }) => ({ role, content }));

  async function send(text) {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    const userMsg = { id: newSessionId(), role: 'user', content: question };
    const history = conversation(messages);
    update((m) => [...m.filter((x) => !x.error), userMsg]);
    setBusy(true);
    try {
      const res = await api.chat({ sessionId, message: question, history });
      update((m) => [...m, {
        id: newSessionId(),
        role: 'assistant',
        content: res.answer,
        unanswered: !res.answered,
        question,
        contact: res.answered ? null : 'offer',
      }]);
    } catch (err) {
      update((m) => [...m, { id: newSessionId(), role: 'assistant', content: err.message, error: true, retry: question }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function setContact(id, value, extra = {}) {
    update((m) => m.map((x) => (x.id === id ? { ...x, contact: value, ...extra } : x)));
  }

  function newChat() {
    setState({ sessionId: newSessionId(), messages: [WELCOME] });
    setInput('');
  }

  const showSuggestions = messages.length === 1 && !busy;

  return (
    <div className="chat-page">
      <TopBar label="Concierge">
        <button className="btn-ghost small" onClick={newChat}>New chat</button>
      </TopBar>

      <main className="chat-main">
        <div className="chat-scroll" aria-live="polite">
          {messages.map((m, idx) => (
            <div key={m.id} className={`msg-row ${m.role}`}>
              {m.role === 'assistant' && <div className="avatar" aria-hidden="true">C</div>}
              <div className="msg-col">
                <div className={`bubble ${m.role}${m.error ? ' error' : ''}${m.unanswered ? ' unanswered' : ''}`}>
                  <RichText text={m.content} />
                  {m.error && m.retry && (
                    <button className="link-btn" onClick={() => send(m.retry)}>Try again</button>
                  )}
                </div>

                {m.contact === 'offer' && (
                  <div className="offer">
                    <button className="btn-primary small" onClick={() => setContact(m.id, 'form')}>Leave my contact details</button>
                    <button className="btn-ghost small" onClick={() => setContact(m.id, 'dismissed')}>No thanks</button>
                  </div>
                )}
                {m.contact === 'form' && (
                  <ContactForm
                    sessionId={sessionId}
                    question={m.question}
                    transcript={conversation(messages.slice(0, idx + 1))}
                    onDone={(name) => setContact(m.id, 'sent', { contactName: name })}
                    onDismiss={() => setContact(m.id, 'dismissed')}
                  />
                )}
                {m.contact === 'sent' && (
                  <div className="sent-note" role="status">
                    <span aria-hidden="true">✓</span> Thank you{m.contactName ? `, ${m.contactName.split(' ')[0]}` : ''}! Our team has your details and will be in touch soon.
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="msg-row assistant">
              <div className="avatar" aria-hidden="true">C</div>
              <div className="bubble assistant typing" aria-label="Concierge is typing"><span /><span /><span /></div>
            </div>
          )}

          {showSuggestions && (
            <div className="suggestions">
              {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <div className="composer-inner">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={1000}
            placeholder="Ask about rooms, dining, parking…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            aria-label="Your question"
          />
          <button type="submit" className="send-btn" disabled={!input.trim() || busy} aria-label="Send">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 12l16-8-6 16-2-7-8-1z" fill="currentColor" /></svg>
          </button>
        </div>
        <p className="composer-note">Answers come only from the hotel's official information document.</p>
      </form>
    </div>
  );
}
