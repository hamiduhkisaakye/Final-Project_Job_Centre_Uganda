'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark } from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { useAuth } from '@/lib/auth-context';
import { useSavedJobs } from '@/lib/saved-jobs-context';
import type { Job } from '@/lib/types';

function formatSalary(job: Job) {
  if (!job.salaryDisclosed || (!job.salaryMin && !job.salaryMax)) return 'Salary not disclosed';
  const fmt = (n: number) => `${job.salaryCurrency} ${(n / 1_000_000).toFixed(1)}M`;
  if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`;
  return fmt(job.salaryMin || job.salaryMax || 0);
}

function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function JobCard({
  job,
  matchScore,
  variant = 'card',
  hotHover = false,
}: {
  job: Job;
  matchScore?: number;
  variant?: 'card' | 'list';
  // Swaps the hover border from the default primary blue to the accent
  // yellow — used by the homepage's "Trending this week" (HOT) section.
  hotHover?: boolean;
}) {
  const hoverBorderClass = hotHover ? 'hover:border-accent' : 'hover:border-primary';
  const { user } = useAuth();
  const router = useRouter();
  const { isSaved, toggleSave } = useSavedJobs();
  const saved = isSaved(job.id);
  // Saving is a seeker action — matches ApplyPanel's gating for the same
  // button on the job detail page (a guest can click through to log in;
  // a company/admin account has no use for it, and the API would 403 it).
  const canSave = !user || user.role === 'JOB_SEEKER';

  function onSaveClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return router.push('/login');
    toggleSave(job.id);
  }

  const saveButton = canSave && (
    <button
      type="button"
      onClick={onSaveClick}
      aria-label={saved ? 'Remove from saved jobs' : 'Save job'}
      aria-pressed={saved}
      className={`w-8 h-8 rounded-full flex items-center justify-center flex-none transition-colors ${
        saved ? 'bg-accent/20 text-accent-pressed' : 'bg-ground text-muted hover:text-primary'
      }`}
    >
      <Bookmark className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} strokeWidth={2} />
    </button>
  );

  if (variant === 'list') {
    return (
      <Link
        href={`/jobs/${job.slug}`}
        className={`card p-4 flex items-center gap-4 hover:shadow-2 ${hoverBorderClass} transition-shadow`}
      >
        <CompanyLogo company={{ name: job.company?.name || '', logoUrl: job.company?.logoUrl }} size={48} className="flex-none" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{job.title}</span>
            {matchScore != null && <span className="badge badge-yellow flex-none">Match {matchScore}%</span>}
          </div>
          <div className="text-sm text-muted truncate">{job.company?.name} · {job.location}</div>
          {job.skills?.length > 0 && (
            <div className="hidden sm:flex gap-1.5 flex-wrap mt-1.5">
              {job.skills.slice(0, 3).map((s) => (
                <span key={s} className="badge badge-blue">{s}</span>
              ))}
            </div>
          )}
        </div>
        <div className="hidden sm:flex flex-col items-end flex-none text-right gap-1">
          <span className="font-semibold text-primary text-sm">{formatSalary(job)}</span>
          {job.salaryVerifiedAt && <span className="badge badge-green">✓ Verified</span>}
          <span className="text-xs text-muted">{timeAgo(job.publishedAt)} · {job.applicationsCount} applied</span>
        </div>
        {saveButton}
      </Link>
    );
  }

  return (
    <Link
      href={`/jobs/${job.slug}`}
      className={`card p-6 flex flex-col gap-3 hover:shadow-2 ${hoverBorderClass} transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <CompanyLogo company={{ name: job.company?.name || '', logoUrl: job.company?.logoUrl }} size={56} />
        <div className="flex items-center gap-2">
          {matchScore != null && (
            <span className="badge badge-yellow">Match {matchScore}%</span>
          )}
          {saveButton}
        </div>
      </div>
      <div>
        <div className="text-lg font-semibold leading-snug line-clamp-2">{job.title}</div>
        <div className="text-sm text-muted mt-0.5">{job.company?.name} · {job.location}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-base font-semibold text-primary">{formatSalary(job)}</span>
        {job.salaryVerifiedAt && <span className="badge badge-green">✓ Verified</span>}
      </div>
      {job.skills?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {job.skills.slice(0, 3).map((s) => (
            <span key={s} className="badge badge-blue">{s}</span>
          ))}
          {job.skills.length > 3 && <span className="badge badge-blue">+{job.skills.length - 3}</span>}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-ground pt-2.5 mt-1 text-xs text-muted">
        <span>{timeAgo(job.publishedAt)}</span>
        <span>{job.applicationsCount} applied</span>
      </div>
    </Link>
  );
}
