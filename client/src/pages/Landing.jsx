import { useNavigate } from 'react-router-dom';
import { Mark } from '../components/Brand.jsx';

export default function Landing() {
  const navigate = useNavigate();
  return (
    <main className="landing">
      <div className="landing-inner">
        <div className="landing-mark"><Mark size={56} /></div>
        <p className="eyebrow">Downtown Cincinnati · Est. 1926</p>
        <h1 className="landing-title">Cincinnati Hotel</h1>
        <p className="landing-sub">Our AI concierge answers questions about rooms, rates, dining and amenities — around the clock.</p>

        <div className="mode-buttons" role="group" aria-label="Choose a mode">
          <button className="mode-btn mode-guest" onClick={() => navigate('/chat')}>
            <span className="mode-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 5h16v10H8l-4 4V5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            </span>
            <span className="mode-text">
              <span className="mode-title">Regular User</span>
              <span className="mode-desc">Chat with the hotel concierge</span>
            </span>
            <span className="mode-arrow" aria-hidden="true">→</span>
          </button>

          <button className="mode-btn mode-admin" onClick={() => navigate('/admin')}>
            <span className="mode-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </span>
            <span className="mode-text">
              <span className="mode-title">Admin</span>
              <span className="mode-desc">Upload the hotel PDF · live statistics</span>
            </span>
            <span className="mode-arrow" aria-hidden="true">→</span>
          </button>
        </div>

        <p className="landing-foot">Demo environment — no sign-in required.</p>
      </div>
    </main>
  );
}
