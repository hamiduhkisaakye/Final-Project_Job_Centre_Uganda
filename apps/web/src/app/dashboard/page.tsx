'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useApi } from '@/lib/auth-context';
import { downloadFile } from '@/lib/api';
import JobCard from '@/components/JobCard';
import type { Application, Interview, Job } from '@/lib/types';

export default function SeekerDashboardPage() {
  const { user, accessToken } = useAuth();
  const api = useApi();
  const [recs, setRecs] = useState<{ job: Job; score: number }[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<{ job: Job; score: number }[]>('/me/recommendations?limit=6'),
      api<Application[]>('/applications'),
      api<Interview[]>('/me/interviews'),
    ])
      .then(([r, a, i]) => {
        setRecs(r);
        setApplications(a);
        setInterviews(i);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upcomingInterviews = interviews
    .filter((i) => i.status === 'SCHEDULED' && i.scheduledAt && new Date(i.scheduledAt) > new Date())
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 3);

  const strength = user?.seekerProfile?.profileStrength ?? 0;
  const stageCount = (stage: string) => applications.filter((a) => a.stage === stage).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Good to see you, {user?.seekerProfile?.headline || 'there'}</h1>
          <p className="text-sm text-muted">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {recs.length} new matches
          </p>
        </div>
        <Link href="/dashboard/profile" className="btn-secondary">Update profile</Link>
      </div>

      <div className="card p-6 border-l-4 border-accent flex flex-col md:flex-row gap-6 items-center">
        <div
          className="w-[120px] h-[120px] rounded-full flex-none flex items-center justify-center"
          style={{ background: `conic-gradient(#FFC107 0 ${strength}%, #EAF2FA ${strength}% 100%)` }}
        >
          <div className="w-[94px] h-[94px] rounded-full bg-white flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-primary">{strength}%</span>
            <span className="text-[10px] tracking-wide text-muted">STRENGTH</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold mb-1">Your resume strength</div>
          <p className="text-sm text-muted mb-3">Profiles above 80% get 3× more recruiter views.</p>
          <Link href="/dashboard/profile" className="text-sm font-semibold text-primary">Complete your profile →</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {[
          { label: 'Applications', value: applications.length },
          { label: 'In review', value: stageCount('IN_REVIEW') },
          { label: 'Interviews', value: stageCount('INTERVIEW') },
          { label: 'Hired', value: stageCount('HIRED') },
        ].map((t) => (
          <div key={t.label} className="card p-4">
            <div className="text-[11px] font-bold tracking-wide text-muted">{t.label.toUpperCase()}</div>
            <div className="text-2xl font-bold text-primary mt-1">{t.value}</div>
          </div>
        ))}
      </div>

      {upcomingInterviews.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-bold tracking-wide text-muted mb-3">UPCOMING INTERVIEWS</h2>
          <div className="flex flex-col gap-2.5">
            {upcomingInterviews.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 bg-ground rounded p-3">
                <div>
                  <div className="text-sm font-semibold">{i.application?.job.title}</div>
                  <div className="text-xs text-muted">
                    {i.application?.job.company?.name} · {new Date(i.scheduledAt!).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {i.mode.replace('_', ' ').toLowerCase()}
                  </div>
                </div>
                <button
                  className="btn-secondary h-9 text-xs flex-none"
                  onClick={() => downloadFile(`/interviews/${i.id}/ics`, accessToken, 'interview.ics')}
                >
                  Add to calendar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2.5 mb-3.5">
          <h2 className="text-lg font-semibold">Recommended for you</h2>
          <span className="badge badge-yellow">AI MATCHED</span>
        </div>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : recs.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            Add skills and a location to your profile to unlock personalised matches.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recs.map((r) => (
              <JobCard key={r.job.id} job={r.job} matchScore={r.score} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
