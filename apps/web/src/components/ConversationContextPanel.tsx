'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import type { Application, Conversation } from '@/lib/types';

const STAGE_LABEL: Record<string, string> = {
  APPLIED: 'Applied',
  IN_REVIEW: 'In Review',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

// The right-rail panel next to an open thread — job/stage context plus
// quick actions, including block+report. Fetches the Application tied to
// this conversation's (job, seeker) pair once, since neither role/endpoint
// exposes it directly on the Conversation itself.
export default function ConversationContextPanel({
  conversation,
  role,
  onBlocked,
}: {
  conversation: Conversation;
  role: 'JOB_SEEKER' | 'COMPANY';
  onBlocked: () => void;
}) {
  const api = useApi();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setApplication(null);
    const path = role === 'JOB_SEEKER' ? '/applications' : `/applications?jobId=${conversation.jobId}`;
    api<Application[]>(path)
      .then((list) => {
        const match = role === 'JOB_SEEKER'
          ? list.find((a) => a.jobId === conversation.jobId)
          : list.find((a) => a.seekerId === conversation.seekerId);
        setApplication(match || null);
      })
      .catch(() => undefined);
  }, [conversation.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitReport() {
    if (reason.trim().length < 3) {
      setError('Say a little more about why you\'re reporting this');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/conversations/${conversation.id}/block`, { method: 'POST', body: { reason: reason.trim() } });
      onBlocked();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const applicationHref = role === 'JOB_SEEKER' ? '/dashboard/applications' : `/company/pipeline?jobId=${conversation.jobId}`;
  const videoSent = !!conversation.seeker.seekerProfile?.videoResumeUrl;

  return (
    <div className="w-full lg:w-[280px] flex-none border-l border-border bg-white p-4 overflow-y-auto hidden lg:block">
      <div className="text-[10px] font-bold tracking-widest text-muted mb-3">THIS CONVERSATION</div>

      <div className="card p-4 mb-3">
        <div className="font-semibold text-sm">{conversation.job.title}</div>
        <div className="text-xs text-muted mt-0.5">{conversation.company.name}</div>
        {application && (
          <span className="badge badge-blue mt-2 w-fit">
            {STAGE_LABEL[application.stage] || application.stage} · applied {new Date(application.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {application && (
        <div className="card p-4 mb-3 flex flex-col gap-1.5 text-sm">
          {application.matchScore != null && (
            <div className="flex items-center justify-between">
              <span className="text-muted">Match score</span>
              <span className="font-semibold text-primary">{application.matchScore}%</span>
            </div>
          )}
          {application.assessmentScore != null && (
            <div className="flex items-center justify-between">
              <span className="text-muted">Assessment</span>
              <span className={`font-semibold ${application.assessmentPassed ? 'text-success' : 'text-danger'}`}>
                {application.assessmentScore}% {application.assessmentPassed ? '· passed' : '· failed'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted">Video resume</span>
            <span className={`font-semibold ${videoSent ? 'text-success' : 'text-muted'}`}>{videoSent ? '✓ sent' : '—'}</span>
          </div>
        </div>
      )}

      <div className="text-[10px] font-bold tracking-widest text-muted mb-2 mt-4">QUICK ACTIONS</div>
      <div className="flex flex-col gap-2">
        <Link href={`/jobs/${conversation.job.slug}`} className="btn-secondary h-9 text-sm w-full">View job posting</Link>
        <button className="btn-secondary h-9 text-sm w-full" onClick={() => router.push(applicationHref)}>Open my application</button>
        {!reporting ? (
          <button className="text-danger text-sm font-semibold mt-2" onClick={() => setReporting(true)}>Block &amp; report</button>
        ) : (
          <div className="bg-ground rounded p-3 mt-2 flex flex-col gap-2">
            <label className="label mb-0">Why are you reporting this conversation?</label>
            <textarea className="input h-16 bg-white" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Briefly explain…" />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <button className="btn-secondary h-8 text-xs flex-1" onClick={() => { setReporting(false); setError(null); }} disabled={busy}>Cancel</button>
              <button className="btn-primary h-8 text-xs flex-1" onClick={submitReport} disabled={busy}>{busy ? 'Sending…' : 'Block & report'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
