'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useApi } from '@/lib/auth-context';
import { downloadFile } from '@/lib/api';
import CompanyLogo from '@/components/CompanyLogo';
import type { Interview } from '@/lib/types';

const STATUS_BADGE: Record<Interview['status'], string> = {
  SCHEDULED: 'badge-blue',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-grey',
};

export default function InterviewsPage() {
  const { accessToken } = useAuth();
  const api = useApi();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Interview[]>('/me/interviews').then(setInterviews).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...interviews].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  const upcoming = sorted.filter((i) => i.status === 'SCHEDULED' && new Date(i.scheduledAt) > new Date());
  const past = sorted.filter((i) => !upcoming.includes(i));

  function Row({ i }: { i: Interview }) {
    const job = i.application?.job;
    return (
      <div className="card p-5 flex items-center gap-4 hover:shadow-2 transition-shadow">
        <CompanyLogo company={{ name: job?.company?.name || '', logoUrl: job?.company?.logoUrl }} size={44} className="flex-none" />
        <div className="flex-1 min-w-0">
          <Link href={job?.slug ? `/jobs/${job.slug}` : '#'} className="font-semibold hover:text-primary transition-colors truncate block">
            {job?.title}
          </Link>
          <div className="text-sm text-muted truncate">
            {job?.company?.name} · {new Date(i.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {i.mode.replace('_', ' ').toLowerCase()}
            {i.durationMinutes ? ` · ${i.durationMinutes} min` : ''}
          </div>
          {i.location && <div className="text-xs text-muted truncate mt-0.5">📍 {i.location}</div>}
        </div>
        <div className="flex items-center gap-2.5 flex-none">
          <span className={`badge ${STATUS_BADGE[i.status]}`}>{i.status}</span>
          {i.status === 'SCHEDULED' && (
            <button
              className="btn-secondary h-9 text-xs"
              onClick={() => downloadFile(`/interviews/${i.id}/ics`, accessToken, 'interview.ics')}
            >
              Add to calendar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Interviews</h1>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : interviews.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No interviews scheduled yet.</div>
      ) : (
        <div className="flex flex-col gap-6 max-w-[760px]">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-bold tracking-wide text-muted mb-3">UPCOMING</h2>
              <div className="flex flex-col gap-3">
                {upcoming.map((i) => <Row key={i.id} i={i} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-bold tracking-wide text-muted mb-3">PAST</h2>
              <div className="flex flex-col gap-3">
                {past.map((i) => <Row key={i.id} i={i} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
