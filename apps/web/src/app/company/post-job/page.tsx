'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi, useApiUpload } from '@/lib/auth-context';
import { API_ORIGIN, ApiError } from '@/lib/api';
import type { Assessment, Category, Job, ScreeningQuestion, SalaryVerificationRequest } from '@/lib/types';

const STEPS = ['Job details', 'Requirements', 'Salary & screening', 'Preview & publish'];
const TYPES = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'REMOTE', label: 'Remote' },
];
const CURRENCIES = ['UGX', 'USD', 'KES', 'EUR', 'GBP'];
const PERIODS = [
  { value: 'month', label: '/ month' },
  { value: 'year', label: '/ year' },
  { value: 'day', label: '/ day' },
  { value: 'hour', label: '/ hour' },
];
const MAX_SCREENING_QUESTIONS = 3;

interface FormState {
  title: string;
  category: string;
  employmentType: string;
  location: string;
  seniority: string;
  description: string;
  responsibilities: string;
  requirements: string;
  skills: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryPeriod: string;
  salaryDisclosed: boolean;
  assessmentId: string;
  expiresAt: string;
  requireVideoResume: boolean;
  screeningQuestions: ScreeningQuestion[];
}

const EMPTY: FormState = {
  title: '', category: '', employmentType: 'FULL_TIME', location: '', seniority: 'Mid-level',
  description: '', responsibilities: '', requirements: '', skills: '',
  salaryMin: '', salaryMax: '', salaryCurrency: 'UGX', salaryPeriod: 'month', salaryDisclosed: true,
  assessmentId: '', expiresAt: '', requireVideoResume: false, screeningQuestions: [],
};

function newQuestion(): ScreeningQuestion {
  return { id: `q-${Date.now()}-${Math.round(Math.random() * 1e6)}`, text: '', type: 'YES_NO', knockout: false };
}

function Toggle({ checked, onChange, label, sublabel }: { checked: boolean; onChange: (v: boolean) => void; label: string; sublabel?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-10 h-6 rounded-full flex-none relative transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </button>
      <span>
        <span className="font-semibold text-sm block">{label}</span>
        {sublabel && <span className="text-xs text-muted">{sublabel}</span>}
      </span>
    </label>
  );
}

