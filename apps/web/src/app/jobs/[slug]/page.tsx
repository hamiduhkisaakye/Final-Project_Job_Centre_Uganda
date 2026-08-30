import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock } from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import ApplyPanel from '@/components/ApplyPanel';
import CompanyLogo from '@/components/CompanyLogo';
import { publicFetch, API_ORIGIN } from '@/lib/api';
import type { BlogPost, Job } from '@/lib/types';

function formatSalary(job: Job) {
  if (!job.salaryDisclosed || (!job.salaryMin && !job.salaryMax)) return 'Salary not disclosed';
  const fmt = (n: number) => `${job.salaryCurrency} ${n.toLocaleString()}`;
  return `${fmt(job.salaryMin || 0)} – ${fmt(job.salaryMax || 0)} / ${job.salaryPeriod}`;
}

function postTeaser(post: BlogPost) {
  if (post.excerpt) return post.excerpt;
  const text = post.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

function timeAgo(iso?: string | null) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  return `Posted ${days} days ago`;
}

function daysUntil(iso?: string | null) {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return days > 0 ? days : null;
}

// No stored duration on Assessment — approximated from question count
// (~1.5 min/question, floor of 5) rather than adding a field a company
// would have to keep in sync by hand.
function estimatedMinutes(questionCount: number) {
  return Math.max(5, Math.round(questionCount * 1.5));
}

