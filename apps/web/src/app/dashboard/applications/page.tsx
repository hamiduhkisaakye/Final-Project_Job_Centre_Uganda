'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/auth-context';
import CompanyLogo from '@/components/CompanyLogo';
import type { Application, ApplicationStage, Conversation, Interview } from '@/lib/types';

// Blueprint §8.3: the seeker board is read-only for stage (stage is
// recruiter-owned) — a card can only be withdrawn, never dragged between
// columns. We surface that as an explicit "Withdraw" action per card
// rather than a drag-to-a-dropzone gesture, which gets to the same place
// with far less client-side complexity while keeping stage fully
// server-authoritative.
const COLUMNS: { stage: ApplicationStage; label: string; accent: string }[] = [
  { stage: 'APPLIED', label: 'Applied', accent: 'border-t-primary' },
  { stage: 'IN_REVIEW', label: 'In Review', accent: 'border-t-primary' },
  { stage: 'INTERVIEW', label: 'Interview', accent: 'border-t-accent' },
  { stage: 'HIRED', label: 'Hired', accent: 'border-t-success' },
];

export default function ApplicationsBoardPage() {
  const api = useApi();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);

  const interviewsByApp = interviews.reduce<Record<string, Interview>>((acc, i) => {
    if (i.status === 'SCHEDULED') acc[i.applicationId] = i;
    return acc;
  }, {});

  async function messageRecruiter(a: Application) {
    const companyId = a.job?.company?.id;
    if (!companyId) return;
    setMessagingId(a.id);
    try {
      const conversation = await api<Conversation>('/me/conversations', {
        method: 'POST',
        body: { companyId, jobId: a.jobId },
      });
      router.push(`/dashboard/messages?c=${conversation.id}`);
    } finally {
      setMessagingId(null);
    }
  }

  function load() {
    setLoading(true);
    api<Application[]>('/applications').then(setApplications).finally(() => setLoading(false));
    api<Interview[]>('/me/interviews').then(setInterviews).catch(() => undefined);
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function withdraw(id: string) {
    if (!confirm('Withdraw this application? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await api(`/applications/${id}/withdraw`, { method: 'PATCH' });
      load();
    } finally {
      setBusyId(null);
    }
  }

  const closed = applications.filter((a) => a.stage === 'REJECTED' || a.stage === 'WITHDRAWN' || a.stage === 'OFFER');

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold">My Applications</h1>
        <span className="text-sm text-muted">{applications.length} total</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const items = applications.filter((a) => a.stage === col.stage);
            return (
              <div key={col.stage} className={`flex-1 min-w-[260px] bg-ground rounded border-t-[3px] ${col.accent} p-3`}>
                <div className="flex items-center gap-2 mb-2.5 px-0.5">
                  <span className="text-[11px] font-bold tracking-wide text-ink/70">{col.label.toUpperCase()}</span>
                  <span className="bg-white text-primary text-[11px] font-bold px-1.5 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {items.map((a) => (
                    <div key={a.id} className="card p-3.5">
                      <div className="flex gap-2.5 mb-2">
                        <CompanyLogo company={{ name: a.job?.company?.name || '', logoUrl: a.job?.company?.logoUrl }} size={32} className="text-xs flex-none" />
                        <div className="text-sm font-semibold leading-snug">{a.job?.title}</div>
                      </div>
                      <div className="text-xs text-muted mb-2">{a.job?.company?.name} · {a.job?.location}</div>
                      {interviewsByApp[a.id] && (
                        <div className="bg-accent/15 text-ink text-[11px] font-semibold px-2 py-1 rounded mb-2">
                          📅 {new Date(interviewsByApp[a.id].scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <span className="bg-ground text-ink/70 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                          Match {a.matchScore ?? '—'}%
                        </span>
                        {col.stage !== 'HIRED' && (
                          <button
                            onClick={() => withdraw(a.id)}
                            disabled={busyId === a.id}
                            className="text-[11px] text-danger font-semibold"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => messageRecruiter(a)}
                        disabled={messagingId === a.id}
                        className="text-[11px] text-primary font-semibold"
                      >
                        💬 Message recruiter
                      </button>
                    </div>
                  ))}
                  {items.length === 0 && <div className="text-xs text-muted/70 text-center py-6">No applications here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {closed.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold tracking-wide text-muted mb-2.5">CLOSED / OFFERS</h2>
          <div className="flex flex-col gap-2 max-w-[640px]">
            {closed.map((a) => (
              <div key={a.id} className="card p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{a.job?.title}</div>
                  <div className="text-xs text-muted">{a.job?.company?.name}</div>
                </div>
                <span className={`badge ${a.stage === 'OFFER' ? 'badge-yellow' : 'badge-grey'}`}>{a.stage}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
