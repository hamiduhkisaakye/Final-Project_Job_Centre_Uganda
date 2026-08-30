import type { CertificationEntry, EducationEntry, ExperienceEntry, LinkEntry } from '@/lib/types';

export const ACCENT_COLORS = [
  { id: 'blue', label: 'Classic Blue', hex: '#1E5FBF' },
  { id: 'graphite', label: 'Graphite', hex: '#333333' },
  { id: 'green', label: 'Forest Green', hex: '#1E8E5A' },
];

export interface ResumePreviewData {
  fullName: string;
  headline: string;
  location: string;
  phone: string;
  email: string;
  about: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  links: LinkEntry[];
}

function period(e: ExperienceEntry) {
  const start = e.startDate || '';
  const end = e.current ? 'Present' : e.endDate || '';
  return [start, end].filter(Boolean).join(' – ');
}

export default function ResumeLivePreview({ data, accent }: { data: ResumePreviewData; accent: string }) {
  const contactLine = [data.location, data.phone].filter(Boolean).join(' · ');

  return (
    <div className="text-[11px] leading-snug">
      <div className="font-bold text-[15px]" style={{ color: accent }}>{data.fullName || 'Your name'}</div>
      {data.headline && <div className="text-muted">{data.headline}</div>}
      {contactLine && <div className="text-muted text-[10px] mt-0.5">{contactLine}</div>}

      {data.about && (
        <div className="mt-3">
          <div className="text-[9px] font-bold tracking-wide uppercase mb-1" style={{ color: accent }}>Summary</div>
          <p className="text-ink/90">{data.about}</p>
        </div>
      )}

      {data.experience.length > 0 && (
        <div className="mt-3">
          <div className="text-[9px] font-bold tracking-wide uppercase mb-1" style={{ color: accent }}>Experience</div>
          <div className="flex flex-col gap-2">
            {data.experience.map((e) => (
              <div key={e.id}>
                <div className="font-semibold text-ink">{e.title || 'Role'} — {e.company || 'Company'}</div>
                <div className="text-muted text-[10px]">{period(e)}</div>
                {e.description && <p className="text-ink/80 mt-0.5">{e.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.education.length > 0 && (
        <div className="mt-3">
          <div className="text-[9px] font-bold tracking-wide uppercase mb-1" style={{ color: accent }}>Education</div>
          <div className="flex flex-col gap-1.5">
            {data.education.map((ed) => (
              <div key={ed.id}>
                <div className="font-semibold text-ink">{[ed.degree, ed.fieldOfStudy ? `in ${ed.fieldOfStudy}` : ''].filter(Boolean).join(' ') || ed.school}</div>
                <div className="text-muted text-[10px]">{ed.school}{ed.endYear ? ` · ${ed.endYear}` : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.skills.length > 0 && (
        <div className="mt-3">
          <div className="text-[9px] font-bold tracking-wide uppercase mb-1" style={{ color: accent }}>Skills</div>
          <div className="flex flex-wrap gap-1">
            {data.skills.map((s) => (
              <span key={s} className="bg-ground text-ink/80 text-[10px] px-1.5 py-0.5 rounded">{s}</span>
            ))}
          </div>
        </div>
      )}

      {data.certifications.length > 0 && (
        <div className="mt-3">
          <div className="text-[9px] font-bold tracking-wide uppercase mb-1" style={{ color: accent }}>Certifications</div>
          <div className="flex flex-col gap-0.5">
            {data.certifications.map((c) => (
              <div key={c.id} className="text-ink/90">{c.name}{c.issuer ? ` — ${c.issuer}` : ''}</div>
            ))}
          </div>
        </div>
      )}

      {data.links.length > 0 && (
        <div className="mt-3">
          <div className="text-[9px] font-bold tracking-wide uppercase mb-1" style={{ color: accent }}>Links</div>
          <div className="flex flex-col gap-0.5">
            {data.links.map((l) => (
              <div key={l.id} className="truncate" style={{ color: accent }}>{l.label || l.url}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