export default async function JobDetailPage({ params }: { params: { slug: string } }) {
  const [job, latestPosts] = await Promise.all([
    publicFetch<Job>(`/jobs/${params.slug}`),
    publicFetch<BlogPost[]>('/blog?take=1'),
  ]);
  if (!job) notFound();
  const latestPost = latestPosts?.[0];

  return (
    <>
      <PublicNavbar />

      <div className="bg-ground border-b border-border">
        <div className="max-w-[1320px] mx-auto px-6 py-6">
          <div className="text-xs text-muted mb-3">
            <Link href="/">Home</Link> / <Link href="/jobs">Jobs</Link> / {job.category} / <span className="text-ink">{job.title}</span>
          </div>
          <div className="card p-7 flex flex-col md:flex-row gap-6 items-start">
            <CompanyLogo company={{ name: job.company?.name || '', logoUrl: job.company?.logoUrl }} size={72} className="text-xl flex-none" />
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-1">{job.title}</h1>
              <div className="text-primary font-semibold mb-2">
                <Link href={`/companies/${job.company?.slug}`}>{job.company?.name}</Link>
                {job.company?.verificationStatus === 'VERIFIED' && (
                  <span className="text-success text-sm font-semibold ml-2">🛡 Verified employer</span>
                )}
              </div>
              <div className="flex flex-wrap gap-5 text-sm text-muted mb-3">
                <span>📍 {job.location}</span>
                <span>🕐 {job.employmentType.replace('_', '-').toLowerCase()}</span>
                {job.seniority && <span>👤 {job.seniority}</span>}
                {timeAgo(job.publishedAt) && <span>⏱ {timeAgo(job.publishedAt)}</span>}
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-semibold text-primary">{formatSalary(job)}</span>
                {job.salaryVerifiedAt && <span className="badge badge-green">✓ Verified salary</span>}
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 flex-none w-full sm:w-[220px]">
              {/* Apply now / Save job render here via a portal from ApplyPanel
                  (see components/ApplyPanel.tsx) — the actual apply flow
                  (cover letter, assessment gate, confirmation) stays in the
                  right-rail panel below rather than duplicating it here.
                  Fixing this container's width (instead of letting each
                  button hug its own text) is what makes "Apply now" and
                  "Save job" render the same, deliberately wider size. */}
              <div id="job-header-actions" className="flex flex-col gap-2" />
              {(daysUntil(job.expiresAt) != null || job.applicationsCount > 0) && (
                <span className="text-xs text-muted sm:text-right">
                  {daysUntil(job.expiresAt) != null && <>Closes in {daysUntil(job.expiresAt)} day{daysUntil(job.expiresAt) === 1 ? '' : 's'}</>}
                  {daysUntil(job.expiresAt) != null && job.applicationsCount > 0 && ' · '}
                  {job.applicationsCount > 0 && <>{job.applicationsCount} applied</>}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-6 py-8 flex flex-col md:flex-row gap-6 items-start">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-primary mb-2.5">About the role</h2>
          <p className="leading-relaxed mb-6 max-w-[720px]">{job.description}</p>

          {job.responsibilities?.length > 0 && (
            <>
              <h2 className="text-xl font-semibold text-primary mb-2.5">Responsibilities</h2>
              <ul className="mb-6 max-w-[720px] flex flex-col gap-2">
                {job.responsibilities.map((r, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-2 h-2 bg-accent mt-2 flex-none" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {job.requirements?.length > 0 && (
            <>
              <h2 className="text-xl font-semibold text-primary mb-2.5">Requirements</h2>
              <ul className="mb-6 max-w-[720px] flex flex-col gap-2">
                {job.requirements.map((r, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-2 h-2 bg-accent mt-2 flex-none" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {job.skills?.length > 0 && (
            <>
              <h2 className="text-xl font-semibold text-primary mb-3">Skills required</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {job.skills.map((s) => (
                  <span key={s} className="badge badge-blue">{s}</span>
                ))}
              </div>
            </>
          )}

          {job.assessment && (
            <div className="bg-ground rounded p-4 flex items-center gap-3.5 max-w-[720px] mb-6">
              <div className="w-11 h-11 rounded bg-accent flex items-center justify-center flex-none">
                <Clock className="w-5 h-5 text-ink" strokeWidth={1.75} />
              </div>
              <div>
                <div className="font-semibold">Includes a {estimatedMinutes(job.assessment.questionCount)}-minute skill assessment</div>
                <div className="text-sm text-muted">{job.assessment.title} — timed, taken as the last step of your application.</div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full md:w-[360px] flex-none flex flex-col gap-4">
          <ApplyPanel job={job} />

          {job.company && (
            <div className="card p-5">
              <Link href={`/companies/${job.company.slug}`} className="flex items-center gap-3 mb-3">
                <CompanyLogo company={{ name: job.company.name, logoUrl: job.company.logoUrl }} size={44} className="flex-none" />
                <div className="min-w-0">
                  <div className="font-semibold truncate">{job.company.name}</div>
                  <div className="text-xs text-muted truncate">
                    {[job.company.industry, job.company.sizeBand && `${job.company.sizeBand} staff`].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </Link>
              {job.company.about && <p className="text-sm text-muted mb-3 line-clamp-3">{job.company.about}</p>}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{job.company._count?.jobs ?? 0} open job{(job.company._count?.jobs ?? 0) === 1 ? '' : 's'}</span>
                <Link href={`/companies/${job.company.slug}`} className="text-primary font-semibold hover:text-primary-pressed transition-colors">
                  View profile →
                </Link>
              </div>
            </div>
          )}

          {latestPost && (
            <div className="card p-5">
              <div className="text-[11px] font-bold tracking-wide text-primary mb-2.5">CAREER ADVICE</div>
              {latestPost.coverImageUrl && (
                <Link href={`/career-advice/${latestPost.slug}`} className="block w-full h-[120px] rounded overflow-hidden mb-2.5 bg-ground">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${API_ORIGIN}${latestPost.coverImageUrl}`} alt={latestPost.title} className="w-full h-full object-cover" />
                </Link>
              )}
              <Link href={`/career-advice/${latestPost.slug}`} className="font-semibold leading-snug hover:text-primary transition-colors line-clamp-2 block mb-1.5">
                {latestPost.title}
              </Link>
              <p className="text-sm text-muted line-clamp-2 mb-2.5">{postTeaser(latestPost)}</p>
              <Link href={`/career-advice/${latestPost.slug}`} className="text-primary text-sm font-semibold hover:text-primary-pressed transition-colors">
                Read more →
              </Link>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}
