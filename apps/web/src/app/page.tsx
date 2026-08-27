import Link from 'next/link';
import Image from 'next/image';
import { Megaphone, Laptop2, HeartHandshake, Truck, type LucideIcon } from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import JobCard from '@/components/JobCard';
import Reveal from '@/components/Reveal';
import TestimonialCarousel from '@/components/TestimonialCarousel';
import { publicFetch, API_ORIGIN } from '@/lib/api';
import { categoryLabel } from '@/lib/blog-categories';
import type { BlogPost, Company, Job } from '@/lib/types';

function postTeaser(post: BlogPost) {
  if (post.excerpt) return post.excerpt;
  const text = post.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

const TESTIMONIALS = [
  {
    quote: 'I updated my profile on a Sunday night. By Wednesday I had two interviews lined up.',
    name: 'Sarah N.',
    role: 'Marketing Officer, Kampala',
  },
  {
    quote: 'The match score told me exactly which roles were worth my time — I stopped applying blind.',
    name: 'James O.',
    role: 'Backend Engineer, Remote — Uganda',
  },
  {
    quote: 'Verified salary ranges meant I only applied to roles that actually paid what I needed.',
    name: 'Grace A.',
    role: 'Programme Officer, Gulu',
  },
];

const CATEGORIES: { name: string; icon: LucideIcon }[] = [
  { name: 'Sales & Marketing', icon: Megaphone },
  { name: 'IT & Software', icon: Laptop2 },
  { name: 'NGO & Development', icon: HeartHandshake },
  { name: 'Logistics', icon: Truck },
];

const HOW_IT_WORKS = [
  {
    title: 'Build your profile',
    description: 'Add your resume, skills and a professional photo — it takes ten minutes and powers everything below.',
  },
  {
    title: 'Get matched daily',
    description: 'Our AI reads your experience and ranks live roles by real fit, not just keyword overlap — with a plain-English reason for every match.',
  },
  {
    title: 'Apply with confidence',
    description: 'See your match score and a verified salary range before you apply, then track every application from one board.',
  },
];

export default async function HomePage() {
  const [result, companies, latestPosts] = await Promise.all([
    publicFetch<{ data: Job[]; meta: any }>('/jobs?take=6&sort=newest'),
    publicFetch<Company[]>('/companies'),
    publicFetch<BlogPost[]>('/blog?take=3'),
  ]);
  const jobs = result?.data || [];
  const companyCount = companies?.length ?? 0;
  const posts = latestPosts || [];

  return (
    <>
      <PublicNavbar />

      <section className="relative overflow-hidden">
        <Image
          src="/job-offer-celebration-uganda.jpg"
          alt="A job seeker celebrating a new job offer in Uganda"
          fill
          priority
          className="object-cover object-[center_20%] -scale-x-100"
        />
        {/* Rebalanced from 95/85/70 opacity to 80/50/20 — the photo now
            actually reads through the tint instead of being nearly hidden
            behind a near-solid wash. Kept opaque enough on the left (where
            the text sits) for contrast; the paragraph and badge picked up
            their own shadow/blur since they can no longer lean on the old
            heavy overlay for legibility. */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 via-primary/50 to-primary-pressed/20" />
        <div className="relative max-w-[1320px] mx-auto px-6 py-16">
          <div className="max-w-[640px]">
            <div className="inline-block bg-white/20 backdrop-blur-sm border border-white/10 text-white text-xs font-semibold tracking-wide px-3 py-1.5 rounded-full mb-4">
              {jobs.length > 0 ? `${result?.meta?.total ?? jobs.length}+ LIVE JOBS` : 'NEW ON THE PLATFORM'}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-3 drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
              Find your next job in Uganda
            </h1>
            <p className="text-lg text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
              Verified employers, transparent salaries, and AI matching that reads your CV — not just your keywords.
            </p>
          </div>
        </div>
      </section>

      {/* Sticky search — only this bar pins under the nav on scroll, not the
          whole hero. Placed as a plain sibling (not nested inside the hero's
          own overflow-hidden section) so its containing block spans the rest
          of the page instead of just the hero's height, which is what lets
          position:sticky keep it pinned all the way down instead of
          unsticking the moment the hero scrolls out of view. */}
      <div className="sticky top-[72px] z-20 bg-white border-b border-border shadow-1">
        <div className="max-w-[1320px] mx-auto px-6 py-3">
          <form action="/jobs" className="bg-white rounded border border-border flex flex-col md:flex-row items-stretch max-w-[820px] overflow-hidden">
            <input
              name="q"
              placeholder="Job title, skill or company"
              className="flex-[2] px-4 py-3 text-sm outline-none"
            />
            <input
              name="location"
              placeholder="Kampala, Uganda"
              className="flex-[1.4] px-4 py-3 text-sm outline-none border-t md:border-t-0 md:border-l border-border"
            />
            <button type="submit" className="btn-primary m-1">Search</button>
          </form>
        </div>
      </div>

      <section className="bg-ground py-14">
        <Reveal className="max-w-[1320px] mx-auto px-6">
          <h2 className="text-2xl font-semibold text-primary mb-5">Browse by category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {CATEGORIES.map((c) => (
              <Link
                key={c.name}
                href={`/jobs?category=${encodeURIComponent(c.name)}`}
                className="card p-5 flex items-center gap-3.5 hover:shadow-2 hover:border-primary hover:-translate-y-0.5 transition-all"
              >
                <div className="w-12 h-12 rounded bg-ground flex items-center justify-center flex-none">
                  <c.icon className="w-6 h-6 text-primary" strokeWidth={1.75} />
                </div>
                <span className="font-semibold">{c.name}</span>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="py-14">
        <Reveal className="max-w-[1320px] mx-auto px-6">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-2xl font-semibold text-primary">Trending this week</h2>
            <Link href="/jobs" className="text-primary font-semibold text-sm hover:text-primary-pressed transition-colors">View all jobs →</Link>
          </div>
          {jobs.length === 0 ? (
            <p className="text-muted text-sm">
              No jobs published yet — run <code className="bg-ground px-1.5 py-0.5 rounded">npm run db:seed</code> in{' '}
              <code className="bg-ground px-1.5 py-0.5 rounded">apps/api</code> to load demo data.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {jobs.map((j) => (
                <JobCard key={j.id} job={j} />
              ))}
            </div>
          )}
        </Reveal>
      </section>

      <section className="bg-ground py-16">
        <Reveal className="max-w-[1320px] mx-auto px-6 flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1 w-full md:max-w-[420px]">
            <Image
              src="/career-growth-kampala.jpg"
              alt="A job seeker in Kampala building momentum in their career"
              width={800}
              height={1000}
              className="rounded-card shadow-2 w-full h-[420px] object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold tracking-wide text-primary mb-2">HOW IT WORKS</div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Three steps from CV to offer letter</h2>
            <div className="flex flex-col gap-6">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.title} className="flex gap-4">
                  <div className="w-9 h-9 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center flex-none">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-semibold mb-1">{step.title}</div>
                    <p className="text-sm text-muted leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="bg-primary py-12">
        <Reveal className="max-w-[1320px] mx-auto px-6 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-[1.4]">
            <div className="text-xs font-bold tracking-wide text-accent mb-2">AI MATCHING</div>
            <h3 className="text-3xl font-bold text-white mb-3">Upload your CV once. Get matched every day.</h3>
            <p className="text-white/80 mb-5 max-w-[520px]">
              We read your experience and skills, then rank live roles by real fit — and tell you exactly why each one matched.
            </p>
            <Link href="/register" className="btn-primary bg-accent text-ink hover:bg-accent-pressed">
              Upload your CV
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="py-16">
        <Reveal className="max-w-[1320px] mx-auto px-6 flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1">
            <div className="text-xs font-bold tracking-wide text-primary mb-2">FOR EMPLOYERS</div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Built for Uganda&apos;s hiring teams</h2>
            <p className="text-muted mb-5 max-w-[440px]">
              {companyCount > 0 ? `Join ${companyCount}+ employers` : 'Join employers'} already hiring on Job Centre Uganda —
              post a role in minutes and let AI matching bring you candidates who actually fit.
            </p>
            <ul className="flex flex-col gap-2.5 mb-6 text-sm">
              {['Post a job and reach candidates in minutes', 'AI-ranked applicants — no more sorting hundreds of CVs by hand', 'A verified-salary badge that builds trust with serious candidates'].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="text-success font-bold flex-none">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/register" className="btn-primary">Post a job →</Link>
          </div>
          <div className="flex-1 w-full md:max-w-[480px]">
            <Image
              src="/hiring-team-meeting-uganda.jpg"
              alt="A hiring team reviewing candidates together"
              width={900}
              height={700}
              className="rounded-card shadow-2 w-full h-[360px] object-cover"
            />
          </div>
        </Reveal>
      </section>

      {posts.length > 0 && (
        <section className="bg-ground py-16">
          <Reveal className="max-w-[1320px] mx-auto px-6">
            <div className="flex items-baseline justify-between mb-7">
              <div>
                <div className="text-xs font-bold tracking-wide text-primary mb-2">CAREER ADVICE</div>
                <h2 className="text-2xl md:text-3xl font-bold">Latest from the team</h2>
              </div>
              <Link href="/career-advice" className="text-primary font-semibold text-sm hover:text-primary-pressed transition-colors">
                View all posts →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/career-advice/${post.slug}`}
                  className="card overflow-hidden flex flex-col hover:shadow-2 hover:border-primary transition-all hover:-translate-y-0.5"
                >
                  {post.coverImageUrl ? (
                    <div className="w-full h-[190px] flex-none bg-white overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${API_ORIGIN}${post.coverImageUrl}`} alt={post.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-[190px] flex-none bg-white" />
                  )}
                  <div className="p-5 flex flex-col gap-2.5 flex-1">
                    <span className="badge badge-blue w-fit">{categoryLabel(post.category)}</span>
                    <div className="font-semibold leading-snug line-clamp-2">{post.title}</div>
                    <p className="text-sm text-muted line-clamp-2 flex-1">{postTeaser(post)}</p>
                    <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-ground">
                      <span>{post.publishedAt && new Date(post.publishedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</span>
                      <span className="text-primary font-semibold">Read →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      <section className="bg-gradient-to-br from-primary to-primary-pressed py-16">
        <Reveal className="max-w-[1320px] mx-auto px-6">
          <div className="text-center mb-8">
            <div className="text-xs font-bold tracking-wide text-accent mb-3">GET HIRED</div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Your next &ldquo;yes&rdquo; is closer than you think.</h2>
          </div>
          <TestimonialCarousel items={TESTIMONIALS} />
        </Reveal>
      </section>

      <Footer />
    </>
  );
}
