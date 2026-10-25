import { Link } from 'react-router-dom';

export function Mark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--navy)" />
      <path d="M20 46V24l12-8 12 8v22" fill="none" stroke="var(--brass)" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M28 46V34h8v12" fill="none" stroke="var(--brass)" strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}

export function TopBar({ label, children }) {
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Back to start">
        <Mark />
        <span>
          <span className="brand-name">Cincinnati Hotel</span>
          {label && <span className="brand-label">{label}</span>}
        </span>
      </Link>
      <div className="topbar-actions">{children}</div>
    </header>
  );
}
