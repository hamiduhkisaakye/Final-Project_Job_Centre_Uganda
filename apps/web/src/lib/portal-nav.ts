// Shared by every portal layout (dashboard/company/admin) to turn the
// current pathname into a page title for the topbar — replacing the old
// static "Job Seeker Portal"/"Company Portal"/"Admin Console" label with
// whichever nav item's page is actually open. Falls back to the portal's
// own name when the current route isn't a nav item (e.g. a page reached
// via a button rather than the sidebar, like /company/post-job).
export function currentSectionLabel(pathname: string, items: { href: string; label: string }[], fallback: string): string {
  const exact = items.find((i) => i.href === pathname);
  if (exact) return exact.label;
  const prefixMatches = items.filter((i) => i.href !== '/' && pathname.startsWith(`${i.href}/`));
  if (prefixMatches.length > 0) {
    return prefixMatches.reduce((a, b) => (b.href.length > a.href.length ? b : a)).label;
  }
  return fallback;
}
