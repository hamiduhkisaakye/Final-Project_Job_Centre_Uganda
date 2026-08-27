# Changelog

Manual change log for rollback tracking (this folder is not a git repository).
Newest entries first. Each entry lists exactly which files changed and what
to restore to undo it — for CSS-class-only tweaks, the "before" value is
given inline; for structural changes, revert by restoring the described
prior structure.

---

## 2026-08-27 — Homepage gradient rebalance + site-wide transition/motion polish

### Homepage hero gradient rebalanced (more photo visible)

**File:** `apps/web/src/app/page.tsx`

The hero overlay was very heavy (70-95% opacity), nearly hiding the
background photo. Rebalanced toward showing more of the photo while keeping
the left-side text legible.

- Gradient: `bg-gradient-to-r from-primary/95 via-primary/85 to-primary-pressed/70` → `from-primary/80 via-primary/50 to-primary-pressed/20`
- Badge pill: `bg-white/15` → `bg-white/20 backdrop-blur-sm border border-white/10` (frosted-glass look, needed more contrast now that the underlying overlay is lighter)
- `<h1>` drop-shadow: `rgba(0,0,0,0.25)` → `rgba(0,0,0,0.35)` (slightly stronger, same reason)
- `<p>` text: `text-white/80` (no shadow) → `text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]` (previously safe to leave unshadowed against the near-solid overlay; now needs its own contrast help)

**To revert:** restore the four values above to their left-hand (original) form.

### Sitewide: added transitions to interactive elements that were missing them

Buttons/links/rows that changed color or background on hover with no
`transition-*` class, so the change snapped instantly instead of easing.
Fix in every case: append `transition-colors` (or `transition-shadow` /
`transition-all` where noted) to the existing className. Files touched:

- `apps/web/src/components/UserMenu.tsx` — dropdown item links, logout button
- `apps/web/src/components/NotificationBell.tsx` — "Mark all read" button, notification list items
- `apps/web/src/components/PortalSidebar.tsx` — mobile close (X) button
- `apps/web/src/components/SeekerProfileModal.tsx` — close (×) button
- `apps/web/src/components/MessagesPanel.tsx` — conversation list item, mobile back button
- `apps/web/src/components/PublicNavbar.tsx` — desktop nav links
- `apps/web/src/components/JobsResults.tsx` — mobile "close filters" button
- `apps/web/src/app/page.tsx` — "Browse by category" cards gained `hover:-translate-y-0.5` (subtle lift) alongside their existing `hover:shadow-2 hover:border-primary`, changed `transition-shadow` → `transition-all` to cover the new transform; "View all jobs →" link gained `hover:text-primary-pressed transition-colors`

**To revert:** remove the added `transition-*`/`hover:-translate-y-0.5` classes listed per file above; everything else in those className strings is unchanged.

### Dropdown menus now animate open/close instead of instant mount/unmount

**Files:** `apps/web/src/components/UserMenu.tsx`, `apps/web/src/components/NotificationBell.tsx`

Both dropdowns used `{open && (<div>...)}` (instant appear/disappear). Changed
to always-render the panel with `opacity`/`scale` classes driven by `open`,
transitioning smoothly:

```
className={`absolute right-0 top-full pt-2 z-40 origin-top-right transition-all duration-150 ease-out ${
  open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
}`}
aria-hidden={!open}
```
wrapping the same inner `<div className="w-56 ...">` / `<div className="w-80 ...">` content that was previously the direct child of the `{open && (...)}` block.

**To revert:** change back to `{open && (<div className="absolute right-0 top-full pt-2 z-40">...)}`, dropping the `origin-top-right transition-all duration-150 ease-out` + conditional opacity/scale classes and the `aria-hidden` attribute.

### New scroll-reveal component + applied to all homepage sections below the hero

**New file:** `apps/web/src/components/Reveal.tsx` — a client component that
fades + slides up its children (`opacity-0 translate-y-6` → `opacity-100
translate-y-0`, 700ms) the first time they scroll into view, via
`IntersectionObserver`. Skips the animation entirely for
`prefers-reduced-motion: reduce`. No new npm dependency.

**File:** `apps/web/src/app/page.tsx` — every `<section>` from "Browse by
category" through "Get hired" (6 sections: categories, trending jobs, how it
works, AI matching, for employers, get hired/testimonials) had their inner
content div's opening tag changed from `<div className="max-w-[1320px]
mx-auto px-6 ...">` to `<Reveal className="max-w-[1320px] mx-auto px-6
...">` (same className, same closing tag now `</Reveal>`). The `<section>`
wrapper itself (background color, padding) was NOT changed — only the
content inside it reveals; section backgrounds render immediately.

**To revert:** delete `apps/web/src/components/Reveal.tsx`; in `page.tsx`,
change each `<Reveal className="...">...</Reveal>` back to `<div
className="...">...</div>` for those 6 sections, and remove the `import
Reveal from '@/components/Reveal';` line.

### Per-navigation fade-in for portal page content (dashboard/company/admin)

