// Small dependency-free charts for the admin dashboard.

export function CategoryBars({ categories = [] }) {
  const rows = categories.filter((c) => c.questions > 0);
  const empty = categories.filter((c) => c.questions === 0);
  const max = Math.max(1, ...rows.map((c) => c.questions));

  if (!rows.length) return <p className="empty">No questions yet. Open the chat as a guest and ask something — the bars fill in live.</p>;

  return (
    <div className="cat-bars">
      {rows.map((c) => {
        const answered = c.questions - c.unanswered;
        return (
          <div className="cat-row" key={c.category}>
            <div className="cat-label">{c.category}</div>
            <div className="cat-track" title={`${answered} answered, ${c.unanswered} unanswered`}>
              <div className="cat-fill answered" style={{ width: `${(answered / max) * 100}%` }} />
              <div className="cat-fill unanswered" style={{ width: `${(c.unanswered / max) * 100}%` }} />
            </div>
            <div className="cat-count">{c.questions}</div>
          </div>
        );
      })}
      <div className="legend">
        <span><i className="sw answered" /> Answered</span>
        <span><i className="sw unanswered" /> Not in document</span>
        {empty.length > 0 && <span className="muted">{empty.length} topic{empty.length > 1 ? 's' : ''} with no questions yet</span>}
      </div>
    </div>
  );
}

export function DailyColumns({ daily = [] }) {
  const max = Math.max(1, ...daily.map((d) => d.questions));
  const fmt = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <div className="daily">
      <div className="daily-cols">
        {daily.map((d) => (
          <div className="daily-col" key={d.date} title={`${fmt(d.date)}: ${d.questions} questions, ${d.sessions} sessions`}>
            <span className="daily-val">{d.questions || ''}</span>
            <div className="daily-bar" style={{ height: `${Math.max(d.questions ? 6 : 2, (d.questions / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="daily-axis">
        <span>{daily[0] && fmt(daily[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
