import { createElement, Fragment, type ReactNode } from 'react';
import type { SeekerProfile } from './types';

// Single place for "what do we call this seeker" — prefers their actual
// name, falls back to their professional headline (e.g. "Marketing
// Officer"), then email. Centralized so a person's name and a job-title
// tagline never get conflated again the way `headline` used to stand in
// for both.
export function seekerDisplayName(seeker?: { email?: string; seekerProfile?: Pick<SeekerProfile, 'fullName' | 'headline'> | null } | null): string {
  return seeker?.seekerProfile?.fullName || seeker?.seekerProfile?.headline || seeker?.email || 'Unknown';
}

export function seekerInitials(seeker?: { email?: string; seekerProfile?: Pick<SeekerProfile, 'fullName' | 'headline'> | null } | null): string {
  return seekerDisplayName(seeker).slice(0, 2).toUpperCase();
}

// Trailing punctuation is excluded from the match so a URL at the end of a
// sentence ("see https://x.com/foo.") doesn't swallow the period into the link.
const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)'"\]}])/g;

// Splits chat message text on URLs and renders each as a real anchor while
// leaving surrounding plain text untouched. String.split with a
// capturing-group regex interleaves matches into the result array at odd
// indices, so `i % 2 === 1` reliably identifies URL segments.
export function linkifyMessage(text: string): ReactNode[] {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    i % 2 === 1
      ? createElement('a', { key: i, href: part, target: '_blank', rel: 'noopener noreferrer', className: 'underline break-all' }, part)
      : createElement(Fragment, { key: i }, part),
  );
}
