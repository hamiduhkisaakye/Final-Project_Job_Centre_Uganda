'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/auth-context';
import { seekerDisplayName } from '@/lib/format';
import type { ConversationReport } from '@/lib/types';

export default function AdminReportsPage() {
  const api = useApi();
  const [reports, setReports] = useState<ConversationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api<ConversationReport[]>(`/admin/reports?status=${filter}`).then(setReports).finally(() => setLoading(false));
  }
  useEffect(load, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function resolve(id: string) {
    setBusyId(id);
    try {
      await api(`/admin/reports/${id}/resolve`, { method: 'PATCH' });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex items-center border border-border rounded overflow-hidden">
          {(['OPEN', 'RESOLVED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-9 px-3.5 text-sm font-semibold transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-white text-muted hover:text-ink'}`}
            >
              {f === 'OPEN' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : reports.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No {filter === 'OPEN' ? 'open' : 'resolved'} reports.</div>
      ) : (
        <div className="flex flex-col gap-3 max-w-[820px]">
          {reports.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="font-semibold">{r.conversation.job.title} · {r.conversation.company.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    Reported by {r.reporter.role === 'JOB_SEEKER' ? seekerDisplayName(r.conversation.seeker) : r.conversation.company.name} ({r.reporter.email}) · {new Date(r.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </div>
                </div>
                <span className={`badge ${r.status === 'OPEN' ? 'badge-yellow' : 'badge-green'} flex-none`}>{r.status}</span>
              </div>
              <p className="text-sm leading-relaxed bg-ground rounded p-3">{r.reason}</p>
              {r.status === 'OPEN' && (
                <button className="btn-secondary h-9 text-sm mt-3" disabled={busyId === r.id} onClick={() => resolve(r.id)}>
                  {busyId === r.id ? 'Resolving…' : 'Mark resolved'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
