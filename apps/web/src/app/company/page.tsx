'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useApi } from '@/lib/auth-context';
import { downloadFile } from '@/lib/api';
import TrendChart from '@/components/charts/TrendChart';
import StageBarChart from '@/components/charts/StageBarChart';
import type { ApplicationStage, Interview, Job } from '@/lib/types';

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: 'badge-blue',
  PENDING_REVIEW: 'badge-yellow',
  DRAFT: 'badge-grey',
  REJECTED: 'bg-red-50 text-danger',
  PAUSED: 'badge-grey',
  CLOSED: 'badge-grey',
};

// Ordinal ramp (one hue, increasing darkness) for the in-progress stages,
// then the app's actual status colors for the two terminal outcomes — see
// the dataviz-skill note in StageBarChart.tsx.
const FUNNEL_STAGES: { stage: ApplicationStage; label: string; color: string }[] = [
  { stage: 'APPLIED', label: 'Applied', color: '#6da7ec' },
  { stage: 'IN_REVIEW', label: 'In Review', color: '#3987e5' },
  { stage: 'INTERVIEW', label: 'Interview', color: '#2a78d6' },
  { stage: 'OFFER', label: 'Offer', color: '#256abf' },
  { stage: 'HIRED', label: 'Hired', color: '#1E8E5A' },
  { stage: 'REJECTED', label: 'Rejected', color: '#C0392B' },
];

interface CompanyAnalytics {
  applicationsOverTime: { date: string; count: number }[];
  funnel: { stage: ApplicationStage; count: number }[];
  topJobs: { id: string; title: string; viewsCount: number; applicationsCount: number }[];
}

export default function CompanyDashboardPage() {
  const { accessToken } = useAuth();
  const api = useApi();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [analytics, setAnalytics] = useState<CompanyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Job[]>('/jobs/mine').then(setJobs).finally(() => setLoading(false));
    api<Interview[]>('/me/interviews').then(setInterviews).catch(() => undefined);
    api<CompanyAnalytics>('/company/analytics').then(setAnalytics).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const published = jobs.filter((j) => j.status === 'PUBLISHED');
  const totalViews = jobs.reduce((s, j) => s + j.viewsCount, 0);
  const totalApplications = jobs.reduce((s, j) => s + j.applicationsCount, 0);
  const conversion = totalViews > 0 ? ((totalApplications / totalViews) * 100).toFixed(1) : '0.0';
  const upcomingInterviews = interviews
    .filter((i) => i.status === 'SCHEDULED' && i.scheduledAt && new Date(i.scheduledAt) > new Date())
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 3);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        {[
          { label: 'Live jobs', value: published.length },
          { label: 'Job views', value: totalViews.toLocaleString() },
          { label: 'Applications', value: totalApplications.toLocaleString() },
          { label: 'Conversion', value: `${conversion}%` },
        ].map((t) => (
          <div key={t.label} className="card p-4">
            <div className="text-[11px] font-bold tracking-wide text-muted">{t.label.toUpperCase()}</div>
            <div className="text-2xl font-bold text-primary mt-1">{t.value}</div>
          </div>
        ))}
      </div>

      {upcomingInterviews.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-bold tracking-wide text-muted mb-3">UPCOMING INTERVIEWS</h2>
          <div className="flex flex-col gap-2.5">
            {upcomingInterviews.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 bg-ground rounded p-3">
                <div>
                  <div className="text-sm font-semibold">
                    {i.application?.seeker?.seekerProfile?.fullName || i.application?.seeker?.email} · {i.application?.job.title}
                  </div>
                  <div className="text-xs text-muted">
                    {new Date(i.scheduledAt!).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {i.mode.replace('_', ' ').toLowerCase()}
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

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ground">
          <span className="font-semibold">Your jobs</span>
          <Link href="/company/manage-jobs" className="text-sm font-semibold text-primary">Manage all jobs →</Link>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-muted">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            No jobs yet. <Link href="/company/post-job" className="text-primary font-semibold">Post your first role →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary text-white text-left">
                  <th className="px-4 py-2.5 font-semibold text-xs tracking-wide whitespace-nowrap">JOB</th>
                  <th className="px-3 py-2.5 font-semibold text-xs tracking-wide whitespace-nowrap">STATUS</th>
                  <th className="px-3 py-2.5 font-semibold text-xs tracking-wide whitespace-nowrap">VIEWS</th>
                  <th className="px-3 py-2.5 font-semibold text-xs tracking-wide whitespace-nowrap">APPLICANTS</th>
                </tr>
              </thead>
              <tbody>
                {jobs.slice(0, 8).map((j, i) => (
                  <tr key={j.id} className={i % 2 ? 'bg-ground' : ''}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {j.title}
                      <div className="text-xs text-muted font-normal">{j.location}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap"><span className={`badge ${STATUS_STYLE[j.status]}`}>{j.status.replace('_', ' ')}</span></td>
                    <td className="px-3 py-3">{j.viewsCount}</td>
                    <td className="px-3 py-3 font-semibold">{j.applicationsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          <div className="card p-5">
            <h2 className="text-sm font-bold tracking-wide text-muted mb-3">APPLICATIONS, LAST 30 DAYS</h2>
            <TrendChart data={analytics.applicationsOverTime} series={[{ key: 'count', label: 'Applications', color: '#1E5FBF' }]} />
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-bold tracking-wide text-muted mb-3">HIRING FUNNEL</h2>
            <StageBarChart
              data={FUNNEL_STAGES.map((s) => ({
                label: s.label,
                count: analytics.funnel.find((f) => f.stage === s.stage)?.count ?? 0,
                color: s.color,
              }))}
            />
          </div>
          <div className="card p-5 lg:col-span-2">
            <h2 className="text-sm font-bold tracking-wide text-muted mb-3">TOP JOBS BY VIEWS</h2>
            {analytics.topJobs.length === 0 ? (
              <p className="text-sm text-muted">No published jobs yet.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {analytics.topJobs.map((j) => (
                  <div key={j.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0 text-sm font-medium truncate">{j.title}</div>
                    <div className="flex-1 max-w-[240px] h-2 rounded-full bg-ground overflow-hidden">
                      <div
                        className="h-2 bg-primary rounded-full"
                        style={{ width: `${analytics.topJobs[0].viewsCount ? (j.viewsCount / analytics.topJobs[0].viewsCount) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted w-[110px] text-right flex-none">{j.viewsCount} views · {j.applicationsCount} applied</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
