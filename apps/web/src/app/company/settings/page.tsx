'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth, useApi, useApiUpload } from '@/lib/auth-context';
import { API_ORIGIN, ApiError } from '@/lib/api';
import type { Company } from '@/lib/types';

export default function CompanySettingsPage() {
  const { refreshMe } = useAuth();
  const api = useApi();
  const upload = useApiUpload();
  const fileRef = useRef<HTMLInputElement>(null);

  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', industry: '', sizeBand: '', website: '', hqLocation: '', about: '', foundedYear: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    api<Company>('/companies/me')
      .then((c) => {
        setCompany(c);
        setForm({
          name: c.name || '',
          industry: c.industry || '',
          sizeBand: c.sizeBand || '',
          website: c.website || '',
          hqLocation: c.hqLocation || '',
          about: c.about || '',
          foundedYear: c.foundedYear ? String(c.foundedYear) : '',
        });
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const body = { ...form, foundedYear: form.foundedYear ? Number(form.foundedYear) : undefined };
      const updated = await api<Company>(`/companies/${company.id}`, { method: 'PATCH', body });
      setCompany(updated);
      await refreshMe();
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Save failed — please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !company) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const { logoUrl } = await upload<{ logoUrl: string }>('/uploads/company-logo', file);
      setCompany({ ...company, logoUrl });
      await refreshMe();
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : 'Upload failed — please try again.');
    } finally {
      setUploadingLogo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="max-w-[720px]">
      <h1 className="text-2xl font-bold mb-1">Settings & Branding</h1>
      <p className="text-sm text-muted mb-5">Your logo and profile appear on every job listing and your public company page.</p>

      <div className="card p-6 mb-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded bg-ground flex items-center justify-center overflow-hidden flex-none">
          {company?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${API_ORIGIN}${company.logoUrl}`} alt="Company logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary font-bold">{company?.name?.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div>
          <div className="text-sm font-semibold mb-1">Company logo</div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogoChange} disabled={uploadingLogo} className="text-sm" />
          <div className="text-xs text-muted mt-1">PNG, JPEG or WebP, up to 2MB.</div>
          {uploadingLogo && <div className="text-xs text-primary mt-1">Uploading…</div>}
          {logoError && <div className="text-xs text-danger mt-1">{logoError}</div>}
        </div>
      </div>

      <form onSubmit={save} className="card p-6 flex flex-col gap-4">
        <div>
          <label className="label">Company name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="label">Industry</label>
            <input className="input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>
          <div>
            <label className="label">Company size</label>
            <input className="input" value={form.sizeBand} onChange={(e) => setForm({ ...form, sizeBand: e.target.value })} placeholder="e.g. 200-1,000" />
          </div>
          <div>
            <label className="label">Website</label>
            <input className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
          </div>
          <div>
            <label className="label">HQ location</label>
            <input className="input" value={form.hqLocation} onChange={(e) => setForm({ ...form, hqLocation: e.target.value })} placeholder="Kampala, Uganda" />
          </div>
          <div>
            <label className="label">Founded year</label>
            <input className="input" type="number" min={1800} max={new Date().getFullYear()} value={form.foundedYear} onChange={(e) => setForm({ ...form, foundedYear: e.target.value })} placeholder="e.g. 1906" />
          </div>
        </div>
        <div>
          <label className="label">About</label>
          <textarea className="input h-28" value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          {saved && <span className="text-sm text-success">Saved</span>}
          {saveError && <span className="text-sm text-danger">{saveError}</span>}
        </div>
      </form>
    </div>
  );
}
