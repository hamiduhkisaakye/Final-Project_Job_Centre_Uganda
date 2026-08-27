'use client';

import { useState } from 'react';
import { Mail, MapPin } from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import { apiFetch, ApiError } from '@/lib/api';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      // No auth token needed — /contact is intentionally public, so the raw
      // fetch helper is used directly instead of the auth-context's useApi().
      await apiFetch('/contact', { method: 'POST', body: form });
      setSent(true);
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PublicNavbar />

      <div className="bg-ground border-b border-border">
        <div className="max-w-[1320px] mx-auto px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">Contact us</h1>
          <p className="text-muted max-w-[640px]">
            Questions about your account, a job listing, or partnering with us? Send a message and the team will get
            back to you.
          </p>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-6 py-12 flex flex-col md:flex-row gap-10 items-start">
        <div className="flex-1 w-full max-w-[560px]">
          {sent ? (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-2">✓</div>
              <div className="text-lg font-semibold mb-1">Message sent</div>
              <p className="text-sm text-muted mb-4">Thanks for reaching out — we&apos;ll be in touch soon.</p>
              <button className="btn-secondary" onClick={() => setSent(false)}>Send another message</button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="card p-6 flex flex-col gap-4">
              {error && <div className="border border-danger bg-red-50 rounded p-3 text-sm text-danger">{error}</div>}
              <div>
                <label className="label">Your name</label>
                <input
                  className="input"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Sarah Nakato"
                />
              </div>
              <div>
                <label className="label">Email address</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea
                  className="input h-36"
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="How can we help?"
                />
              </div>
              <button className="btn-primary w-fit" disabled={sending}>{sending ? 'Sending…' : 'Send message'}</button>
            </form>
          )}
        </div>

        <div className="flex-1 w-full flex flex-col gap-4">
          <div className="card p-6 flex items-start gap-4">
            <div className="w-11 h-11 rounded bg-ground flex items-center justify-center flex-none">
              <Mail className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <div className="font-semibold mb-1">Email</div>
              <p className="text-sm text-muted">hello@jobcentre.ug</p>
            </div>
          </div>
          <div className="card p-6 flex items-start gap-4">
            <div className="w-11 h-11 rounded bg-ground flex items-center justify-center flex-none">
              <MapPin className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <div className="font-semibold mb-1">Office</div>
              <p className="text-sm text-muted">Kampala, Uganda — with teams in Gulu and Mbarara.</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
