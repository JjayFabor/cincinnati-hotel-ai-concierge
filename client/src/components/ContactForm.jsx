import { useState } from 'react';
import { api } from '../api.js';

export default function ContactForm({ sessionId, question, transcript, onDone, onDismiss }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | error
  const [message, setMessage] = useState('');

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  function validate() {
    const er = {};
    if (form.name.trim().length < 2) er.name = 'Please enter your name.';
    if (form.phone.replace(/\D/g, '').length < 7) er.phone = 'Please enter a valid phone number.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) er.email = 'Please enter a valid email.';
    return er;
  }

  async function submit(e) {
    e.preventDefault();
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) return;
    setStatus('sending');
    try {
      await api.contact({ sessionId, ...form, unansweredQuestion: question, transcript });
      onDone(form.name.trim());
    } catch (err) {
      setStatus('error');
      setErrors(err.fields || {});
      setMessage(err.message);
    }
  }

  return (
    <form className="contact-card" onSubmit={submit} noValidate>
      <div className="contact-head">
        <div>
          <h3>Leave your details</h3>
          <p>A member of our guest services team will get back to you about: <em>“{question}”</em></p>
        </div>
        <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss contact form">×</button>
      </div>

      <div className="contact-fields">
        <label className={errors.name ? 'invalid' : ''}>
          <span>Full name</span>
          <input value={form.name} onChange={set('name')} autoComplete="name" placeholder="Jane Smith" />
          {errors.name && <small>{errors.name}</small>}
        </label>
        <label className={errors.phone ? 'invalid' : ''}>
          <span>Phone</span>
          <input value={form.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" placeholder="+1 513 555 0100" />
          {errors.phone && <small>{errors.phone}</small>}
        </label>
        <label className={errors.email ? 'invalid' : ''}>
          <span>Email</span>
          <input value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" placeholder="jane@example.com" />
          {errors.email && <small>{errors.email}</small>}
        </label>
      </div>

      {status === 'error' && <p className="form-error" role="alert">{message}</p>}

      <div className="contact-actions">
        <button type="button" className="btn-ghost" onClick={onDismiss}>No thanks</button>
        <button type="submit" className="btn-primary" disabled={status === 'sending'}>
          {status === 'sending' ? <><span className="spinner" /> Sending…</> : 'Send to guest services'}
        </button>
      </div>
    </form>
  );
}
