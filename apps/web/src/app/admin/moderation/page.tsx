'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/auth-context';
import type { Job } from '@/lib/types';

interface ModerationEntry {
  id: string;
  entityType: 'JOB' | 'COMPANY';
  autoFlags: string[];
  createdAt: string;
  job?: Job;
}

export default function ModerationPage() {
  const api = useApi();
  const [queue, setQueue] = useState<ModerationEntry[]>([]);
  const [selected, setSelected] = useState<ModerationEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  function load() {
    setLoading(true);
    api<ModerationEntry[]>('/admin/moderation?decision=PENDING').then((data) => {
      setQueue(data);
      setSelected((prev) => data.find((d) => d.id === prev?.id) || data[0] || null);
    }).finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(decision: 'APPROVED' | 'REJECTED' | 'ESCALATED') {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/admin/moderation/${selected.id}`, { method: 'PATCH', body: { decision, note: note || undefined } });
      setNote('');
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold">Job Queue</h1>
        <span className="badge badge-yellow">{queue.length} PENDING</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : queue.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">All clear — nothing pending review.</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-5 items-start">
          <div className="w-full md:w-[360px] flex-none flex flex-col gap-2.5">
            {queue.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelected(entry)}
                className={`card p-3.5 text-left ${selected?.id === entry.id ? 'border-2 border-primary shadow-2' : ''}`}
              >
                <div className="font-semibold text-sm">{entry.job?.title}</div>
                <div className="text-xs text-muted mb-1.5">{entry.job?.company?.name} · {entry.job?.location}</div>
                {entry.autoFlags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.autoFlags.map((f) => (
                      <span key={f} className="bg-red-50 text-danger text-[10px] font-semibold px-1.5 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 card p-6">
              <div className="text-[11px] font-bold tracking-wide text-primary mb-2">REVIEW</div>
              <h2 className="text-2xl font-bold mb-1">{selected.job?.title}</h2>
              <div className="text-sm text-muted mb-4">
                {selected.job?.company?.name} · {selected.job?.location} · {selected.job?.employmentType.replace('_', '-').toLowerCase()}
              </div>

              {selected.autoFlags?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3.5 mb-4">
                  <div className="text-[11px] font-bold tracking-wide text-danger mb-1.5">AUTOMATED SIGNALS</div>
                  <div className="text-sm text-danger">{selected.autoFlags.join(' · ')}</div>
                </div>
              )}

              <div className="border border-border rounded p-4 text-sm leading-relaxed mb-4 whitespace-pre-line">
                {selected.job?.description}
              </div>

              <div>
                <label className="label">Note (shown in audit log, and to the employer if rejected)</label>
                <textarea className="input h-20" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              <div className="flex items-center gap-2.5 mt-5 pt-4 border-t border-ground">
                <button disabled={busy} onClick={() => decide('REJECTED')} className="btn-danger">Reject</button>
                <button disabled={busy} onClick={() => decide('ESCALATED')} className="btn-secondary">Escalate</button>
                <button disabled={busy} onClick={() => decide('APPROVED')} className="btn-primary ml-auto">Approve</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
