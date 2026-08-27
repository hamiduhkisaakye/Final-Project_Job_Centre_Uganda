import type { BlogCategory } from './types';

// Mirrors the BlogCategory enum in schema.prisma — single source of truth
// for display labels, reused by the admin editor's category picker and the
// public Career Advice index page's filter pills.
export const BLOG_CATEGORIES: { value: BlogCategory; label: string }[] = [
  { value: 'CV_RESUME', label: 'CV & Resume' },
  { value: 'INTERVIEWS', label: 'Interviews' },
  { value: 'SALARY_NEGOTIATION', label: 'Salary & Negotiation' },
  { value: 'CAREER_GROWTH', label: 'Career Growth' },
  { value: 'WORKPLACE_TIPS', label: 'Workplace Tips' },
];

export function categoryLabel(value: string): string {
  return BLOG_CATEGORIES.find((c) => c.value === value)?.label || value;
}
