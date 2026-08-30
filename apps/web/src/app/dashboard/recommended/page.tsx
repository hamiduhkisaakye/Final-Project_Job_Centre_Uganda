'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/auth-context';
import JobCard from '@/components/JobCard';
import type { Job } from '@/lib/types';

export default function RecommendedJobsPage() {
  const api = useApi();
  const [recs, setRecs] = useState<{ job: Job; score: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ job: Job; score: number }[]>('/me/recommendations?limit=50').then(setRecs).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5">
        <h1 className="text-2xl font-bold">Recommended for you</h1>
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
  );
}