function relativeSeconds(from: Date, now: number) {
  const secs = Math.max(0, Math.round((now - from.getTime()) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs} seconds ago`;
  const mins = Math.round(secs / 60);
  return `${mins} minute${mins === 1 ? '' : 's'} ago`;
}

export default function PostJobPage() {
  const api = useApi();
  const upload = useApiUpload();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [jobId, setJobId] = useState<string | null>(null);
  const [savedJob, setSavedJob] = useState<Job | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const jobIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const [verifications, setVerifications] = useState<SalaryVerificationRequest[]>([]);
  const [evidenceFile, setEvidenceFile] = useState<{ evidenceUrl: string; evidenceName: string } | null>(null);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    api<Assessment[]>('/company/assessments').then(setAssessments).catch(() => undefined);
    api<Category[]>('/categories').then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setForm((f) => (f.category ? f : { ...f, category: cats[0].name }));
    }).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function buildPayload() {
    return {
      title: form.title,
      category: form.category,
      employmentType: form.employmentType,
      location: form.location,
      seniority: form.seniority,
      description: form.description,
      responsibilities: form.responsibilities.split('\n').map((s) => s.trim()).filter(Boolean),
      requirements: form.requirements.split('\n').map((s) => s.trim()).filter(Boolean),
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
      salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
      salaryCurrency: form.salaryCurrency,
      salaryPeriod: form.salaryPeriod,
      salaryDisclosed: form.salaryDisclosed,
      assessmentId: form.assessmentId || undefined,
      expiresAt: form.expiresAt || undefined,
      requireVideoResume: form.requireVideoResume,
      screeningQuestions: form.screeningQuestions.map((q) => ({ ...q, text: q.text.trim() })).filter((q) => q.text),
    };
  }

  // Creates the draft on the first meaningful save, then PATCHes it on every
  // change after — so "Save as draft"/"Submit for review" at the end never
  // double-create a job, they just flush whatever autosave hasn't yet.
  async function persist() {
    if (savingRef.current) return jobIdRef.current;
    savingRef.current = true;
    setSaveStatus('saving');
    try {
      let job: Job;
      if (!jobIdRef.current) {
        job = await api<Job>('/jobs', { method: 'POST', body: buildPayload() });
        jobIdRef.current = job.id;
        setJobId(job.id);
      } else {
        job = await api<Job>(`/jobs/${jobIdRef.current}`, { method: 'PATCH', body: buildPayload() });
      }
      setSavedJob(job);
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      return jobIdRef.current;
    } catch {
      setSaveStatus('error');
      return jobIdRef.current;
    } finally {
      savingRef.current = false;
    }
  }

  // Debounced autosave — fires 1.5s after the last edit, once there's
  // enough on the form for a job to legitimately be created (title +
  // location, same minimum this page already required to advance step 1).
  useEffect(() => {
    if (!form.title.trim() || !form.location.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { persist(); }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function loadVerifications(id: string) {
    api<SalaryVerificationRequest[]>(`/company/jobs/${id}/salary-verification`).then(setVerifications).catch(() => undefined);
  }

  useEffect(() => {
    if (jobId) loadVerifications(jobId);
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveDraft() {
    setBusy(true);
    setError(null);
    try {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      await persist();
      router.push('/company/manage-jobs');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    setBusy(true);
    setError(null);
    try {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const id = await persist();
      if (!id) throw new Error('Could not save this job');
      await api(`/jobs/${id}/publish`, { method: 'POST' });
      router.push('/company/manage-jobs');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function onEvidencePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEvidenceUploading(true);
    setVerificationError(null);
    try {
      const res = await upload<{ evidenceUrl: string; evidenceName: string }>('/uploads/salary-evidence', file);
      setEvidenceFile(res);
    } catch (err) {
      setVerificationError(err instanceof ApiError ? err.message : 'Upload failed — please try again');
    } finally {
      setEvidenceUploading(false);
      e.target.value = '';
    }
  }

  async function submitVerification() {
    if (!jobId || !evidenceFile) return;
    setVerificationBusy(true);
    setVerificationError(null);
    try {
      await api(`/company/jobs/${jobId}/salary-verification`, {
        method: 'POST',
        body: { ...evidenceFile, note: evidenceNote || undefined },
      });
      setEvidenceFile(null);
      setEvidenceNote('');
      loadVerifications(jobId);
    } catch (err) {
      setVerificationError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setVerificationBusy(false);
    }
  }

  function addScreeningQuestion() {
    if (form.screeningQuestions.length >= MAX_SCREENING_QUESTIONS) return;
    update('screeningQuestions', [...form.screeningQuestions, newQuestion()]);
  }

  function updateScreeningQuestion(id: string, patch: Partial<ScreeningQuestion>) {
    update('screeningQuestions', form.screeningQuestions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function removeScreeningQuestion(id: string) {
    update('screeningQuestions', form.screeningQuestions.filter((q) => q.id !== id));
  }

  function moveScreeningQuestion(id: string, dir: -1 | 1) {
    const qs = [...form.screeningQuestions];
    const i = qs.findIndex((q) => q.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    update('screeningQuestions', qs);
  }

  const canAdvance = step === 0 ? form.title && form.location : true;
  const latestVerification = verifications[0];
  const isSalaryVerified = !!savedJob?.salaryVerifiedAt && !!savedJob.salaryVerificationExpiresAt && new Date(savedJob.salaryVerificationExpiresAt) > new Date();
  const approvedVerification = verifications.find((v) => v.status === 'APPROVED');

  const saveStatusText =
    saveStatus === 'saving' ? 'Saving…'
      : saveStatus === 'error' ? 'Could not save — will retry on your next edit'
        : lastSavedAt ? `Draft saved ${relativeSeconds(lastSavedAt, now)}`
          : jobId ? 'All changes saved'
            : 'Not saved yet — add a title and location to start a draft';

  return (
    <div className="max-w-[820px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-lg font-bold truncate">{form.title || 'Post a Job'}</div>
          {form.title && <div className="text-xs text-muted">Draft</div>}
        </div>
        <div className={`text-xs font-medium flex-none ${saveStatus === 'error' ? 'text-danger' : 'text-muted'}`}>{saveStatusText}</div>
      </div>

      <div className="flex items-center mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 flex items-center">
            <div className="flex flex-col items-center gap-1.5 flex-none">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                  i < step ? 'bg-primary text-white' : i === step ? 'bg-accent text-ink' : 'bg-border text-muted'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-semibold text-center ${i === step ? '' : 'text-muted'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-2 mb-5 ${i < step ? 'bg-primary' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      <div className="card p-7">
        {error && <div className="border border-danger bg-red-50 rounded p-3 text-sm text-danger mb-4">{error}</div>}

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Job details</h2>
            <div>
              <label className="label">Job title</label>
              <input className="input" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Senior Marketing Officer" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={(e) => update('category', e.target.value)}>
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Employment type</label>
                <select className="input" value={form.employmentType} onChange={(e) => update('employmentType', e.target.value)}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Kampala" />
              </div>
              <div>
                <label className="label">Seniority</label>
                <input className="input" value={form.seniority} onChange={(e) => update('seniority', e.target.value)} placeholder="Mid-level" />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input h-32" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="What will this person do day to day?" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Requirements</h2>
            <div>
              <label className="label">Responsibilities (one per line)</label>
              <textarea className="input h-28" value={form.responsibilities} onChange={(e) => update('responsibilities', e.target.value)} />
            </div>
            <div>
              <label className="label">Requirements (one per line)</label>
              <textarea className="input h-28" value={form.requirements} onChange={(e) => update('requirements', e.target.value)} />
            </div>
            <div>
              <label className="label">Required skills (comma-separated)</label>
              <input className="input" value={form.skills} onChange={(e) => update('skills', e.target.value)} placeholder="Brand strategy, Campaign management" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <h2 className="text-xl font-semibold -mb-2">Salary &amp; screening</h2>

            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="label">Currency</label>
                  <select className="input" value={form.salaryCurrency} onChange={(e) => update('salaryCurrency', e.target.value)}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Per</label>
                  <select className="input" value={form.salaryPeriod} onChange={(e) => update('salaryPeriod', e.target.value)}>
                    {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label.replace('/ ', '')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Minimum</label>
                  <input className="input" type="number" value={form.salaryMin} onChange={(e) => update('salaryMin', e.target.value)} />
                </div>
                <div>
                  <label className="label">Maximum</label>
                  <input className="input" type="number" value={form.salaryMax} onChange={(e) => update('salaryMax', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="bg-ground rounded p-4">
              <Toggle
                checked={form.salaryDisclosed}
                onChange={(v) => update('salaryDisclosed', v)}
                label="Show this salary range publicly"
                sublabel="Jobs with a visible range receive significantly more applications."
              />
            </div>

            <div className="border border-border rounded p-4">
              <div className="font-semibold text-sm mb-2">Verified salary</div>
              {isSalaryVerified && approvedVerification ? (
                <div className="flex items-start gap-2.5">
                  <span className="badge badge-green flex-none">✓ Verified</span>
                  <p className="text-sm text-muted leading-relaxed">
                    Verified until {new Date(savedJob!.salaryVerificationExpiresAt!).toLocaleDateString('en-GB', { dateStyle: 'medium' })}, based on payroll evidence
                    {approvedVerification.comparableHires > 0 ? ` for ${approvedVerification.comparableHires} comparable hire${approvedVerification.comparableHires === 1 ? '' : 's'}` : ''}.{' '}
                    <a href={`${API_ORIGIN}${approvedVerification.evidenceUrl}`} target="_blank" rel="noreferrer" className="text-primary font-semibold">View evidence →</a>
                  </p>
                </div>
              ) : latestVerification?.status === 'PENDING' ? (
                <div className="flex items-start gap-2.5">
                  <span className="badge badge-yellow flex-none">Pending review</span>
                  <p className="text-sm text-muted">Submitted {new Date(latestVerification.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })} — an admin will review your evidence shortly.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {latestVerification?.status === 'REJECTED' && (
                    <p className="text-xs text-danger">Your last submission was rejected{latestVerification.rejectionReason ? `: ${latestVerification.rejectionReason}` : '.'} You can submit again below.</p>
                  )}
                  <p className="text-xs text-muted">Upload payroll or offer-letter evidence for this role&apos;s salary range to earn a verified badge once an admin reviews it.</p>
                  {!jobId ? (
                    <p className="text-xs text-muted italic">Add a title and location first — verification is tied to this job&apos;s draft.</p>
                  ) : (
                    <>
                      {verificationError && <p className="text-xs text-danger">{verificationError}</p>}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <label className="btn-secondary h-9 text-sm cursor-pointer">
                          {evidenceUploading ? 'Uploading…' : evidenceFile ? 'Replace file' : 'Attach evidence (PDF/image)'}
                          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={onEvidencePick} disabled={evidenceUploading} />
                        </label>
                        {evidenceFile && <span className="text-xs text-muted">{evidenceFile.evidenceName}</span>}
                      </div>
                      <input className="input h-9 text-sm" placeholder="Note for the reviewer (optional)" value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} />
                      <button className="btn-primary h-9 text-sm w-fit" disabled={!evidenceFile || verificationBusy} onClick={submitVerification}>
                        {verificationBusy ? 'Submitting…' : 'Submit for salary verification'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="label">Skills assessment (optional)</label>
              {assessments.length === 0 ? (
                <p className="text-xs text-muted mt-1.5">
                  You have no assessments yet. <Link href="/company/assessments" className="text-primary font-semibold">Create one →</Link>
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => update('assessmentId', '')}
                    className={`text-left rounded-card border p-3.5 transition-colors ${!form.assessmentId ? 'border-primary bg-ground' : 'border-border hover:border-primary/40'}`}
                  >
                    <div className="font-semibold text-sm">No assessment required</div>
                    <div className="text-xs text-muted mt-1">Anyone can apply without taking a test.</div>
                  </button>
                  {assessments.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => update('assessmentId', a.id)}
                      className={`text-left rounded-card border p-3.5 transition-colors ${form.assessmentId === a.id ? 'border-primary bg-ground' : 'border-border hover:border-primary/40'}`}
                    >
                      <div className="font-semibold text-sm">{a.title}</div>
                      {a.description && <div className="text-xs text-muted mt-1 line-clamp-2">{a.description}</div>}
                      <div className="flex items-center gap-2 text-xs text-muted mt-2">
                        <span>{a.questions.length} question{a.questions.length === 1 ? '' : 's'}</span>
                        <span>·</span>
                        <span>Pass at {a.passScore}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {assessments.length > 0 && <p className="text-xs text-muted mt-2">Applicants must pass the selected assessment before they can apply.</p>}
            </div>

            <div className="bg-ground rounded p-4">
              <Toggle
                checked={form.requireVideoResume}
                onChange={(v) => update('requireVideoResume', v)}
                label="Require a video resume"
                sublabel="Applicants must have a short video resume on their profile (30 seconds or less recommended) before they can apply."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0">Screening questions (optional)</label>
                <span className="text-xs text-muted">{form.screeningQuestions.length} of {MAX_SCREENING_QUESTIONS} used</span>
              </div>
              <div className="flex flex-col gap-3">
                {form.screeningQuestions.map((q, i) => (
                  <div key={q.id} className="border border-border rounded p-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className="flex-1 flex flex-col gap-2.5">
                        <input
                          className="input h-9"
                          placeholder={`Question ${i + 1}, e.g. "Do you have a valid driving permit?"`}
                          value={q.text}
                          onChange={(e) => updateScreeningQuestion(q.id, { text: e.target.value })}
                        />
                        <div className="flex items-center gap-3 flex-wrap">
                          <select
                            className="input h-9 w-auto text-sm"
                            value={q.type}
                            onChange={(e) => updateScreeningQuestion(q.id, { type: e.target.value as ScreeningQuestion['type'], knockout: e.target.value === 'YES_NO' ? q.knockout : false })}
                          >
                            <option value="YES_NO">Yes / No</option>
                            <option value="SHORT_TEXT">Short text</option>
                          </select>
                          {q.type === 'YES_NO' && (
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input type="checkbox" checked={q.knockout} onChange={(e) => updateScreeningQuestion(q.id, { knockout: e.target.checked, requiredAnswer: e.target.checked ? (q.requiredAnswer || 'YES') : undefined })} />
                              Knock-out
                            </label>
                          )}
                          {q.type === 'YES_NO' && q.knockout && (
                            <select
                              className="input h-9 w-auto text-sm"
                              value={q.requiredAnswer || 'YES'}
                              onChange={(e) => updateScreeningQuestion(q.id, { requiredAnswer: e.target.value as 'YES' | 'NO' })}
                            >
                              <option value="YES">Required answer: Yes</option>
                              <option value="NO">Required answer: No</option>
                            </select>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 flex-none">
                        <button type="button" className="text-muted text-xs disabled:opacity-30" disabled={i === 0} onClick={() => moveScreeningQuestion(q.id, -1)} aria-label="Move up">▲</button>
                        <button type="button" className="text-muted text-xs disabled:opacity-30" disabled={i === form.screeningQuestions.length - 1} onClick={() => moveScreeningQuestion(q.id, 1)} aria-label="Move down">▼</button>
                        <button type="button" className="text-danger text-xs" onClick={() => removeScreeningQuestion(q.id)} aria-label="Remove">✕</button>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary h-9 text-sm w-fit"
                  disabled={form.screeningQuestions.length >= MAX_SCREENING_QUESTIONS}
                  onClick={addScreeningQuestion}
                >
                  + Add question
                </button>
              </div>
              <p className="text-xs text-muted mt-1.5">A knock-out question with a mismatched answer stops an applicant from submitting — they&apos;ll see which requirement they didn&apos;t meet.</p>
            </div>

            <div className="max-w-[220px]">
              <label className="label">Applications close on (optional)</label>
              <input className="input" type="date" value={form.expiresAt} onChange={(e) => update('expiresAt', e.target.value)} />
              <p className="text-xs text-muted mt-1.5">Shown to candidates as &ldquo;Closes in N days&rdquo;. Leave blank for no deadline.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Preview</h2>
            <div className="border border-border rounded p-5">
              <div className="text-2xl font-bold">{form.title || 'Untitled role'}</div>
              <div className="text-sm text-muted mb-3">{form.location} · {TYPES.find((t) => t.value === form.employmentType)?.label} · {form.category}</div>
              <div className="text-primary font-semibold mb-3 flex items-center gap-2">
                {form.salaryDisclosed && form.salaryMin && form.salaryMax
                  ? `${form.salaryCurrency} ${Number(form.salaryMin).toLocaleString()} – ${Number(form.salaryMax).toLocaleString()} ${PERIODS.find((p) => p.value === form.salaryPeriod)?.label}`
                  : 'Salary not disclosed'}
                {isSalaryVerified && <span className="badge badge-green">✓ Verified</span>}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line">{form.description}</p>
              {(form.assessmentId || form.requireVideoResume || form.screeningQuestions.length > 0) && (
                <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t border-ground text-xs text-muted">
                  {form.assessmentId && <div>📝 Requires passing: {assessments.find((a) => a.id === form.assessmentId)?.title}</div>}
                  {form.requireVideoResume && <div>🎥 Requires a video resume</div>}
                  {form.screeningQuestions.filter((q) => q.text.trim()).length > 0 && (
                    <div>❓ {form.screeningQuestions.filter((q) => q.text.trim()).length} screening question{form.screeningQuestions.length === 1 ? '' : 's'} ({form.screeningQuestions.filter((q) => q.knockout).length} knock-out)</div>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted mt-3">Submitting sends this job to admin moderation — it usually clears within a couple of hours.</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-7 pt-5 border-t border-ground">
          <button className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← Back</button>
          <div className="flex gap-2.5">
            {step === STEPS.length - 1 ? (
              <>
                <button className="btn-secondary" disabled={busy} onClick={saveDraft}>Save as draft</button>
                <button className="btn-primary" disabled={busy} onClick={submitForReview}>
                  {busy ? 'Submitting…' : 'Submit for review'}
                </button>
              </>
            ) : (
              <button className="btn-primary" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
