import { API_ORIGIN } from '@/lib/api';
import { seekerDisplayName, seekerInitials } from '@/lib/format';
import type { SeekerProfile } from '@/lib/types';

interface SeekerLike {
  email?: string;
  seekerProfile?: Pick<SeekerProfile, 'fullName' | 'headline' | 'avatarUrl'> | null;
}

// Seeker-side counterpart to CompanyLogo — a real photo (headshot) if the
// seeker has uploaded one, initials otherwise. Circular by default since
// this is a person, not a brand mark (which is why it doesn't share
// CompanyLogo's object-contain letterboxing — a face photo should fill and
// crop to the circle like any other avatar, not be padded/shrunk).
export default function SeekerAvatar({
  seeker,
  size = 40,
  className = '',
}: {
  seeker?: SeekerLike | null;
  size?: number;
  className?: string;
}) {
  const avatarUrl = seeker?.seekerProfile?.avatarUrl;
  return (
    <div
      className={`rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary overflow-hidden flex-none ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.32)) }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${API_ORIGIN}${avatarUrl}`}
          alt={seekerDisplayName(seeker)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{seekerInitials(seeker)}</span>
      )}
    </div>
  );
}