**Files:** `apps/web/src/app/dashboard/layout.tsx`, `apps/web/src/app/company/layout.tsx`, `apps/web/src/app/admin/layout.tsx`

Added `usePathname()` and changed each layout's `<main>` element from
`<main className="flex-1 p-4 sm:p-7">{children}</main>` to `<main
key={pathname} className="flex-1 p-4 sm:p-7 animate-fadeIn">{children}</main>`.
Keying by `pathname` only remounts the `<main>` content area on navigation —
the sidebar, sticky header, and `NotificationBell` (and its live socket
connection) live outside `<main>` as siblings and are deliberately left
untouched by this, so they don't reset/reconnect on every click. Uses the
pre-existing `animate-fadeIn` keyframe already defined in
`tailwind.config.ts` (was previously only used by `TestimonialCarousel`).

**To revert:** in each of the 3 layout files, remove the `key={pathname}` and
` animate-fadeIn` from the `<main>` element, remove the `const pathname =
usePathname();` line, and remove the `usePathname` import.

### Global component-class polish (buttons, inputs, cards)

**File:** `apps/web/src/app/globals.css`

- `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`: changed
  `transition-colors` → `transition duration-150` (the broader `transition`
  utility, needed so the new `transform` change below actually animates —
  `transition-colors` alone doesn't cover `transform`), and added
  `active:scale-[0.97]` (tactile press feedback) with
  `disabled:active:scale-100` on the two that have a `disabled:` state, so a
  disabled button doesn't visually "press."
- `.input`: added `transition-colors duration-150` (focus border/ring color
  change was previously instant).
- `.card`: added `transition-shadow duration-200` to the base class (many
  call sites already added `hover:shadow-2 transition-shadow` ad hoc per
  instance; this makes it the default so any card gets a smooth shadow
  transition even where a call site forgot to add it explicitly).

**To revert:** in each `@apply` block in `globals.css`, remove
`active:scale-[0.97]` / `disabled:active:scale-100` and change `transition
duration-150` back to `transition-colors` on the four `.btn-*` classes;
remove `transition-colors duration-150` from `.input`; remove
`transition-shadow duration-200` from `.card`.

---

## 2026-08-27 (earlier) — Sticky search bar (homepage + Find Jobs) + Find Jobs view toggle & mobile filter drawer

*(Recorded retroactively — implemented just before this changelog was created.)*

- **Homepage** (`apps/web/src/app/page.tsx`): search form moved out of the
  hero `<section>` (it can't stay sticky-through-scroll while nested inside
  the hero's own short, `overflow-hidden` box — a `position: sticky` element
  can never stick past its own immediate parent's bounds) into its own
  top-level `<div className="sticky top-[72px] z-20 bg-white border-b
  border-border shadow-1">` bar directly below the hero, before "Browse by
  category." To revert: move the `<form>` back inside the hero's content div
  (`<div className="relative max-w-[1320px] mx-auto px-6 py-16">`, right
  after the heading/paragraph block) with its original classes
  (`bg-white rounded shadow-2 flex flex-col md:flex-row items-stretch p-2.5
  mt-8 max-w-[820px]`), and delete the new sticky wrapper `<div>`.

- **Find Jobs** (`apps/web/src/app/jobs/page.tsx`): the existing search bar
  wrapper `<div className="bg-ground border-b border-border">` got `sticky
  top-[72px] z-20` appended (no structural move needed — it was already a
  page-level sibling, not nested inside a short parent). To revert: remove
  `sticky top-[72px] z-20` from that div's className.

- **New file** `apps/web/src/components/JobsResults.tsx`: client component
  holding `viewMode` ('card'|'list') and `filtersOpen` state; renders the
  desktop filters sidebar (`hidden md:block`), a mobile off-canvas filter
  drawer (same slide-in/backdrop pattern as `PortalSidebar`), a card/list
  view toggle, and the job results in either layout. `apps/web/src/app/jobs/page.tsx`
  was changed to render `<JobsResults jobs={jobs} total={total}
  query={flat.q} location={flat.location} facets={...} />` instead of
  inlining the filters + grid directly.

- **`apps/web/src/components/JobCard.tsx`**: added a `variant?: 'card' |
  'list'` prop (defaults to `'card'`, unchanged behavior for every existing
  call site that doesn't pass it); added a new compact horizontal row
  layout branch for `variant="list"`.

- **`apps/web/src/components/JobFilters.tsx`**: added an optional
  `onNavigate?: () => void` prop, called after every `router.push` in
  `setParam` and in the "Clear all" button's `onClick` — used by
  `JobsResults` to auto-close the mobile filter drawer when a filter is
  picked. No behavior change for the desktop sidebar usage (prop omitted
  there).

**To revert this block:** restore `apps/web/src/app/jobs/page.tsx` to
inline the `<JobFilters>` sidebar + job grid directly (no `JobsResults`);
delete `apps/web/src/components/JobsResults.tsx`; remove the `variant` prop
and list-layout branch from `JobCard.tsx`; remove the `onNavigate` prop and
its two call sites from `JobFilters.tsx`.
