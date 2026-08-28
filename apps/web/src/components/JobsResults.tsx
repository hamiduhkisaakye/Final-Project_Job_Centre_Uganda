'use client';

import { useState } from 'react';
import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import JobCard from './JobCard';
import JobFilters from './JobFilters';
import type { Job } from '@/lib/types';

// Filters live in one place (JobFilters) and are reused both as the
// always-visible desktop sidebar and inside the mobile off-canvas drawer —
// same pattern as PortalSidebar's mobile drawer elsewhere in the app.
export default function JobsResults({
  jobs,
  total,
  query,
  location,
  facets,
}: {
  jobs: Job[];
  total: number;
  query?: string;
  location?: string;
  facets?: { category: string; count: number }[];
}) {
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="max-w-[1320px] mx-auto px-6 py-7 flex flex-col md:flex-row gap-6 items-start">
      <div className="hidden md:block">
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
    </div>
  );
}
