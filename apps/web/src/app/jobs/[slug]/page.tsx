import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import ApplyPanel from '@/components/ApplyPanel';
import CompanyLogo from '@/components/CompanyLogo';
import { publicFetch } from '@/lib/api';
import type { Job } from '@/lib/types';

function formatSalary(job: Job) {
  if (!job.salaryDisclosed || (!job.salaryMin && !job.salaryMax)) return 'Salary not disclosed';
  const fmt = (n: number) => `${job.salaryCurrency} ${n.toLocaleString()}`;
  return `${fmt(job.salaryMin || 0)} – ${fmt(job.salaryMax || 0)} / ${job.salaryPeriod}`;
}

export default async function JobDetailPage({ params }: { params: { slug: string } }) {
  const job = await publicFetch<Job>(`/jobs/${params.slug}`);
  if (!job) notFound();

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
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-semibold text-primary">{formatSalary(job)}</span>
                {job.salaryVerifiedAt && <span className="badge badge-green">✓ Verified salary</span>}
              </div>
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
        </div>

        <div className="w-full md:w-[360px] flex-none">
          <ApplyPanel job={job} />
        </div>
      </div>

      <Footer />
    </>
  );
}
