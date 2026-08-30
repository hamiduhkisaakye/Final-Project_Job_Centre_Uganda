'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import JobCard from './JobCard';
import JobFilters from './JobFilters';
import { apiFetch } from '@/lib/api';
import type { Job } from '@/lib/types';

// Filters live in one place (JobFilters) and are reused both as the
// always-visible desktop sidebar and inside the mobile off-canvas drawer —
// same pattern as PortalSidebar's mobile drawer elsewhere in the app.
//
// The parent page renders this with key={qs} (the current filter query
// string) so that changing filters remounts this component and resets its
// local jobs/cursor state — without that, React would keep the old
// paginated-in results around after a filter change since props alone don't
// reset useState.
export default function JobsResults({
  jobs: initialJobs,
  total,
  query,
  location,
  facets,
  nextCursor,
}: {
  jobs: Job[];
  total: number;
  query?: string;
  location?: string;
  facets?: { category: string; count: number }[];
  nextCursor?: string | null;
}) {
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [jobs, setJobs] = useState(initialJobs);
  const [cursor, setCursor] = useState(nextCursor ?? null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  // On desktop, the results column starts far shorter than the filters
  // sidebar (2 cards vs. a tall filter list) — showing "Load more" the
  // instant more data exists looks broken, floating mid-page above the
  // still-much-taller sidebar. So it only appears once the results column
  // has actually grown to match or exceed the sidebar's height. On mobile
  // the sidebar is hidden (0 height), so this is always true there.
  const [readyForLoadMore, setReadyForLoadMore] = useState(false);

  useEffect(() => {
    function compare() {
      const sidebarHeight = sidebarRef.current?.offsetHeight ?? 0;
      const resultsHeight = resultsRef.current?.offsetHeight ?? 0;
      setReadyForLoadMore(resultsHeight >= sidebarHeight);
    }
    compare();
    const observer = new ResizeObserver(compare);
    if (sidebarRef.current) observer.observe(sidebarRef.current);
    if (resultsRef.current) observer.observe(resultsRef.current);
    return () => observer.disconnect();
  }, [jobs, viewMode]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams(searchParams.toString());
      qs.set('cursor', cursor);
      const result = await apiFetch<{ data: Job[]; meta: { nextCursor: string | null } }>(`/jobs?${qs.toString()}`);
      setJobs((prev) => [...prev, ...(result?.data || [])]);
      setCursor(result?.meta?.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="max-w-[1320px] mx-auto px-6 py-7 flex flex-col md:flex-row gap-6 items-start">
      <div className="hidden md:block" ref={sidebarRef}>
        <JobFilters facets={facets} />
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 bg-ink/40 z-40 md:hidden" onClick={() => setFiltersOpen(false)} aria-hidden="true" />
      )}
      <div
        className={`fixed inset-y-0 left-0 w-[85%] max-w-[340px] bg-white z-50 md:hidden overflow-y-auto transform transition-transform duration-200 ease-in-out ${
          filtersOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-border flex-none sticky top-0 bg-white">
          <span className="font-semibold">Filters</span>
          <button onClick={() => setFiltersOpen(false)} className="text-muted hover:text-ink transition-colors" aria-label="Close filters">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <JobFilters facets={facets} onNavigate={() => setFiltersOpen(false)} />
        </div>
      </div>

      <div className="flex-1 w-full">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="min-w-0">
            <div className="text-xl font-semibold">{total} jobs{location ? ` in ${location}` : ''}</div>
            {query && <div className="text-sm text-muted truncate">for &ldquo;{query}&rdquo;</div>}
          </div>
          <div className="flex items-center gap-2 flex-none">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="md:hidden btn-secondary h-9 px-3 text-sm flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>
            <div className="flex items-center border border-border rounded overflow-hidden flex-none">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                aria-label="Card view"
                aria-pressed={viewMode === 'card'}
                className={`w-9 h-9 flex items-center justify-center transition-colors ${viewMode === 'card' ? 'bg-primary text-white' : 'bg-white text-muted hover:text-ink'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                className={`w-9 h-9 flex items-center justify-center border-l border-border transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white text-muted hover:text-ink'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div ref={resultsRef}>
          {jobs.length === 0 ? (
            <div className="card p-10 text-center text-muted text-sm">
              No jobs match these filters. Try removing one, or check back soon.
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-5">
              {jobs.map((j) => (
                <JobCard key={j.id} job={j} hotHover />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {jobs.map((j) => (
                <JobCard key={j.id} job={j} variant="list" hotHover />
              ))}
            </div>
          )}
        </div>

        {cursor && jobs.length < total && readyForLoadMore && (
          <div className="flex flex-col items-center gap-2 mt-8">
            <button type="button" className="btn-secondary" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Loading…' : 'Load more jobs'}
            </button>
            <span className="text-xs text-muted">Showing {jobs.length} of {total}</span>
          </div>
        )}
      </div>
    </div>
  );
}
