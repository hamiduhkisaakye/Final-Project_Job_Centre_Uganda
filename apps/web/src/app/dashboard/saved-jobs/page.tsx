'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/auth-context';
import { useSavedJobs } from '@/lib/saved-jobs-context';
import CompanyLogo from '@/components/CompanyLogo';
import type { Job } from '@/lib/types';

interface SavedJob {
  jobId: string;
  folder: string;
  job: Job;
}

export default function SavedJobsPage() {
  const api = useApi();
  // Removal goes through the shared context (not a direct DELETE call) so
  // the bookmark icon on JobCard elsewhere in the app updates immediately
  // instead of only reflecting the change after a full reload.
  const { toggleSave } = useSavedJobs();
  const [items, setItems] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api<SavedJob[]>('/saved-jobs').then(setItems).finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(jobId: string) {
    await toggleSave(jobId);
    setItems((prev) => prev.filter((s) => s.jobId !== jobId));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold">Saved Jobs</h1>
        <span className="text-sm text-muted">{items.length} saved</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          Nothing saved yet. <Link href="/jobs" className="text-primary font-semibold">Browse jobs →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map((s) => {
            const closed = s.job.status !== 'PUBLISHED';
            return (
              <div key={s.jobId} className={`card p-6 flex flex-col gap-3 ${closed ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between">
                  <CompanyLogo company={{ name: s.job.company?.name || '', logoUrl: s.job.company?.logoUrl }} size={48} />
                  <span className="badge badge-grey flex-none">{s.folder}</span>
                </div>
                <div>
                  <div className="font-semibold leading-snug line-clamp-2">{s.job.title}</div>
                  <div className="text-sm text-muted mt-0.5 truncate">{s.job.company?.name} · {s.job.location}</div>
                </div>
                {closed && (
                  <div className="bg-ground text-muted text-xs font-semibold px-2.5 py-1.5 rounded w-fit">This job has closed</div>
                )}
                <div className="flex items-center gap-2 border-t border-ground pt-3 mt-auto">
                  <Link href={`/jobs/${s.job.slug}`} className="btn-secondary flex-1 h-9 text-sm">View job</Link>
                  <button onClick={() => remove(s.jobId)} className="inline-flex items-center h-9 px-2 text-danger text-sm">Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
