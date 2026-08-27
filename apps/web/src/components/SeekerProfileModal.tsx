import { API_ORIGIN } from '@/lib/api';
import { seekerDisplayName } from '@/lib/format';
import SeekerAvatar from './SeekerAvatar';
import type { SeekerProfile } from '@/lib/types';

interface SeekerLike {
  email?: string;
  seekerProfile?: SeekerProfile | null;
}

// Shared "who is this candidate" view — used by the company Pipeline board
// (with matchScore + coverLetter, since that's application-specific) and
// the company side of Messages (without them, since a chat thread isn't
// always tied to one specific application).
export default function SeekerProfileModal({
  seeker,
  matchScore,
  assessmentScore,
  assessmentPassed,
  coverLetter,
  onClose,
}: {
  seeker?: SeekerLike | null;
  matchScore?: number | null;
  assessmentScore?: number | null;
  assessmentPassed?: boolean | null;
  coverLetter?: string | null;
  onClose: () => void;
}) {
  const p = seeker?.seekerProfile;
  const name = seekerDisplayName(seeker);

  return (
    <div className="fixed inset-0 bg-ink/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card shadow-2 max-w-[760px] w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <SeekerAvatar seeker={seeker} size={44} />
            <div>
              <div className="font-semibold">{name}</div>
              <div className="text-xs text-muted">{p?.headline ? `${p.headline} · ` : ''}{seeker?.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors text-xl leading-none">×</button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted">Location</span><div className="font-medium">{p?.location || '—'}</div></div>
            <div><span className="text-muted">Experience</span><div className="font-medium">{p?.yearsExperience != null ? `${p.yearsExperience} years` : '—'}</div></div>
            <div><span className="text-muted">Expected salary</span><div className="font-medium">{p?.expectedSalaryMin ? `${p.currency} ${p.expectedSalaryMin.toLocaleString()}${p.expectedSalaryMax ? ` – ${p.expectedSalaryMax.toLocaleString()}` : ''}` : '—'}</div></div>
            {matchScore != null && (
              <div><span className="text-muted">Match score</span><div className="font-medium">{matchScore}%</div></div>
            )}
            {assessmentScore != null && (
              <div>
                <span className="text-muted">Assessment</span>
                <div className={`font-medium ${assessmentPassed ? 'text-success' : 'text-danger'}`}>
                  {assessmentScore}% {assessmentPassed ? '· Passed' : '· Did not pass'}
                </div>
              </div>
            )}
          </div>

          {p?.skills && p.skills.length > 0 && (
            <div>
              <div className="text-[11px] font-bold tracking-wide text-muted mb-1.5">SKILLS</div>
              <div className="flex flex-wrap gap-1.5">
                {p.skills.map((s) => <span key={s} className="badge badge-blue">{s}</span>)}
              </div>
            </div>
          )}

          {p?.about && (
            <div>
              <div className="text-[11px] font-bold tracking-wide text-muted mb-1.5">ABOUT</div>
              <p className="text-sm leading-relaxed">{p.about}</p>
            </div>
          )}

          {p?.resumeText && (
            <div>
              <div className="text-[11px] font-bold tracking-wide text-muted mb-1.5">RESUME SUMMARY</div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.resumeText}</p>
            </div>
          )}

          {p?.resumeFileUrl && (
            <a href={`${API_ORIGIN}${p.resumeFileUrl}`} target="_blank" rel="noopener noreferrer" className="btn-secondary w-fit">
              📄 Download {p.resumeFileName || 'resume'} →
            </a>
          )}

          {p?.videoResumeUrl && (
            <div>
              <div className="text-[11px] font-bold tracking-wide text-muted mb-1.5">VIDEO RESUME</div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video controls className="w-full rounded-card border border-border max-h-[360px]" src={`${API_ORIGIN}${p.videoResumeUrl}`} />
            </div>
          )}

          {coverLetter !== undefined && (
            <div>
              <div className="text-[11px] font-bold tracking-wide text-muted mb-1.5">COVER LETTER</div>
              {coverLetter ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{coverLetter}</p>
              ) : (
                <p className="text-sm text-muted">No cover letter submitted.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
