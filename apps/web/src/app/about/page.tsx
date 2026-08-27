import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Eye, Users, Sparkles } from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import { publicFetch } from '@/lib/api';
import type { Company, Job } from '@/lib/types';

const VALUES = [
  {
    icon: Eye,
    title: 'Transparency first',
    description: 'Verified salary ranges on every job that shows one, so you know what a role pays before you spend an hour applying.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified employers',
    description: 'Companies go through a moderation review before their jobs go live — fewer ghost listings, more real opportunities.',
  },
  {
    icon: Sparkles,
    title: 'AI that actually reads your CV',
    description: 'Matching that looks at your real experience and skills, not just keyword overlap, with a plain-English reason for every match.',
  },
  {
    icon: Users,
    title: 'Built for Uganda',
    description: "From Kampala to Gulu to Mbarara — a platform designed around how Ugandan job seekers and employers actually hire.",
  },
];

export default async function AboutPage() {
  const [companies, jobsResult] = await Promise.all([
    publicFetch<Company[]>('/companies'),
    publicFetch<{ data: Job[]; meta: any }>('/jobs?take=1'),
  ]);
  const companyCount = companies?.length ?? 0;
  const jobCount = jobsResult?.meta?.total ?? 0;

  return (
    <>
      <PublicNavbar />

      <div className="bg-ground border-b border-border">
        <div className="max-w-[1320px] mx-auto px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">About Job Centre Uganda</h1>
          <p className="text-muted max-w-[640px]">
            We&apos;re building Uganda&apos;s most transparent hiring marketplace — one where job seekers see real
            salaries before they apply, and employers reach candidates who genuinely fit the role.
          </p>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row gap-12 items-center mb-16">
          <div className="flex-1">
            <div className="text-xs font-bold tracking-wide text-primary mb-2">OUR MISSION</div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Hiring shouldn&apos;t be a guessing game.</h2>
            <p className="text-muted leading-relaxed mb-4">
              Too many job seekers in Uganda spend hours applying to roles that turn out to pay far less than
              expected, or to employers who never respond. Too many employers wade through hundreds of CVs that
              don&apos;t match what they actually need.
            </p>
            <p className="text-muted leading-relaxed">
              Job Centre Uganda exists to fix both sides of that problem — verified salary ranges, moderated job
              listings, and AI matching that reads a CV the way a good recruiter would, not just a keyword scanner.
            </p>
          </div>
          <div className="flex-1 w-full md:max-w-[480px]">
            <Image
              src="/team-collaboration-kampala.jpg"
              alt="A team collaborating in a Kampala office"
              width={900}
              height={700}
              className="rounded-card shadow-2 w-full h-[360px] object-cover"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-16">
          {[
            { label: 'Verified companies', value: `${companyCount}+` },
            { label: 'Live jobs', value: `${jobCount}+` },
            { label: 'Cities covered', value: '3+' },
            { label: 'Free for job seekers', value: '100%' },
          ].map((stat) => (
            <div key={stat.label} className="card p-5 text-center">
              <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
              <div className="text-xs text-muted font-semibold tracking-wide uppercase">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-16">
          <div className="text-center mb-8">
            <div className="text-xs font-bold tracking-wide text-primary mb-2">WHAT WE BELIEVE</div>
            <h2 className="text-2xl md:text-3xl font-bold">The principles behind the platform</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {VALUES.map((v) => (
              <div key={v.title} className="card p-5 flex flex-col gap-3">
                <div className="w-11 h-11 rounded bg-ground flex items-center justify-center">
                  <v.icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="font-semibold">{v.title}</div>
                <p className="text-sm text-muted leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-8 sm:p-10 text-center bg-primary">
          <h2 className="text-2xl font-bold text-white mb-2">Ready to find your next opportunity?</h2>
          <p className="text-white/80 mb-5 max-w-[480px] mx-auto">
            Create a free profile in minutes and start getting matched to roles that actually fit.
          </p>
          <Link href="/register" className="btn-primary bg-accent text-ink hover:bg-accent-pressed">
            Get started →
          </Link>
        </div>
      </div>

      <Footer />
    </>
  );
}
