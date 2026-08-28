'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import type { Assessment, Category } from '@/lib/types';

const STEPS = ['Job details', 'Requirements', 'Salary & screening', 'Preview & publish'];
const TYPES = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'REMOTE', label: 'Remote' },
];

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
  salaryDisclosed: boolean;
  assessmentId: string;
}

const EMPTY: FormState = {
  title: '', category: '', employmentType: 'FULL_TIME', location: '', seniority: 'Mid-level',
  description: '', responsibilities: '', requirements: '', skills: '',
  salaryMin: '', salaryMax: '', salaryDisclosed: true, assessmentId: '',
};

export default function PostJobPage() {
  const api = useApi();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api<Assessment[]>('/company/assessments').then(setAssessments).catch(() => undefined);
    api<Category[]>('/categories').then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setForm((f) => (f.category ? f : { ...f, category: cats[0].name }));
    }).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      salaryDisclosed: form.salaryDisclosed,
      assessmentId: form.assessmentId || undefined,
    };
  }

  async function saveDraft() {
    setBusy(true);
    setError(null);
    try {
      const job = await api<{ id: string }>('/jobs', { method: 'POST', body: buildPayload() });
      router.push('/company/manage-jobs');
      return job;
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
      const job = await api<{ id: string }>('/jobs', { method: 'POST', body: buildPayload() });
      await api(`/jobs/${job.id}/publish`, { method: 'POST' });
      router.push('/company/manage-jobs');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const canAdvance = step === 0 ? form.title && form.location : true;

  return (
    <div className="max-w-[820px] mx-auto">
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
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Salary &amp; screening</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label">Minimum (UGX / month)</label>
                <input className="input" type="number" value={form.salaryMin} onChange={(e) => update('salaryMin', e.target.value)} />
              </div>
              <div>
                <label className="label">Maximum (UGX / month)</label>
                <input className="input" type="number" value={form.salaryMax} onChange={(e) => update('salaryMax', e.target.value)} />
              </div>
            </div>
            <div className="bg-ground rounded p-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.salaryDisclosed} onChange={(e) => update('salaryDisclosed', e.target.checked)} />
                <span className="font-semibold text-sm">Show this salary range publicly</span>
              </label>
              <p className="text-xs text-muted mt-1.5 ml-6">Jobs with a visible range receive significantly more applications.</p>
            </div>
            <div>
              <label className="label">Skills assessment (optional)</label>
              <select className="input" value={form.assessmentId} onChange={(e) => update('assessmentId', e.target.value)}>
                <option value="">No assessment required</option>
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1.5">
                {assessments.length === 0 ? (
                  <>You have no assessments yet. <Link href="/company/assessments" className="text-primary font-semibold">Create one →</Link></>
                ) : (
                  'Applicants must pass this assessment before they can apply.'
                )}
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Preview</h2>
            <div className="border border-border rounded p-5">
              <div className="text-2xl font-bold">{form.title || 'Untitled role'}</div>
              <div className="text-sm text-muted mb-3">{form.location} · {TYPES.find((t) => t.value === form.employmentType)?.label} · {form.category}</div>
              <div className="text-primary font-semibold mb-3">
                {form.salaryDisclosed && form.salaryMin && form.salaryMax
                  ? `UGX ${Number(form.salaryMin).toLocaleString()} – ${Number(form.salaryMax).toLocaleString()} / month`
                  : 'Salary not disclosed'}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line">{form.description}</p>
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
