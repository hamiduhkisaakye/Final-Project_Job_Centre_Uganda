'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  REMOTE: 'Remote',
};

const POSTED_LABELS: Record<string, string> = {
  '1': 'Last 24 hours',
  '7': 'Last 7 days',
  '30': 'Last 30 days',
};

// Category and location are left out on purpose — location is already shown
// in the results heading ("N jobs in Kampala") and category is visible as a
// checked box in the sidebar, so chips here cover the filters that would
// otherwise have no visible indicator (especially with the sidebar tucked
// into the mobile drawer).
const CHIP_KEYS = ['type', 'salaryMin', 'verifiedSalary', 'postedWithin'] as const;

export default function ActiveFilterChips() {
  const router = useRouter();
  const params = useSearchParams();

  function remove(key: string) {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    router.push(`/jobs?${next.toString()}`);
  }

  function clearAll() {
    const next = new URLSearchParams(params.toString());
    for (const key of CHIP_KEYS) next.delete(key);
    router.push(`/jobs?${next.toString()}`);
  }

  const chips: { key: string; label: string }[] = [];
  const type = params.get('type');
  if (type) chips.push({ key: 'type', label: TYPE_LABELS[type] || type });
  const salaryMin = params.get('salaryMin');
  if (salaryMin) chips.push({ key: 'salaryMin', label: `Min UGX ${Number(salaryMin).toLocaleString()}` });
  if (params.get('verifiedSalary') === 'true') chips.push({ key: 'verifiedSalary', label: 'Verified salary' });
  const postedWithin = params.get('postedWithin');
  if (postedWithin) chips.push({ key: 'postedWithin', label: POSTED_LABELS[postedWithin] || `Last ${postedWithin} days` });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => remove(c.key)}
          className="pill bg-white border border-primary text-primary flex items-center gap-1.5 hover:bg-primary hover:text-white transition-colors"
        >
          {c.label}
          <X className="w-3 h-3" />
        </button>
      ))}
      <button type="button" onClick={clearAll} className="text-xs font-semibold text-primary hover:text-primary-pressed transition-colors">
        Clear all
      </button>
    </div>
  );
}
