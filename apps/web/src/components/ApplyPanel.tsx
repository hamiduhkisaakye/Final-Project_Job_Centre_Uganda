'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useApi } from '@/lib/auth-context';
import { useSavedJobs } from '@/lib/saved-jobs-context';
import { ApiError } from '@/lib/api';
import TakeAssessmentModal from './TakeAssessmentModal';
import type { AssessmentAttempt, Conversation, Job } from '@/lib/types';

interface MatchResult {
  score: number;
  reasons: { positive: boolean; text: string }[];
}

export default function ApplyPanel({ job }: { job: Job }) {
  const { user, loading: authLoading } = useAuth();
  const api = useApi();
  const router = useRouter();

  const { isSaved, toggleSave: toggleSaveGlobal } = useSavedJobs();
  const saved = isSaved(job.id);

  const [match, setMatch] = useState<MatchResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentPassed, setAssessmentPassed] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'JOB_SEEKER') return;
    api<MatchResult>(`/jobs/${job.id}/match`).then(setMatch).catch(() => undefined);
  }, [user, job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || user.role !== 'JOB_SEEKER' || !job.assessmentId) return;
    api<AssessmentAttempt[]>('/me/assessment-attempts')
      .then((attempts) => {
        const mine = attempts.find((a) => a.assessmentId === job.assessmentId);
        if (mine?.passed) setAssessmentPassed(true);
      })
      .catch(() => undefined);
  }, [user, job.assessmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitApplication() {
    setBusy(true);
    setError(null);
    try {
      await api('/applications', { method: 'POST', body: { jobId: job.id, coverLetter } });
      setApplied(true);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function messageCompany() {
    if (!user) return router.push(`/login?next=/jobs/${job.slug}`);
    if (user.role !== 'JOB_SEEKER') return;
    const conversation = await api<Conversation>('/me/conversations', {
      method: 'POST',
      body: { companyId: job.companyId, jobId: job.id },
    });
    router.push(`/dashboard/messages?c=${conversation.id}`);
  }

  function toggleSave() {
    if (!user) return router.push('/login');
    toggleSaveGlobal(job.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-6">
        {applied ? (
          <div className="text-center py-2">
            <div className="text-success text-2xl mb-1">✓</div>
            <div className="font-semibold mb-1">Application sent</div>
            <p className="text-sm text-muted mb-3">Track its progress from your dashboard.</p>
            <button onClick={() => router.push('/dashboard/applications')} className="btn-primary w-full">
              Track application
            </button>
          </div>
        ) : showForm ? (
          <div className="flex flex-col gap-3">
            <div className="font-semibold">Apply to {job.title}</div>
            <div>
              <label className="label">Cover letter (optional)</label>
              <textarea
                className="input h-28"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell them why you're a good fit…"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setShowForm(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn-primary flex-1" onClick={submitApplication} disabled={busy}>
                {busy ? 'Sending…' : 'Submit application'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <button
              className="btn-primary w-full"
              onClick={() => {
                if (authLoading) return;
                if (!user) return router.push(`/login?next=/jobs/${job.slug}`);
                if (user.role !== 'JOB_SEEKER') return setError('Only job seeker accounts can apply');
                if (job.assessmentId && !assessmentPassed) return setShowAssessment(true);
                setShowForm(true);
              }}
            >
              Apply now
            </button>
            {job.assessmentId && !assessmentPassed && (
              <p className="text-xs text-muted text-center">📝 This role requires passing a short skills assessment to apply.</p>
            )}
            {job.assessmentId && assessmentPassed && (
              <p className="text-xs text-success text-center">✓ You&apos;ve passed the required assessment for this role.</p>
            )}
            {(!user || user.role === 'JOB_SEEKER') && (
              <button className="btn-secondary w-full" onClick={toggleSave}>
                {saved ? '★ Saved' : '☆ Save job'}
              </button>
            )}
            {(!user || user.role === 'JOB_SEEKER') && (
              <button className="btn-secondary w-full" onClick={messageCompany}>
                💬 Message company
              </button>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        )}
      </div>

      {user?.role === 'JOB_SEEKER' && match && (
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-3">
            <div
              className="w-[76px] h-[76px] rounded-full flex-none flex items-center justify-center"
              style={{ background: `conic-gradient(#1E5FBF 0 ${match.score}%, #EAF2FA ${match.score}% 100%)` }}
            >
              <div className="w-[58px] h-[58px] rounded-full bg-white flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-primary">{match.score}%</span>
                <span className="text-[9px] text-muted tracking-wide">MATCH</span>
              </div>
            </div>
            <div>
              <div className="font-semibold">{match.score >= 70 ? 'Strong match' : match.score >= 45 ? 'Fair match' : 'Limited match'}</div>
              <div className="text-xs text-muted">Based on your profile</div>
            </div>
          </div>
          <div className="text-[11px] font-bold tracking-wide text-muted mb-2">WHY YOU MATCH</div>
          <div className="flex flex-col gap-1 text-sm">
            {match.reasons.map((r, i) => (
              <div key={i} className={r.positive ? 'text-success' : 'text-muted'}>
                {r.positive ? '✓' : '○'} {r.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {showAssessment && job.assessmentId && (
        <TakeAssessmentModal
          assessmentId={job.assessmentId}
          onClose={() => setShowAssessment(false)}
          onPassed={() => {
            setAssessmentPassed(true);
            setShowAssessment(false);
            setShowForm(true);
          }}
        />
      )}
    </div>
  );
}
