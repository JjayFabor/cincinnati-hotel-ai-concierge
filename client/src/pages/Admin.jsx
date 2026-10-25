import { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar } from '../components/Brand.jsx';
import { CategoryBars, DailyColumns } from '../components/Charts.jsx';
import { api } from '../api.js';

const timeAgo = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function useLiveStats() {
  const [stats, setStats] = useState(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const [pulse, setPulse] = useState(null);

  useEffect(() => {
    let es;
    let closed = false;
    api.stats().then(setStats).catch((e) => setError(e.message));

    const connect = () => {
      es = new EventSource('/api/admin/events');
      es.addEventListener('hello', () => setLive(true));
      es.addEventListener('stats', (e) => { setStats(JSON.parse(e.data)); setError(''); });
      es.addEventListener('activity', (e) => setPulse({ ...JSON.parse(e.data), key: Date.now() }));
      es.onerror = () => { setLive(false); if (closed) es.close(); };
      es.onopen = () => setLive(true);
    };
    connect();
    return () => { closed = true; es?.close(); };
  }, []);

  const refresh = useCallback(() => api.stats(true).then(setStats).catch((e) => setError(e.message)), []);
  return { stats, live, error, pulse, refresh, setStats };
}

function Toast({ pulse }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pulse) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, [pulse]);
  if (!pulse) return null;
  const text = pulse.type === 'question'
    ? `New question · ${pulse.category}${pulse.answered ? '' : ' · not in document'}`
    : pulse.type === 'contact' ? 'A guest left contact details — email sent to the team'
    : `Knowledge base updated · ${pulse.fileName}`;
  return <div className={`toast ${visible ? 'show' : ''}`} role="status">{text}</div>;
}

function UploadCard({ doc, onUploaded }) {
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | uploading | processing | done | error
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState('');
  const inputRef = useRef(null);

  async function handle(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setPhase('error'); setMsg('Please choose a PDF file.'); return;
    }
    if (doc && !window.confirm(`Replace "${doc.fileName}" with "${file.name}"? The chatbot will immediately start answering from the new file.`)) return;
    setPhase('uploading'); setProgress(0); setMsg('');
    try {
      const res = await api.upload(file, (p) => { setProgress(p); if (p >= 1) setPhase('processing'); });
      setPhase('done');
      setMsg(`Indexed ${res.document?.chunks ?? '?'} sections from ${res.document?.pages ?? '?'} pages.`);
      onUploaded?.();
    } catch (e) {
      setPhase('error'); setMsg(e.message);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const busy = phase === 'uploading' || phase === 'processing';

  return (
    <section className="card upload-card">
      <div className="card-head">
        <h2>Knowledge base</h2>
        <span className="muted small">Single PDF · uploading replaces the current file</span>
      </div>

      {doc ? (
        <div className="doc-current">
          <div className="doc-icon" aria-hidden="true">PDF</div>
          <div>
            <div className="doc-name">{doc.fileName}</div>
            <div className="muted small">{doc.pages} pages · {doc.chunks} sections · {Math.round(doc.characters / 100) / 10}k characters · updated {timeAgo(doc.uploadedAt)}</div>
          </div>
        </div>
      ) : (
        <div className="doc-current none">No document uploaded yet — the chatbot can't answer anything until you add one.</div>
      )}

      <label
        className={`dropzone ${drag ? 'drag' : ''} ${busy ? 'busy' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) handle(e.dataTransfer.files[0]); }}
      >
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(e) => handle(e.target.files[0])} hidden />
        {phase === 'uploading' && <><strong>Uploading… {Math.round(progress * 100)}%</strong><div className="progress"><div style={{ width: `${progress * 100}%` }} /></div></>}
        {phase === 'processing' && <><span className="spinner dark" /><strong>Extracting & indexing in n8n…</strong><span className="muted small">Reading text, splitting it into sections, replacing the old knowledge base</span></>}
        {!busy && <><strong>{doc ? 'Upload a new version' : 'Upload hotel PDF'}</strong><span className="muted small">Drag & drop or click to choose a file</span></>}
      </label>

      {phase === 'done' && <p className="ok-note">✓ {msg}</p>}
      {phase === 'error' && <p className="form-error" role="alert">{msg}</p>}
    </section>
  );
}

export default function Admin() {
  const { stats, live, error, pulse, refresh } = useLiveStats();
  const t = stats?.totals;

  const kpis = [
    { label: 'Chat sessions', value: t?.sessions, sub: t && `${t.sessionsToday} today` },
    { label: 'Questions asked', value: t?.questions, sub: t && `${t.avgQuestionsPerSession} per session` },
    { label: 'Answer rate', value: t?.answerRate == null ? '—' : `${t.answerRate}%`, sub: t && `${t.unanswered} not in document` },
    { label: 'Contact requests', value: t?.contactRequests, sub: 'emailed to guest services' },
  ];

  return (
    <div className="admin-page">
      <TopBar label="Admin">
        <span className={`live ${live ? 'on' : ''}`} title={live ? 'Receiving live updates' : 'Reconnecting…'}>
          <i /> {live ? 'Live' : 'Offline'}
        </span>
      </TopBar>

      <main className="admin-main">
        <div className="admin-title">
          <div>
            <h1>Concierge dashboard</h1>
            <p className="muted">Updates the moment a guest asks a question.{stats?.generatedAt && ` Last update ${timeAgo(stats.generatedAt)}.`}</p>
          </div>
          <button className="btn-ghost small" onClick={refresh}>Refresh</button>
        </div>

        {error && !stats && <p className="form-error">{error}</p>}

        <div className="kpis">
          {kpis.map((k) => (
            <div className="kpi card" key={k.label}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" key={String(k.value)}>{k.value ?? <span className="skeleton" />}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="admin-grid">
          <section className="card span-2">
            <div className="card-head"><h2>Questions by topic</h2><span className="muted small">Classified by the AI in n8n</span></div>
            {stats ? <CategoryBars categories={stats.categories} /> : <div className="skeleton block" />}
          </section>

          <UploadCard doc={stats?.document} onUploaded={refresh} />

          <section className="card">
            <div className="card-head"><h2>Last 14 days</h2><span className="muted small">Questions per day</span></div>
            {stats ? <DailyColumns daily={stats.daily} /> : <div className="skeleton block" />}
          </section>

          <section className="card span-2">
            <div className="card-head"><h2>Recent questions</h2></div>
            {stats?.recentQuestions?.length ? (
              <ul className="feed">
                {stats.recentQuestions.map((q, i) => (
                  <li key={i}>
                    <span className={`dot ${q.answered ? 'ok' : 'miss'}`} title={q.answered ? 'Answered' : 'Not in document'} />
                    <span className="feed-q">{q.question}</span>
                    <span className="tag">{q.category}</span>
                    <span className="muted small nowrap">{timeAgo(q.asked_at)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="empty">Questions will appear here as guests chat.</p>}
          </section>

          <section className="card span-3">
            <div className="card-head"><h2>Contact requests</h2><span className="muted small">Each one triggered an email to idan@tauga.ai and deleonajiraydiego@gmail.com</span></div>
            {stats?.recentLeads?.length ? (
              <ul className="feed leads">
                {stats.recentLeads.map((l, i) => (
                  <li key={i}>
                    <div><strong>{l.name}</strong><div className="muted small">“{l.question}”</div></div>
                    <span className="muted small nowrap">{timeAgo(l.submitted_at)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="empty">None yet. Guests are offered the form when the bot can't answer.</p>}
          </section>
        </div>
      </main>
      <Toast pulse={pulse} />
    </div>
  );
}
