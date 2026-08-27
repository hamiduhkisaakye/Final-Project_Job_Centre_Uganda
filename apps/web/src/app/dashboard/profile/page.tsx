'use client';

import { useRef, useState } from 'react';
import { useAuth, useApi, useApiUpload } from '@/lib/auth-context';
import { API_ORIGIN, ApiError } from '@/lib/api';
import SeekerAvatar from '@/components/SeekerAvatar';

export default function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const api = useApi();
  const upload = useApiUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const p = user?.seekerProfile;

  const [form, setForm] = useState({
    fullName: p?.fullName || '',
    headline: p?.headline || '',
    about: p?.about || '',
    location: p?.location || '',
    yearsExperience: p?.yearsExperience ?? '',
    expectedSalaryMin: p?.expectedSalaryMin ?? '',
    expectedSalaryMax: p?.expectedSalaryMax ?? '',
    skills: (p?.skills || []).join(', '),
    resumeText: p?.resumeText || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await api('/auth/me/profile', {
      method: 'POST',
      body: {
        fullName: form.fullName,
        headline: form.headline,
        about: form.about,
        location: form.location,
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
        expectedSalaryMin: form.expectedSalaryMin ? Number(form.expectedSalaryMin) : undefined,
        expectedSalaryMax: form.expectedSalaryMax ? Number(form.expectedSalaryMax) : undefined,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        resumeText: form.resumeText,
      },
    });
    await refreshMe();
    setSaving(false);
    setSaved(true);
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
    try {
      await upload('/uploads/resume', file);
      await refreshMe();
    } catch (err) {
      setResumeError(err instanceof ApiError ? err.message : 'Upload failed — please try again.');
    } finally {
      setUploadingResume(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="max-w-[720px]">
      <h1 className="text-2xl font-bold mb-1">Resume & Profile</h1>
      <p className="text-sm text-muted mb-5">
        This powers your AI match score and what recruiters see. Strength: {p?.profileStrength ?? 0}%
      </p>

      <div className="card p-6 mb-5 flex items-center gap-4">
        <SeekerAvatar seeker={user} size={72} />
        <div>
          <div className="text-sm font-semibold mb-1">Profile photo</div>
          <p className="text-xs text-muted mb-2">A professional headshot helps recruiters recognize you in chat and applications.</p>
          <input ref={avatarFileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarChange} disabled={uploadingAvatar} className="text-sm" />
          <div className="text-xs text-muted mt-1">PNG, JPEG or WebP, up to 2MB.</div>
          {uploadingAvatar && <div className="text-xs text-primary mt-1">Uploading…</div>}
          {avatarError && <div className="text-xs text-danger mt-1">{avatarError}</div>}
        </div>
      </div>

      <form onSubmit={save} className="card p-6 flex flex-col gap-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Sarah Nakato" />
          <p className="text-xs text-muted mt-1">Your real name — shown to recruiters in chat and on applications.</p>
        </div>
        <div>
          <label className="label">Headline</label>
          <input className="input" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="Marketing Officer" />
          <p className="text-xs text-muted mt-1">A short professional tagline, not your name — shown under your name on job cards.</p>
        </div>
        <div>
          <label className="label">About</label>
          <textarea className="input h-24" value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Kampala" />
          </div>
          <div>
            <label className="label">Years of experience</label>
            <input className="input" type="number" value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })} />
          </div>
          <div>
            <label className="label">Expected salary min (UGX)</label>
            <input className="input" type="number" value={form.expectedSalaryMin} onChange={(e) => setForm({ ...form, expectedSalaryMin: e.target.value })} />
          </div>
          <div>
            <label className="label">Expected salary max (UGX)</label>
            <input className="input" type="number" value={form.expectedSalaryMax} onChange={(e) => setForm({ ...form, expectedSalaryMax: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Skills (comma-separated)</label>
          <input className="input" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Brand strategy, Campaign management" />
        </div>
        <div>
          <label className="label">Resume summary</label>
          <textarea className="input h-32" value={form.resumeText} onChange={(e) => setForm({ ...form, resumeText: e.target.value })} placeholder="Paste or write a short summary of your work history…" />
          <p className="text-xs text-muted mt-1">This text — not the file below — is what powers your AI match score.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
          {saved && <span className="text-sm text-success">Saved</span>}
        </div>
      </form>

      <div className="card p-6 mt-5">
        <div className="text-sm font-semibold mb-1">Resume file</div>
        <p className="text-xs text-muted mb-3">Upload a PDF or Word document so recruiters can download it directly. Optional — it doesn&apos;t affect your match score.</p>
        {p?.resumeFileUrl && (
          <a href={`${API_ORIGIN}${p.resumeFileUrl}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary font-semibold block mb-2">
            📄 {p.resumeFileName || 'Current resume'} →
          </a>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={onResumeChange} disabled={uploadingResume} className="text-sm" />
        <div className="text-xs text-muted mt-1">PDF or Word, up to 5MB.</div>
        {uploadingResume && <div className="text-xs text-primary mt-1">Uploading…</div>}
        {resumeError && <div className="text-xs text-danger mt-1">{resumeError}</div>}
      </div>

      <div className="card p-6 mt-5">
        <div className="text-sm font-semibold mb-1">Video resume</div>
        <p className="text-xs text-muted mb-3">A short introduction video recruiters can watch while reviewing your application. Optional.</p>
        {p?.videoResumeUrl && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video controls className="w-full max-w-[420px] rounded-card border border-border mb-3" src={`${API_ORIGIN}${p.videoResumeUrl}`} />
        )}
        <input ref={videoFileRef} type="file" accept="video/mp4,video/webm" onChange={onVideoChange} disabled={uploadingVideo} className="text-sm" />
        <div className="text-xs text-muted mt-1">MP4 or WebM, up to 50MB.</div>
        {uploadingVideo && <div className="text-xs text-primary mt-1">Uploading…</div>}
        {videoError && <div className="text-xs text-danger mt-1">{videoError}</div>}
      </div>
    </div>
  );
}
