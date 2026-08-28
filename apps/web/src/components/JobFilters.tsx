'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApi } from '@/lib/auth-context';
import type { Category } from '@/lib/types';

const TYPES: { value: string; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'REMOTE', label: 'Remote' },
];

export default function JobFilters({ facets, onNavigate }: { facets?: { category: string; count: number }[]; onNavigate?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const api = useApi();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api<Category[]>('/categories').then(setCategories).catch(() => {});
  }, [api]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/jobs?${next.toString()}`);
    onNavigate?.();
  }

  const activeType = params.get('type');
  const activeCategory = params.get('category');
  const verifiedOnly = params.get('verifiedSalary') === 'true';

  return (
    <aside className="w-full md:w-[300px] flex-none bg-ground rounded p-5 h-fit">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-base">Filters</span>
        <button
          onClick={() => {
            router.push('/jobs');
            onNavigate?.();
          }}
          className="text-xs font-semibold text-primary border-b-2 border-accent"
        >
          Clear all
        </button>
      </div>

      <div className="border-t border-border py-3.5">
        <div className="text-xs font-bold tracking-wide uppercase mb-2.5">Job category</div>
        <div className="flex flex-col gap-2 text-sm">
          {categories.map((cat) => {
            const c = cat.name;
            const count = facets?.find((f) => f.category === c)?.count;
            return (
              <button
                key={cat.id}
                onClick={() => setParam('category', activeCategory === c ? null : c)}
                className={`flex items-center justify-between text-left ${activeCategory === c ? 'text-primary font-semibold' : 'text-ink/80'}`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-[18px] h-[18px] rounded flex-none flex items-center justify-center text-[11px] ${activeCategory === c ? 'bg-primary text-white' : 'border border-border bg-white'}`}>
                    {activeCategory === c && '✓'}
                  </span>
                  {c}
                </span>
                {count != null && <span className="text-muted text-xs">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border py-3.5">
        <div className="text-xs font-bold tracking-wide uppercase mb-2.5">Location</div>
        <input
          defaultValue={params.get('location') || ''}
          onBlur={(e) => setParam('location', e.target.value || null)}
          onKeyDown={(e) => e.key === 'Enter' && setParam('location', (e.target as HTMLInputElement).value || null)}
          placeholder="Kampala, Wakiso…"
          className="input h-10 bg-white"
        />
      </div>

      <div className="border-t border-border py-3.5">
        <div className="text-xs font-bold tracking-wide uppercase mb-2.5">Job type</div>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setParam('type', activeType === t.value ? null : t.value)}
              className={`pill border ${activeType === t.value ? 'bg-primary text-white border-primary' : 'bg-white border-border text-ink/80'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border py-3.5">
        <div className="text-xs font-bold tracking-wide uppercase mb-2.5">Salary range (UGX / month)</div>
        <input
          type="number"
          defaultValue={params.get('salaryMin') || ''}
          onBlur={(e) => setParam('salaryMin', e.target.value || null)}
          placeholder="Minimum, e.g. 2000000"
          className="input h-10 bg-white mb-3"
        />
        <label className="flex items-center gap-2.5 bg-white border border-primary rounded px-3 py-2.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setParam('verifiedSalary', e.target.checked ? 'true' : null)}
          />
          <span className="font-semibold">Verified salary only</span>
        </label>
      </div>
    </aside>
  );
}
