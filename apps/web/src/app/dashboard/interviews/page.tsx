'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Video } from 'lucide-react';
import { useAuth, useApi } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';
import { ApiError, downloadFile } from '@/lib/api';
import CompanyLogo from '@/components/CompanyLogo';
import InterviewCalendar from '@/components/InterviewCalendar';
import type { Interview } from '@/lib/types';

const STATUS_BADGE: Record<string, string> = {
  PROPOSED: 'badge-yellow',
  SCHEDULED: 'badge-blue',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-grey',
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeUntilLabel(target: Date) {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `Opens in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Opens in ${hours} hr${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `Opens in ${days} day${days === 1 ? '' : 's'}`;
}

function PrepPanel({ interview }: { interview: Interview }) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const job = interview.application?.job;
  const p = interview; // for readability below

  async function loadQuestions() {
    setLoading(true);
    setError(null);
    try {
      const result = await api<{ questions: string[] }>(`/interviews/${p.id}/prep-questions`);
      setQuestions(result.questions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate questions — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-ground rounded p-4 mt-3">
      <div className="text-[11px] font-bold tracking-wide text-primary mb-2.5">PREP PANEL</div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm mb-3">
        {job?.slug && (
          <Link href={`/jobs/${job.slug}`} className="text-primary font-semibold hover:text-primary-pressed transition-colors">
            Job description →
          </Link>
        )}
        {interview.createdBy && <span className="text-muted">Interviewer: {interview.createdBy.email}</span>}
        <Link href="/dashboard/profile" className="text-primary font-semibold hover:text-primary-pressed transition-colors">
          Your resume & video →
        </Link>
      </div>

      {questions ? (
        <div>
          <div className="text-xs font-semibold text-muted mb-1.5">LIKELY QUESTIONS FOR THIS ROLE</div>
          <ol className="flex flex-col gap-1.5 text-sm list-decimal list-inside">
            {questions.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </div>
      ) : (
        <div>
          <button type="button" onClick={loadQuestions} disabled={loading} className="btn-secondary h-8 text-xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> {loading ? 'Thinking…' : 'Get likely questions'}
          </button>
          {error && <p className="text-xs text-danger mt-1.5">{error}</p>}
        </div>
      )}
    </div>
  );
}

function ProposedCard({ interview, onConfirmed, onCancelled }: { interview: Interview; onConfirmed: () => void; onCancelled: () => void }) {
  const api = useApi();
  const { confirmDialog } = useDialog();
  const [selected, setSelected] = useState<string | null>(interview.slots?.[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const job = interview.application?.job;

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/interviews/${interview.id}/confirm`, { method: 'POST', body: { slotId: selected } });
      onConfirmed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function requestReschedule() {
    setBusy(true);
    setError(null);
    try {
      await api(`/interviews/${interview.id}/request-reschedule`, { method: 'POST', body: {} });
      setSuggesting(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function declineInterview() {
    if (!(await confirmDialog(`Decline this interview with ${job?.company?.name || 'this company'}? This cannot be undone.`, { danger: true, confirmLabel: 'Decline' }))) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/interviews/${interview.id}/cancel`, { method: 'POST' });
      onCancelled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5 border-l-4 border-accent">
      <div className="flex items-start gap-3 mb-3">
        <CompanyLogo company={{ name: job?.company?.name || '', logoUrl: job?.company?.logoUrl }} size={40} className="flex-none" />
        <div className="min-w-0">
          <div className="font-semibold truncate">{job?.title}</div>
          <div className="text-sm text-muted truncate">{job?.company?.name} · pick a slot</div>
        </div>
        <span className="badge badge-yellow flex-none ml-auto">Action needed</span>
      </div>

      <div className="flex flex-col gap-2 mb-3">
        {interview.slots?.map((slot) => (
          <label key={slot.id} className={`flex items-center gap-2.5 border rounded px-3 py-2.5 text-sm cursor-pointer transition-colors ${selected === slot.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <input type="radio" name={`slot-${interview.id}`} checked={selected === slot.id} onChange={() => setSelected(slot.id)} />
            {new Date(slot.startsAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-danger mb-2">{error}</p>}
      {suggesting ? (
        <p className="text-sm text-success">Sent — we've asked for a new time.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy || !selected} onClick={confirm}>Confirm slot</button>
          <button className="btn-secondary" disabled={busy} onClick={requestReschedule}>Request another time</button>
          <button className="text-danger text-sm font-semibold px-2" disabled={busy} onClick={declineInterview}>Decline</button>
        </div>
      )}
    </div>
  );
}

function UpcomingCard({ interview, accessToken, onCancelled }: { interview: Interview; accessToken: string | null; onCancelled: () => void }) {
  const api = useApi();
  const { confirmDialog } = useDialog();
  const [showPrep, setShowPrep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = interview.application?.job;
  const scheduledAt = interview.scheduledAt ? new Date(interview.scheduledAt) : null;
  const canJoinSoon = scheduledAt && interview.mode === 'VIDEO_CALL' && scheduledAt.getTime() - Date.now() < 15 * 60000;
  const openLabel = scheduledAt ? timeUntilLabel(scheduledAt) : null;

  async function cancelInterview() {
    if (!(await confirmDialog(`Cancel your interview with ${job?.company?.name || 'this company'}? This cannot be undone.`, { danger: true, confirmLabel: 'Cancel interview' }))) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/interviews/${interview.id}/cancel`, { method: 'POST' });
      onCancelled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <CompanyLogo company={{ name: job?.company?.name || '', logoUrl: job?.company?.logoUrl }} size={40} className="flex-none" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{job?.title}</div>
          <div className="text-sm text-muted truncate">
            {job?.company?.name} · {scheduledAt?.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · {interview.durationMinutes} min
          </div>
        </div>
        <span className={`badge ${STATUS_BADGE[interview.status]} flex-none`}>{interview.status}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 mt-3">
        {interview.mode === 'VIDEO_CALL' && interview.location && (
          canJoinSoon ? (
            <a href={interview.location} target="_blank" rel="noopener noreferrer" className="btn-primary h-9 text-sm flex items-center gap-1.5">
              <Video className="w-4 h-4" /> Join call
            </a>
          ) : (
            <span className="btn-secondary h-9 text-sm flex items-center gap-1.5 opacity-60 cursor-not-allowed">
              <Video className="w-4 h-4" /> Join call
            </span>
          )
        )}
        {openLabel && <span className="text-xs text-muted">{openLabel}</span>}
        <button
          className="btn-secondary h-9 text-sm"
          onClick={() => downloadFile(`/interviews/${interview.id}/ics`, accessToken, 'interview.ics')}
        >
          Add to calendar
        </button>
        <button className="text-primary text-sm font-semibold" onClick={() => setShowPrep((v) => !v)}>
          {showPrep ? 'Hide prep' : 'Prep for this interview →'}
        </button>
        <button className="text-danger text-sm font-semibold ml-auto" disabled={busy} onClick={cancelInterview}>
          Cancel interview
        </button>
      </div>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}

      {showPrep && <PrepPanel interview={interview} />}
    </div>
  );
}

export default function InterviewSchedulePage() {
  const { accessToken } = useAuth();
  const api = useApi();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  function load() {
    setLoading(true);
    api<Interview[]>('/me/interviews').then(setInterviews).finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const proposed = interviews.filter((i) => i.status === 'PROPOSED');
  const upcoming = interviews.filter((i) => i.status === 'SCHEDULED' && i.scheduledAt && new Date(i.scheduledAt) > new Date());
  const past = interviews.filter((i) => !proposed.includes(i) && !upcoming.includes(i));

  const markedDates = useMemo(() => {
    const set = new Set<string>();
    for (const i of interviews) {
      if (i.scheduledAt) set.add(dayKey(new Date(i.scheduledAt)));
      for (const s of i.slots || []) set.add(dayKey(new Date(s.startsAt)));
    }
    return set;
  }, [interviews]);

  const visibleUpcoming = selectedDate ? upcoming.filter((i) => i.scheduledAt && dayKey(new Date(i.scheduledAt)) === dayKey(selectedDate)) : upcoming;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold">Interview Schedule</h1>
        {selectedDate && (
          <button className="text-sm text-primary font-semibold" onClick={() => setSelectedDate(null)}>
            Clear date filter ×
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : interviews.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No interviews yet.</div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div className="w-full lg:w-[320px] flex-none lg:sticky lg:top-20">
            <InterviewCalendar month={month} onMonthChange={setMonth} markedDates={markedDates} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          </div>

          <div className="flex-1 w-full flex flex-col gap-6">
            {proposed.length > 0 && (
              <div>
                <h2 className="text-sm font-bold tracking-wide text-muted mb-3">NEEDS YOUR RESPONSE</h2>
                <div className="flex flex-col gap-3">
                  {proposed.map((i) => <ProposedCard key={i.id} interview={i} onConfirmed={load} onCancelled={load} />)}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-bold tracking-wide text-muted mb-3">UPCOMING</h2>
              {visibleUpcoming.length === 0 ? (
                <div className="card p-6 text-center text-sm text-muted">
                  {selectedDate ? 'No interviews on this day.' : 'Nothing scheduled yet.'}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {visibleUpcoming.map((i) => <UpcomingCard key={i.id} interview={i} accessToken={accessToken} onCancelled={load} />)}
                </div>
              )}
            </div>

            {past.length > 0 && (
              <div>
                <h2 className="text-sm font-bold tracking-wide text-muted mb-3">PAST</h2>
                <div className="flex flex-col gap-2.5">
                  {past.map((i) => {
                    const job = i.application?.job;
                    return (
                      <div key={i.id} className="card p-4 flex items-center gap-3">
                        <CompanyLogo company={{ name: job?.company?.name || '', logoUrl: job?.company?.logoUrl }} size={36} className="flex-none" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{job?.title}</div>
                          <div className="text-xs text-muted truncate">
                            {job?.company?.name}{i.scheduledAt ? ` · ${new Date(i.scheduledAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}` : ''}
                          </div>
                        </div>
                        <span className={`badge ${STATUS_BADGE[i.status]} flex-none`}>{i.status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
