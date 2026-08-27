import { API_ORIGIN } from '@/lib/api';

function initials(name?: string) {
  if (!name) return '—';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// Single source of truth for "company avatar, image if there is one,
// initials otherwise" — used everywhere a company's logo appears (job
// cards, job detail, company profile, the companies directory) so an
// uploaded logo shows up consistently site-wide instead of only on the
// settings page that uploaded it.
export default function CompanyLogo({
  company,
  size = 48,
  rounded = 'rounded',
  className = '',
}: {
  company: { name: string; logoUrl?: string | null };
  size?: number;
  rounded?: string;
  className?: string;
}) {
  return (
    <div
      className={`${rounded} bg-ground flex items-center justify-center font-bold text-primary overflow-hidden ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.32)) }}
    >
      {company.logoUrl ? (
        // object-contain (not cover) — logos are rarely square, and cover
        // crops/zooms into the center of wide or tall marks. contain
        // letterboxes the full logo on the ground-colored background
        // instead, which is the standard way to render a brand mark.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${API_ORIGIN}${company.logoUrl}`}
          alt={company.name}
          className="w-full h-full object-contain p-[12%]"
        />
      ) : (
        <span>{initials(company.name)}</span>
      )}
    </div>
  );
}
