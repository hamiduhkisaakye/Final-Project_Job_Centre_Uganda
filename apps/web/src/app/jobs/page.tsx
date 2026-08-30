import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import JobsResults from '@/components/JobsResults';
import ActiveFilterChips from '@/components/ActiveFilterChips';
import { publicFetch } from '@/lib/api';
import type { Job } from '@/lib/types';

export default async function JobsSearchPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string' && value) flat[key] = value;
  }
  const qs = new URLSearchParams(flat).toString();
  const result = await publicFetch<{ data: Job[]; meta: any }>(`/jobs?${qs}`);
  const jobs = result?.data || [];
  const total = result?.meta?.total ?? 0;

  return (
    <>
      <PublicNavbar />

      <div className="sticky top-[72px] z-20 bg-ground border-b border-border">
        <div className="max-w-[1320px] mx-auto px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <form action="/jobs" className="bg-white rounded border border-border flex flex-col sm:flex-row items-stretch sm:items-center max-w-[820px] w-full sm:h-11 overflow-hidden flex-none">
            <input name="q" defaultValue={flat.q} placeholder="Job title, skill or company" className="flex-[2] px-3.5 py-2.5 sm:py-0 text-sm outline-none" />
            <input name="location" defaultValue={flat.location} placeholder="Location" className="flex-[1.4] px-3.5 py-2.5 sm:py-0 text-sm outline-none border-t sm:border-t-0 sm:border-l border-border" />
            <button type="submit" className="btn-primary h-9 m-1">Search</button>
          </form>
          <ActiveFilterChips />
        </div>
      </div>

      <JobsResults
        key={qs}
        jobs={jobs}
        total={total}
        query={flat.q}
        location={flat.location}
        facets={result?.meta?.facets?.categories}
        nextCursor={result?.meta?.nextCursor ?? null}
      />

      <Footer />
    </>
  );
}
