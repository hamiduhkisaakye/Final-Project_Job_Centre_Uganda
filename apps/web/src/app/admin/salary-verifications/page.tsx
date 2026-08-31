'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';
import { API_ORIGIN, ApiError } from '@/lib/api';
import type { SalaryVerificationRequest, SalaryVerificationStatus } from '@/lib/types';

export default function AdminSalaryVerificationsPage() {
  const api = useApi();
  const { promptDialog, alertDialog } = useDialog();
  const [requests, setRequests] = useState<SalaryVerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SalaryVerificationStatus>('PENDING');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api<SalaryVerificationRequest[]>(`/admin/salary-verifications?status=${filter}`).then(setRequests).finally(() => setLoading(false));
  }
  useEffect(load, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(id: string) {
    setBusyId(id);
    try {
      await api(`/admin/salary-verifications/${id}/approve`, { method: 'POST' });
      load();
    } catch (err) {
      await alertDialog(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = await promptDialog('Why is this evidence being rejected?', '', { required: true, confirmLabel: 'Reject' });
    if (!reason) return;
    setBusyId(id);
    try {
      await api(`/admin/salary-verifications/${id}/reject`, { method: 'POST', body: { reason } });
      load();
    } catch (err) {
      await alertDialog(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Salary Verifications</h1>
          <p className="text-sm text-muted mt-1">Review payroll/offer-letter evidence companies submit to earn a verified-salary badge.</p>
        </div>
        <div className="flex items-center border border-border rounded overflow-hidden flex-none">
          {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-9 px-3.5 text-sm font-semibold transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-white text-muted hover:text-ink'}`}
            >
              {f[0] + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No {filter.toLowerCase()} requests.</div>
      ) : (
        <div className="flex flex-col gap-3 max-w-[820px]">
          {requests.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="font-semibold">{r.job?.title} · {r.company?.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {r.job?.salaryMin && r.job?.salaryMax
                      ? `${r.job.salaryCurrency} ${r.job.salaryMin.toLocaleString()} – ${r.job.salaryMax.toLocaleString()} / ${r.job.salaryPeriod} · `
                      : ''}
                    Submitted {new Date(r.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })} · {r.comparableHires} comparable hire{r.comparableHires === 1 ? '' : 's'} on record
                  </div>
                </div>
                <span className={`badge flex-none ${r.status === 'PENDING' ? 'badge-yellow' : r.status === 'APPROVED' ? 'badge-green' : 'badge-grey'}`}>{r.status}</span>
              </div>
              {r.note && <p className="text-sm leading-relaxed bg-ground rounded p-3 mb-2">{r.note}</p>}
              {r.status === 'REJECTED' && r.rejectionReason && <p className="text-xs text-danger mb-2">Rejected: {r.rejectionReason}</p>}
              <a href={`${API_ORIGIN}${r.evidenceUrl}`} target="_blank" rel="noreferrer" className="text-primary text-sm font-semibold">
                View evidence ({r.evidenceName}) →
              </a>
              {r.status === 'PENDING' && (
                <div className="flex gap-2 mt-3">
                  <button className="btn-danger h-9 text-sm" disabled={busyId === r.id} onClick={() => reject(r.id)}>Reject</button>
                  <button className="btn-primary h-9 text-sm" disabled={busyId === r.id} onClick={() => approve(r.id)}>
                    {busyId === r.id ? 'Working…' : 'Approve'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
