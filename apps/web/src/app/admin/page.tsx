'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/auth-context';
import TrendChart from '@/components/charts/TrendChart';

// Backend returns one row per (date, groupField) — pivot into one row per
// date with each group's value as its own key, which is what a multi-series
// TrendChart needs (Recharts reads one object per X point).
function pivotByDate<T extends string>(rows: { date: string; count: number }[] & Record<string, any>[], groupField: string, groups: T[]) {
  const byDate = new Map<string, Record<string, string | number>>();
  for (const row of rows) {
    const entry = byDate.get(row.date) || { date: row.date, ...Object.fromEntries(groups.map((g) => [g, 0])) };
    entry[row[groupField]] = row.count;
    byDate.set(row.date, entry);
  }
  return Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Validated 3-slot categorical set from the dataviz skill's reference
// palette (the app's own tokens don't clear the categorical checks — see
// the validator run this was based on) — used only for genuine multi-series
// identity charts like this one, not single-series trends (those stay on
// brand primary).
const ROLE_COLORS: Record<string, string> = { JOB_SEEKER: '#2a78d6', COMPANY: '#eb6834', ADMIN: '#1baf7a' };
const DECISION_COLORS: Record<string, string> = { APPROVED: '#1E8E5A', REJECTED: '#C0392B', ESCALATED: '#eda100' };

interface AdminAnalytics {
  usersOverTime: { date: string; role: string; count: number }[];
  jobsOverTime: { date: string; count: number }[];
  applicationsOverTime: { date: string; count: number }[];
  moderationThroughput: { date: string; decision: string; count: number }[];
}

export default function AdminDashboardPage() {
  const api = useApi();
  const [counts, setCounts] = useState({ seekers: 0, employers: 0, companies: 0, pending: 0, verifiedCompanies: 0 });
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);

  async function backfillEmbeddings() {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await api<{ ran: boolean; reason?: string; jobsEmbedded?: number; profilesEmbedded?: number }>(
        '/admin/embeddings/backfill',
        { method: 'POST' },
      );
      setBackfillResult(
        res.ran
          ? `Embedded ${res.jobsEmbedded} job(s) and ${res.profilesEmbedded} profile(s).`
          : `Skipped: ${res.reason}`,
      );
    } catch {
      setBackfillResult('Backfill failed — check the API logs.');
    } finally {
      setBackfilling(false);
    }
  }

  useEffect(() => {
    Promise.all([
      api<any[]>('/admin/users?role=JOB_SEEKER'),
      api<any[]>('/admin/users?role=COMPANY'),
      api<any[]>('/admin/companies'),
      api<any[]>('/admin/moderation?decision=PENDING'),
    ]).then(([seekers, employers, companies, pending]) => {
      setCounts({
        seekers: seekers.length,
        employers: employers.length,
        companies: companies.length,
        pending: pending.length,
        verifiedCompanies: companies.filter((c) => c.verificationStatus === 'VERIFIED').length,
      });
    }).finally(() => setLoading(false));
    api<AdminAnalytics>('/admin/analytics').then(setAnalytics).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Platform overview</h1>
      <p className="text-sm text-muted mb-5">{loading ? 'Loading…' : 'All systems normal'}</p>

      {counts.pending > 0 && (
        <div className="bg-accent/20 border-l-4 border-accent rounded p-3.5 mb-5 flex items-center justify-between">
          <span className="text-sm font-medium">⚠ {counts.pending} job{counts.pending === 1 ? '' : 's'} awaiting moderation</span>
          <Link href="/admin/moderation" className="text-sm font-semibold text-primary">Review now →</Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {[
          { label: 'Job seekers', value: counts.seekers },
          { label: 'Employers', value: counts.employers },
          { label: 'Companies', value: counts.companies },
          { label: 'Verified companies', value: counts.verifiedCompanies },
          { label: 'Pending moderation', value: counts.pending, accent: counts.pending > 0 },
        ].map((t) => (
          <div key={t.label} className={`card p-4 ${t.accent ? 'border-l-4 border-accent' : ''}`}>
            <div className="text-[11px] font-bold tracking-wide text-muted">{t.label.toUpperCase()}</div>
            <div className="text-2xl font-bold text-primary mt-1">{t.value}</div>
          </div>
        ))}
      </div>

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          <div className="card p-5">
            <h2 className="text-sm font-bold tracking-wide text-muted mb-3">NEW USERS, LAST 30 DAYS</h2>
            <TrendChart
              data={pivotByDate(analytics.usersOverTime, 'role', ['JOB_SEEKER', 'COMPANY', 'ADMIN'])}
              series={[
                { key: 'JOB_SEEKER', label: 'Job seekers', color: ROLE_COLORS.JOB_SEEKER },
                { key: 'COMPANY', label: 'Companies', color: ROLE_COLORS.COMPANY },
                { key: 'ADMIN', label: 'Admins', color: ROLE_COLORS.ADMIN },
              ]}
            />
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-bold tracking-wide text-muted mb-3">MODERATION THROUGHPUT</h2>
            <TrendChart
              data={pivotByDate(analytics.moderationThroughput, 'decision', ['APPROVED', 'REJECTED', 'ESCALATED'])}
              series={[
                { key: 'APPROVED', label: 'Approved', color: DECISION_COLORS.APPROVED },
                { key: 'REJECTED', label: 'Rejected', color: DECISION_COLORS.REJECTED },
                { key: 'ESCALATED', label: 'Escalated', color: DECISION_COLORS.ESCALATED },
              ]}
            />
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-bold tracking-wide text-muted mb-3">NEW JOBS POSTED, LAST 30 DAYS</h2>
            <TrendChart data={analytics.jobsOverTime} series={[{ key: 'count', label: 'Jobs posted', color: '#1E5FBF' }]} />
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-bold tracking-wide text-muted mb-3">APPLICATIONS, LAST 30 DAYS</h2>
            <TrendChart data={analytics.applicationsOverTime} series={[{ key: 'count', label: 'Applications', color: '#1E5FBF' }]} />
          </div>
        </div>
      )}

      <div className="card p-4 mt-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm font-semibold">Semantic matching (pgvector)</div>
          <div className="text-xs text-muted">
            Generate embeddings for published jobs and seeker profiles that don&apos;t have one yet. Needs OPENAI_API_KEY set in apps/api/.env.
            {backfillResult && <span className="block mt-1 text-ink">{backfillResult}</span>}
          </div>
        </div>
        <button className="btn-secondary flex-none" onClick={backfillEmbeddings} disabled={backfilling}>
          {backfilling ? 'Running…' : 'Run backfill'}
        </button>
      </div>
    </div>
  );
}
