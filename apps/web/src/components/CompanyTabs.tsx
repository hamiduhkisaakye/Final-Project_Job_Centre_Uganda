'use client';

import { useState } from 'react';
import Link from 'next/link';
import CompanyLogo from './CompanyLogo';
import CompanyReviews from './CompanyReviews';
import type { Company, CompanyReview, Job } from '@/lib/types';

const OVERVIEW_JOB_PREVIEW = 3;

function JobRow({ company, job }: { company: Company; job: Job }) {
  return (
    <Link
      href={`/jobs/${job.slug}`}
      className="card p-5 flex items-center gap-4 hover:border-primary hover:shadow-2 transition-all"
    >
      <CompanyLogo company={company} size={44} className="flex-none" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{job.title}</div>
        <div className="text-sm text-muted truncate">
          {job.location} · {job.employmentType.replace('_', '-').toLowerCase()}
          {job.salaryVerifiedAt && <span className="text-success font-semibold"> · ✓ Verified</span>}
        </div>
      </div>
      <span className="btn-secondary h-9 px-4 flex-none">View</span>
    </Link>
  );
}

export default function CompanyTabs({ company, jobs, initialReviews }: { company: Company; jobs: Job[]; initialReviews: CompanyReview[] }) {
  const [tab, setTab] = useState<'overview' | 'jobs' | 'reviews'>('overview');

  const tabs: { key: typeof tab; label: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'jobs', label: <>Open Jobs {jobs.length > 0 && <span className="badge badge-yellow ml-1">{jobs.length}</span>}</> },
    { key: 'reviews', label: <>Reviews {company.avgRating != null && <span className="text-accent-pressed font-semibold ml-1">{company.avgRating.toFixed(1)} ★</span>}</> },
  ];

  return (
    <div>
      <div className="flex items-center gap-6 border-b border-border mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <h2 className="text-xl font-semibold text-primary mb-2.5">About {company.name}</h2>
          <p className="leading-relaxed mb-8 max-w-[740px]">{company.about}</p>

          <div className="flex items-baseline justify-between mb-3.5 max-w-[760px]">
            <h2 className="text-xl font-semibold text-primary">Open jobs ({jobs.length})</h2>
            {jobs.length > OVERVIEW_JOB_PREVIEW && (
              <button onClick={() => setTab('jobs')} className="text-primary font-semibold text-sm hover:text-primary-pressed transition-colors">
                View all {jobs.length} jobs →
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3 max-w-[760px]">
            {jobs.length === 0 && <p className="text-sm text-muted">No open roles right now.</p>}
            {jobs.slice(0, OVERVIEW_JOB_PREVIEW).map((job) => (
              <JobRow key={job.id} company={company} job={job} />
            ))}
          </div>
        </div>
      )}

      {tab === 'jobs' && (
        <div className="flex flex-col gap-3 max-w-[760px]">
          {jobs.length === 0 && <p className="text-sm text-muted">No open roles right now.</p>}
          {jobs.map((job) => (
            <JobRow key={job.id} company={company} job={job} />
          ))}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="max-w-[760px]">
          <CompanyReviews company={company} initialReviews={initialReviews} />
        </div>
      )}
    </div>
  );
}
