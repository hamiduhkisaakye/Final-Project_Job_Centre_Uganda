'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/auth-context';

type Tab = 'JOB_SEEKER' | 'COMPANY' | 'COMPANIES';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  companyMemberships?: { company: { name: string; slug: string } }[];
}
interface AdminCompany {
  id: string;
  name: string;
  slug: string;
  verificationStatus: string;
  _count: { jobs: number };
}

const USER_STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'badge-green', PENDING: 'badge-yellow', SUSPENDED: 'bg-red-50 text-danger', DELETED: 'badge-grey',
};
const VERIFY_STYLE: Record<string, string> = {
  VERIFIED: 'badge-green', PENDING: 'badge-yellow', UNVERIFIED: 'badge-grey', REJECTED: 'bg-red-50 text-danger',
};

export default function AdminUsersPage() {
  const api = useApi();
  const [tab, setTab] = useState<Tab>('JOB_SEEKER');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    if (tab === 'COMPANIES') {
      api<AdminCompany[]>('/admin/companies').then(setCompanies).finally(() => setLoading(false));
    } else {
      api<AdminUser[]>(`/admin/users?role=${tab}`).then(setUsers).finally(() => setLoading(false));
    }
  }
  useEffect(load, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setUserStatus(id: string, status: string) {
    setBusyId(id);
    try { await api(`/admin/users/${id}`, { method: 'PATCH', body: { status } }); load(); } finally { setBusyId(null); }
  }
  async function setCompanyStatus(id: string, status: string) {
    setBusyId(id);
    try { await api(`/admin/companies/${id}`, { method: 'PATCH', body: { status } }); load(); } finally { setBusyId(null); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Directory</h1>
      <div className="flex gap-6 border-b border-border mb-4 text-sm font-medium text-muted">
        {[
          { key: 'JOB_SEEKER' as Tab, label: 'Seekers' },
          { key: 'COMPANY' as Tab, label: 'Employers' },
          { key: 'COMPANIES' as Tab, label: 'Companies' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`pb-3 ${tab === t.key ? 'text-primary font-semibold border-b-2 border-primary' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : tab === 'COMPANIES' ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-pressed text-white text-left">
                <th className="px-4 py-2.5 text-xs font-semibold tracking-wide">COMPANY</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide">STATUS</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide">LIVE JOBS</th>
                <th className="px-4 py-2.5 text-xs font-semibold tracking-wide">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => (
                <tr key={c.id} className={i % 2 ? 'bg-ground' : ''}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3"><span className={`badge ${VERIFY_STYLE[c.verificationStatus]}`}>{c.verificationStatus}</span></td>
                  <td className="px-3 py-3">{c._count.jobs}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      {c.verificationStatus !== 'VERIFIED' && (
                        <button disabled={busyId === c.id} onClick={() => setCompanyStatus(c.id, 'VERIFIED')} className="text-primary font-semibold">Verify</button>
                      )}
                      {c.verificationStatus !== 'REJECTED' && (
                        <button disabled={busyId === c.id} onClick={() => setCompanyStatus(c.id, 'REJECTED')} className="text-danger">Reject</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-pressed text-white text-left">
                <th className="px-4 py-2.5 text-xs font-semibold tracking-wide">USER</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide">STATUS</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide">JOINED</th>
                <th className="px-4 py-2.5 text-xs font-semibold tracking-wide">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={i % 2 ? 'bg-ground' : ''}>
                  <td className="px-4 py-3 font-medium">
                    {u.email}
                    {u.companyMemberships?.[0] && <div className="text-xs text-muted font-normal">{u.companyMemberships[0].company.name}</div>}
                  </td>
                  <td className="px-3 py-3"><span className={`badge ${USER_STATUS_STYLE[u.status]}`}>{u.status}</span></td>
                  <td className="px-3 py-3 text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      {u.status !== 'SUSPENDED' ? (
                        <button disabled={busyId === u.id} onClick={() => setUserStatus(u.id, 'SUSPENDED')} className="text-danger">Suspend</button>
                      ) : (
                        <button disabled={busyId === u.id} onClick={() => setUserStatus(u.id, 'ACTIVE')} className="text-primary font-semibold">Reactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
