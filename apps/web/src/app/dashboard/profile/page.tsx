'use client';

import { useRef, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import { useAuth, useApi, useApiUpload } from '@/lib/auth-context';
import { API_ORIGIN, ApiError, downloadFile } from '@/lib/api';
import SeekerAvatar from '@/components/SeekerAvatar';
import ResumeLivePreview, { ACCENT_COLORS, type ResumePreviewData } from '@/components/ResumeLivePreview';
import type { CertificationEntry, EducationEntry, ExperienceEntry, LinkEntry } from '@/lib/types';

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const EMPTY_EXPERIENCE = (): ExperienceEntry => ({ id: newId(), title: '', company: '', location: '', startDate: '', endDate: '', current: false, description: '' });
const EMPTY_EDUCATION = (): EducationEntry => ({ id: newId(), school: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '', description: '' });
const EMPTY_CERTIFICATION = (): CertificationEntry => ({ id: newId(), name: '', issuer: '', issueDate: '', credentialUrl: '' });
const EMPTY_LINK = (): LinkEntry => ({ id: newId(), label: 'LinkedIn', url: '' });

type SectionKey = 'contact' | 'summary' | 'experience' | 'education' | 'skills' | 'certifications' | 'video' | 'links';

interface ParsedCvFields {
  fullName?: string;
  headline?: string;
  about?: string;
  location?: string;
  yearsExperience?: number;
  skills?: string[];
  experience?: Partial<ExperienceEntry>[];
  education?: Partial<EducationEntry>[];
}

// A single "Improve with AI" panel — cycles through the suggestions
// returned by POST /me/cv/improve. Kept local to whichever field renders
// it (Summary inline below, each ExperienceEntryEditor instance) rather
// than lifted to shared state, since each field's suggestions are
// independent and never shown at the same time as another field's.
function AiImprove({ section, text, context, onUse }: { section: string; text: string; context?: string; onUse: (text: string) => void }) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  async function fetchSuggestions() {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const result = await api<{ suggestions: string[] }>('/me/cv/improve', { method: 'POST', body: { section, text, context } });
      setSuggestions(result.suggestions);
      setIndex(0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'AI suggestion failed — please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (suggestions.length === 0 && !loading) {
    return (
      <div>
        <button type="button" onClick={fetchSuggestions} className="btn-secondary h-8 text-xs flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Improve with AI
        </button>
        {error && <p className="text-xs text-danger mt-1.5">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return <p className="text-xs text-primary flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Thinking…</p>;
  }

  return (
    <div className="bg-ground rounded p-3.5">
      <div className="text-[11px] font-bold tracking-wide text-primary mb-1.5">AI SUGGESTION · {index + 1} OF {suggestions.length}</div>
      <p className="text-sm mb-2.5">{suggestions[index]}</p>
      <div className="flex items-center gap-3 text-xs font-semibold">
        <button type="button" className="text-primary" onClick={() => onUse(suggestions[index])}>Use this</button>
        {suggestions.length > 1 && (
          <button type="button" className="text-primary" onClick={() => setIndex((i) => (i + 1) % suggestions.length)}>Next suggestion</button>
        )}
        <button type="button" className="text-muted" onClick={() => setSuggestions([])}>Dismiss</button>
      </div>
    </div>
  );
}

function SectionCard({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function ExperienceEntryEditor({ entry, index, expanded, onToggle, onChange, onRemove, onMove, isFirst, isLast }: {
  entry: ExperienceEntry; index: number; expanded: boolean; onToggle: () => void;
  onChange: (patch: Partial<ExperienceEntry>) => void; onRemove: () => void;
  onMove: (dir: -1 | 1) => void; isFirst: boolean; isLast: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-1 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-4 h-4 text-muted flex-none" />
          <div className="min-w-0">
            <div className="font-semibold truncate">{entry.title || 'New role'}{entry.company ? ` · ${entry.company}` : ''}</div>
            {!expanded && <div className="text-xs text-muted">{entry.startDate}{entry.startDate || entry.endDate ? ' – ' : ''}{entry.current ? 'Present' : entry.endDate}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-none">
          <button type="button" onClick={(e) => { e.stopPropagation(); onMove(-1); }} disabled={isFirst} className="text-muted hover:text-ink disabled:opacity-30 p-1" aria-label="Move up">
            <ChevronUp className="w-4 h-4" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onMove(1); }} disabled={isLast} className="text-muted hover:text-ink disabled:opacity-30 p-1" aria-label="Move down">
            <ChevronDown className="w-4 h-4" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-danger text-xs font-semibold px-1.5">Remove</button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3.5 mt-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="label">Job title</label>
              <input className="input" value={entry.title} onChange={(e) => onChange({ title: e.target.value })} />
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" value={entry.company} onChange={(e) => onChange({ company: e.target.value })} />
            </div>
            <div>
              <label className="label">Start date</label>
              <input className="input" value={entry.startDate} onChange={(e) => onChange({ startDate: e.target.value })} placeholder="March 2021" />
            </div>
            <div>
              <label className="label">End date</label>
              <input className="input" value={entry.endDate} disabled={entry.current} onChange={(e) => onChange({ endDate: e.target.value })} placeholder={entry.current ? 'Present' : 'March 2023'} />
              <label className="flex items-center gap-2 mt-1.5 text-xs">
                <input type="checkbox" checked={!!entry.current} onChange={(e) => onChange({ current: e.target.checked, endDate: e.target.checked ? '' : entry.endDate })} />
                I currently work here
              </label>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">What you did</label>
              <span className="text-xs text-muted">{(entry.description || '').length} / 600</span>
            </div>
            <textarea
              className="input h-24"
              maxLength={600}
              value={entry.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Use numbers where you can — recruiters scan for them."
            />
          </div>
          <AiImprove
            section="experience"
            text={entry.description || ''}
            context={`${entry.title} at ${entry.company}`}
            onUse={(text) => onChange({ description: text.slice(0, 600) })}
          />
        </div>
      )}
    </div>
  );
}

export default function ResumeBuilderPage() {
  const { user, accessToken, refreshMe } = useAuth();
  const api = useApi();
  const upload = useApiUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const p = user?.seekerProfile;

  const [section, setSection] = useState<SectionKey>('contact');
  const [accent, setAccent] = useState(ACCENT_COLORS[0].hex);
  const [expandedExperience, setExpandedExperience] = useState<string | null>(p?.experience?.[0]?.id ?? null);
  const [expandedEducation, setExpandedEducation] = useState<string | null>(null);
  const [skillInput, setSkillInput] = useState('');

  const [form, setForm] = useState({
    fullName: p?.fullName || '',
    headline: p?.headline || '',
    about: p?.about || '',
    location: p?.location || '',
    phone: user?.phone || '',
    yearsExperience: p?.yearsExperience ?? '',
    expectedSalaryMin: p?.expectedSalaryMin ?? '',
    expectedSalaryMax: p?.expectedSalaryMax ?? '',
    skills: p?.skills || ([] as string[]),
    experience: p?.experience?.length ? p.experience : [],
    education: p?.education || ([] as EducationEntry[]),
    certifications: p?.certifications || ([] as CertificationEntry[]),
    links: p?.links || ([] as LinkEntry[]),
  });

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [parsingCv, setParsingCv] = useState(false);
  const [parseCvError, setParseCvError] = useState<string | null>(null);
  const [parsedCv, setParsedCv] = useState<ParsedCvFields | null>(null);
  const [downloadingCv, setDownloadingCv] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await api('/auth/me/profile', {
        method: 'POST',
        body: {
          fullName: form.fullName,
          headline: form.headline,
          about: form.about,
          location: form.location,
          phone: form.phone,
          yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
          expectedSalaryMin: form.expectedSalaryMin ? Number(form.expectedSalaryMin) : undefined,
          expectedSalaryMax: form.expectedSalaryMax ? Number(form.expectedSalaryMax) : undefined,
          skills: form.skills,
          experience: form.experience,
          education: form.education,
          certifications: form.certifications,
          links: form.links,
        },
      });
      await refreshMe();
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      await upload('/uploads/avatar', file);
      await refreshMe();
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'Upload failed — please try again.');
    } finally {
      setUploadingAvatar(false);
      if (avatarFileRef.current) avatarFileRef.current.value = '';
    }
  }

  async function onVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    setVideoError(null);
    try {
      await upload('/uploads/video-resume', file);
      await refreshMe();
    } catch (err) {
      setVideoError(err instanceof ApiError ? err.message : 'Upload failed — please try again.');
    } finally {
      setUploadingVideo(false);
      if (videoFileRef.current) videoFileRef.current.value = '';
    }
  }

  async function onResumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    setResumeError(null);
    setParsedCv(null);
    setParseCvError(null);
    try {
      await upload('/uploads/resume', file);
      await refreshMe();
    } catch (err) {
      setResumeError(err instanceof ApiError ? err.message : 'Upload failed — please try again.');
    } finally {
      setUploadingResume(false);
      if (fileRef.current) fileRef.current.value = '';
    }

    setParsingCv(true);
    try {
      const fields = await upload<ParsedCvFields>('/me/cv/parse', file);
      setParsedCv(fields);
    } catch (err) {
      setParseCvError(err instanceof ApiError ? err.message : 'Could not read your CV — please try again.');
    } finally {
      setParsingCv(false);
    }
  }

  function applyParsedCv() {
    if (!parsedCv) return;
    setForm((prev) => ({
      ...prev,
      fullName: parsedCv.fullName ?? prev.fullName,
      headline: parsedCv.headline ?? prev.headline,
      about: parsedCv.about ?? prev.about,
      location: parsedCv.location ?? prev.location,
      yearsExperience: parsedCv.yearsExperience ?? prev.yearsExperience,
      skills: parsedCv.skills?.length ? Array.from(new Set([...prev.skills, ...parsedCv.skills!])) : prev.skills,
      experience: parsedCv.experience?.length
        ? [...prev.experience, ...parsedCv.experience!.map((e) => ({ ...EMPTY_EXPERIENCE(), ...e }))]
        : prev.experience,
      education: parsedCv.education?.length
        ? [...prev.education, ...parsedCv.education!.map((ed) => ({ ...EMPTY_EDUCATION(), ...ed }))]
        : prev.education,
    }));
    setParsedCv(null);
  }

  async function downloadCv() {
    setDownloadingCv(true);
    try {
      await downloadFile('/me/cv/pdf', accessToken, 'JobCentreUganda-CV.pdf');
    } finally {
      setDownloadingCv(false);
    }
  }

  function addSkill() {
    const s = skillInput.trim();
    if (s && !form.skills.includes(s)) update('skills', [...form.skills, s]);
    setSkillInput('');
  }

  const sections: { key: SectionKey; label: string; complete: boolean }[] = [
    { key: 'contact', label: 'Contact', complete: !!(form.fullName && form.location) },
    { key: 'summary', label: 'Summary', complete: !!form.about },
    { key: 'experience', label: 'Experience', complete: form.experience.length > 0 },
    { key: 'education', label: 'Education', complete: form.education.length > 0 },
    { key: 'skills', label: 'Skills', complete: form.skills.length > 0 },
    { key: 'certifications', label: 'Certifications', complete: form.certifications.length > 0 },
    { key: 'video', label: 'Video', complete: !!p?.videoResumeUrl },
    { key: 'links', label: 'Links', complete: form.links.length > 0 },
  ];

  const previewData: ResumePreviewData = {
    fullName: form.fullName,
    headline: form.headline,
    location: form.location,
    phone: form.phone,
    email: user?.email || '',
    about: form.about,
    skills: form.skills,
    experience: form.experience,
    education: form.education,
    certifications: form.certifications,
    links: form.links,
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Resume Builder</h1>
          <p className="text-xs text-muted mt-0.5">
            {saving ? 'Saving…' : savedAt ? `✓ Saved at ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Strength: ${p?.profileStrength ?? 0}%`}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-none">
          <button className="btn-secondary lg:hidden" onClick={() => setShowPreviewMobile((v) => !v)}>
            {showPreviewMobile ? 'Hide preview' : 'Preview'}
          </button>
          <button className="btn-secondary" onClick={downloadCv} disabled={downloadingCv || !form.fullName}>
            {downloadingCv ? 'Preparing…' : '↓ Download PDF'}
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {parsedCv && (
        <div className="card p-5 mb-5 border-2 border-accent">
          <div className="flex items-center gap-2 font-semibold text-sm text-primary mb-1.5">
            <Sparkles className="w-4 h-4" /> We found some details in your CV
          </div>
          <p className="text-xs text-muted mb-3">Review, then Apply — nothing changes until you click Apply, and nothing saves until you click Save above.</p>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-secondary h-9 text-sm" onClick={() => setParsedCv(null)}>Discard</button>
            <button type="button" className="btn-primary h-9 text-sm" onClick={applyParsedCv}>Apply to form</button>
          </div>
        </div>
      )}
      {parseCvError && <div className="border border-danger bg-red-50 rounded p-3 text-xs text-danger mb-5">{parseCvError}</div>}

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <nav className="w-full lg:w-[180px] flex-none card p-3">
          <div className="text-[10px] font-bold tracking-widest text-muted px-2 pb-2">SECTIONS</div>
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-sm text-left transition-colors ${
                section === s.key ? 'bg-ground text-primary font-semibold' : 'text-ink/70 hover:bg-ground'
              }`}
            >
              <span className={s.complete ? 'text-success' : 'text-border'}>{s.complete ? '✓' : '○'}</span>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 w-full min-w-0">
          {section === 'contact' && (
            <SectionCard title="Contact">
              <div className="flex items-center gap-4 mb-4">
                <SeekerAvatar seeker={user} size={64} />
                <div>
                  <input ref={avatarFileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarChange} disabled={uploadingAvatar} className="text-sm" />
                  <div className="text-xs text-muted mt-1">PNG, JPEG or WebP, up to 2MB.</div>
                  {uploadingAvatar && <div className="text-xs text-primary mt-1">Uploading…</div>}
                  {avatarError && <div className="text-xs text-danger mt-1">{avatarError}</div>}
                </div>
              </div>
              <div className="flex flex-col gap-3.5">
                <div>
                  <label className="label">Full name</label>
                  <input className="input" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="Sarah Nakato" />
                </div>
                <div>
                  <label className="label">Headline</label>
                  <input className="input" value={form.headline} onChange={(e) => update('headline', e.target.value)} placeholder="Marketing Officer" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label">Location</label>
                    <input className="input" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Kampala" />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+256 7xx xxx xxx" />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input bg-ground" value={user?.email || ''} disabled />
                  </div>
                  <div>
                    <label className="label">Years of experience</label>
                    <input className="input" type="number" value={form.yearsExperience} onChange={(e) => update('yearsExperience', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Expected salary min (UGX)</label>
                    <input className="input" type="number" value={form.expectedSalaryMin} onChange={(e) => update('expectedSalaryMin', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Expected salary max (UGX)</label>
                    <input className="input" type="number" value={form.expectedSalaryMax} onChange={(e) => update('expectedSalaryMax', e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="border-t border-ground mt-5 pt-5">
                <div className="text-sm font-semibold mb-1">Resume file</div>
                <p className="text-xs text-muted mb-2.5">Upload a PDF or Word document to auto-fill this builder and let recruiters download it directly.</p>
                {p?.resumeFileUrl && (
                  <a href={`${API_ORIGIN}${p.resumeFileUrl}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary font-semibold block mb-2">
                    📄 {p.resumeFileName || 'Current resume'} →
                  </a>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={onResumeChange} disabled={uploadingResume} className="text-sm" />
                {uploadingResume && <div className="text-xs text-primary mt-1">Uploading…</div>}
                {resumeError && <div className="text-xs text-danger mt-1">{resumeError}</div>}
                {parsingCv && <div className="text-xs text-primary mt-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Reading your CV…</div>}
              </div>
            </SectionCard>
          )}

          {section === 'summary' && (
            <SectionCard title="Summary">
              <textarea className="input h-32 mb-3" value={form.about} onChange={(e) => update('about', e.target.value)} placeholder="2-4 sentences on who you are professionally." />
              <AiImprove section="summary" text={form.about} context={form.headline} onUse={(text) => update('about', text)} />
            </SectionCard>
          )}

          {section === 'experience' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Work experience</h2>
                <button
                  className="btn-secondary h-9 text-sm"
                  onClick={() => { const e = EMPTY_EXPERIENCE(); update('experience', [e, ...form.experience]); setExpandedExperience(e.id); }}
                >
                  + Add role
                </button>
              </div>
              {form.experience.length === 0 && <div className="card p-8 text-center text-sm text-muted">No roles added yet.</div>}
              {form.experience.map((entry, i) => (
                <ExperienceEntryEditor
                  key={entry.id}
                  entry={entry}
                  index={i}
                  expanded={expandedExperience === entry.id}
                  onToggle={() => setExpandedExperience((cur) => (cur === entry.id ? null : entry.id))}
                  onChange={(patch) => update('experience', form.experience.map((x) => (x.id === entry.id ? { ...x, ...patch } : x)))}
                  onRemove={() => update('experience', form.experience.filter((x) => x.id !== entry.id))}
                  onMove={(dir) => {
                    const arr = [...form.experience];
                    const j = i + dir;
                    if (j < 0 || j >= arr.length) return;
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                    update('experience', arr);
                  }}
                  isFirst={i === 0}
                  isLast={i === form.experience.length - 1}
                />
              ))}
            </div>
          )}

          {section === 'education' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Education</h2>
                <button
                  className="btn-secondary h-9 text-sm"
                  onClick={() => { const e = EMPTY_EDUCATION(); update('education', [e, ...form.education]); setExpandedEducation(e.id); }}
                >
                  + Add education
                </button>
              </div>
              {form.education.length === 0 && <div className="card p-8 text-center text-sm text-muted">No education added yet.</div>}
              {form.education.map((entry, i) => (
                <div key={entry.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3 mb-1 cursor-pointer" onClick={() => setExpandedEducation((cur) => (cur === entry.id ? null : entry.id))}>
                    <div className="font-semibold truncate">{entry.school || 'New institution'}{entry.degree ? ` · ${entry.degree}` : ''}</div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); update('education', form.education.filter((x) => x.id !== entry.id)); }} className="text-danger text-xs font-semibold flex-none">
                      Remove
                    </button>
                  </div>
                  {expandedEducation === entry.id && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">
                      <div className="sm:col-span-2">
                        <label className="label">School</label>
                        <input className="input" value={entry.school} onChange={(e) => update('education', form.education.map((x) => (x.id === entry.id ? { ...x, school: e.target.value } : x)))} />
                      </div>
                      <div>
                        <label className="label">Degree</label>
                        <input className="input" value={entry.degree} onChange={(e) => update('education', form.education.map((x) => (x.id === entry.id ? { ...x, degree: e.target.value } : x)))} placeholder="Bachelor's" />
                      </div>
                      <div>
                        <label className="label">Field of study</label>
                        <input className="input" value={entry.fieldOfStudy} onChange={(e) => update('education', form.education.map((x) => (x.id === entry.id ? { ...x, fieldOfStudy: e.target.value } : x)))} placeholder="Business Administration" />
                      </div>
                      <div>
                        <label className="label">Start year</label>
                        <input className="input" value={entry.startYear} onChange={(e) => update('education', form.education.map((x) => (x.id === entry.id ? { ...x, startYear: e.target.value } : x)))} placeholder="2016" />
                      </div>
                      <div>
                        <label className="label">End year</label>
                        <input className="input" value={entry.endYear} onChange={(e) => update('education', form.education.map((x) => (x.id === entry.id ? { ...x, endYear: e.target.value } : x)))} placeholder="2020" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {section === 'skills' && (
            <SectionCard title="Skills">
              <div className="flex flex-wrap gap-2 mb-3">
                {form.skills.map((s) => (
                  <span key={s} className="badge badge-blue flex items-center gap-1.5">
                    {s}
                    <button type="button" onClick={() => update('skills', form.skills.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {form.skills.length === 0 && <p className="text-sm text-muted">No skills added yet.</p>}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                  placeholder="Type a skill and press Enter"
                />
                <button className="btn-secondary" onClick={addSkill}>Add</button>
              </div>
            </SectionCard>
          )}

          {section === 'certifications' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Certifications</h2>
                <button className="btn-secondary h-9 text-sm" onClick={() => update('certifications', [EMPTY_CERTIFICATION(), ...form.certifications])}>
                  + Add certification
                </button>
              </div>
              {form.certifications.length === 0 && <div className="card p-8 text-center text-sm text-muted">No certifications added yet.</div>}
              {form.certifications.map((c) => (
                <div key={c.id} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label">Name</label>
                    <input className="input" value={c.name} onChange={(e) => update('certifications', form.certifications.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} />
                  </div>
                  <div>
                    <label className="label">Issuer</label>
                    <input className="input" value={c.issuer} onChange={(e) => update('certifications', form.certifications.map((x) => (x.id === c.id ? { ...x, issuer: e.target.value } : x)))} />
                  </div>
                  <div>
                    <label className="label">Issue date</label>
                    <input className="input" value={c.issueDate} onChange={(e) => update('certifications', form.certifications.map((x) => (x.id === c.id ? { ...x, issueDate: e.target.value } : x)))} placeholder="2023" />
                  </div>
                  <div>
                    <label className="label">Credential URL (optional)</label>
                    <input className="input" value={c.credentialUrl} onChange={(e) => update('certifications', form.certifications.map((x) => (x.id === c.id ? { ...x, credentialUrl: e.target.value } : x)))} />
                  </div>
                  <button type="button" onClick={() => update('certifications', form.certifications.filter((x) => x.id !== c.id))} className="text-danger text-xs font-semibold text-left">Remove</button>
                </div>
              ))}
            </div>
          )}

          {section === 'video' && (
            <SectionCard title="Video resume">
              <p className="text-xs text-muted mb-3">A short introduction video recruiters can watch while reviewing your application. Optional.</p>
              {p?.videoResumeUrl && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video controls className="w-full max-w-[420px] rounded-card border border-border mb-3" src={`${API_ORIGIN}${p.videoResumeUrl}`} />
              )}
              <input ref={videoFileRef} type="file" accept="video/mp4,video/webm" onChange={onVideoChange} disabled={uploadingVideo} className="text-sm" />
              <div className="text-xs text-muted mt-1">MP4 or WebM, up to 50MB.</div>
              {uploadingVideo && <div className="text-xs text-primary mt-1">Uploading…</div>}
              {videoError && <div className="text-xs text-danger mt-1">{videoError}</div>}
            </SectionCard>
          )}

          {section === 'links' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Links</h2>
                <button className="btn-secondary h-9 text-sm" onClick={() => update('links', [...form.links, EMPTY_LINK()])}>
                  + Add link
                </button>
              </div>
              {form.links.length === 0 && <div className="card p-8 text-center text-sm text-muted">No links added yet.</div>}
              {form.links.map((l) => (
                <div key={l.id} className="card p-4 flex items-center gap-3">
                  <select className="input h-10 w-[140px] flex-none" value={l.label} onChange={(e) => update('links', form.links.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))}>
                    {['LinkedIn', 'Portfolio', 'GitHub', 'Other'].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input className="input flex-1" value={l.url} onChange={(e) => update('links', form.links.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))} placeholder="https://" />
                  <button type="button" onClick={() => update('links', form.links.filter((x) => x.id !== l.id))} className="text-danger text-xs font-semibold flex-none">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`w-full lg:w-[280px] flex-none card p-5 ${showPreviewMobile ? '' : 'hidden lg:block'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-bold tracking-widest text-muted">LIVE PREVIEW</div>
            <div className="flex items-center gap-1.5">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setAccent(c.hex)}
                  aria-label={c.label}
                  className={`w-4 h-4 rounded-full border-2 ${accent === c.hex ? 'border-ink' : 'border-transparent'}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
          <ResumeLivePreview data={previewData} accent={accent} />
          <div className="text-[9px] text-muted mt-4 pt-3 border-t border-ground">
            Template: {ACCENT_COLORS.find((c) => c.hex === accent)?.label} · 1 page
          </div>
        </div>
      </div>
    </div>
  );
}
