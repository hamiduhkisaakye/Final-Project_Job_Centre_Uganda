'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/auth-context';
import type { ContactMessage } from '@/lib/types';

export default function AdminContactMessagesPage() {
  const api = useApi();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContactMessage | null>(null);

  function load() {
    setLoading(true);
    api<ContactMessage[]>('/admin/contact-messages')
      .then((data) => {
        setMessages(data);
        setSelected((prev) => data.find((m) => m.id === prev?.id) || data[0] || null);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function select(m: ContactMessage) {
    setSelected(m);
    if (!m.readAt) {
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, readAt: new Date().toISOString() } : x)));
      await api(`/admin/contact-messages/${m.id}/read`, { method: 'PATCH' }).catch(() => undefined);
    }
  }

  const unreadCount = messages.filter((m) => !m.readAt).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold">Contact Messages</h1>
        {unreadCount > 0 && <span className="badge badge-yellow">{unreadCount} UNREAD</span>}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : messages.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No messages yet.</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-5 items-start">
          <div className="w-full md:w-[360px] flex-none flex flex-col gap-2.5">
            {messages.map((m) => (
              <button
                key={m.id}
                onClick={() => select(m)}
                className={`card p-3.5 text-left transition-colors ${selected?.id === m.id ? 'border-2 border-primary shadow-2' : ''} ${!m.readAt ? 'bg-ground/60' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {!m.readAt && <span className="w-2 h-2 rounded-full bg-primary flex-none" />}
                  <span className="font-semibold text-sm truncate">{m.name}</span>
                </div>
                <div className="text-xs text-muted mb-1.5 truncate">{m.email}</div>
                <div className="text-xs text-muted line-clamp-2">{m.message}</div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 card p-6 w-full">
              <div className="text-[11px] font-bold tracking-wide text-primary mb-2">MESSAGE</div>
              <h2 className="text-xl font-bold mb-1">{selected.name}</h2>
              <div className="text-sm text-muted mb-1">{selected.email}</div>
              <div className="text-xs text-muted mb-4">
                {new Date(selected.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
              <div className="border border-border rounded p-4 text-sm leading-relaxed whitespace-pre-line">
                {selected.message}
              </div>
              <a href={`mailto:${selected.email}`} className="btn-primary mt-5 inline-flex">Reply by email</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
