'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/auth-context';
import type { Job, JobStatus } from '@/lib/types';

const TABS: { key: JobStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'PENDING_REVIEW', label: 'Pending review' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PAUSED', label: 'Paused' },
  { key: 'CLOSED', label: 'Closed' },
];

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: 'badge-blue',
  PENDING_REVIEW: 'badge-yellow',
  DRAFT: 'badge-grey',
  REJECTED: 'bg-red-50 text-danger',
  PAUSED: 'badge-grey',
  CLOSED: 'badge-grey',
};

export default function ManageJobsPage() {
  const api = useApi();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tab, setTab] = useState<JobStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api<Job[]>('/jobs/mine').then(setJobs).finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(id: string, action: 'publish' | 'pause' | 'resume' | 'close') {
    setBusyId(id);
    try {
      await api(`/jobs/${id}/${action}`, { method: 'POST' });
      load();
    } finally {
      setBusyId(null);
    }
  }

  const filtered = tab === 'ALL' ? jobs : jobs.filter((j) => j.status === tab);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Manage Jobs</h1>
        <Link href="/company/post-job" className="btn-primary bg-accent text-ink hover:bg-accent-pressed">+ Post a Job</Link>
      </div>

      <div className="flex gap-6 border-b border-border mb-4 text-sm font-medium text-muted overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-3 whitespace-nowrap ${tab === t.key ? 'text-primary font-semibold border-b-2 border-primary' : ''}`}
          >
            {t.label} {t.key !== 'ALL' && `(${jobs.filter((j) => j.status === t.key).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No jobs in this view.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-white text-left">
                <th className="px-4 py-2.5 text-xs font-semibold tracking-wide">JOB</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide">STATUS</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide">APPLICANTS</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide">VIEWS</th>
                <th className="px-4 py-2.5 text-xs font-semibold tracking-wide">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((j, i) => (
                <tr key={j.id} className={i % 2 ? 'bg-ground' : ''}>
                  <td className="px-4 py-3 font-medium">
                    {j.title}
                    <div className="text-xs text-muted font-normal">{j.location}</div>
                  </td>
                  <td className="px-3 py-3"><span className={`badge ${STATUS_STYLE[j.status]}`}>{j.status.replace('_', ' ')}</span></td>
                  <td className="px-3 py-3 font-semibold">{j.applicationsCount}</td>
                  <td className="px-3 py-3">{j.viewsCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {j.status === 'PUBLISHED' && (
                        <Link href={`/company/pipeline?jobId=${j.id}`} className="text-primary font-semibold">View pipeline</Link>
                      )}
                      {(j.status === 'DRAFT' || j.status === 'REJECTED') && (
                        <button disabled={busyId === j.id} onClick={() => act(j.id, 'publish')} className="text-primary font-semibold">
                          Submit for review
                        </button>
                      )}
                      {j.status === 'PUBLISHED' && (
                        <button disabled={busyId === j.id} onClick={() => act(j.id, 'pause')} className="text-muted">Pause</button>
                      )}
                      {j.status === 'PAUSED' && (
                        <button disabled={busyId === j.id} onClick={() => act(j.id, 'resume')} className="text-primary font-semibold">Resume</button>
                      )}
                      {(j.status === 'PUBLISHED' || j.status === 'PAUSED') && (
                        <button disabled={busyId === j.id} onClick={() => act(j.id, 'close')} className="text-danger">Close</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
