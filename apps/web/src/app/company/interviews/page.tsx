'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video } from 'lucide-react';
import { useAuth, useApi } from '@/lib/auth-context';
import { downloadFile } from '@/lib/api';
import { seekerDisplayName } from '@/lib/format';
import SeekerAvatar from '@/components/SeekerAvatar';
import SeekerProfileModal from '@/components/SeekerProfileModal';
import InterviewCalendar from '@/components/InterviewCalendar';
import type { Conversation, Interview } from '@/lib/types';

const STATUS_BADGE: Record<string, string> = {
  PROPOSED: 'badge-yellow',
  SCHEDULED: 'badge-blue',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-grey',
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function InterviewRow({ interview, accessToken, onMessage, onView, onCancelled }: {
  interview: Interview; accessToken: string | null;
  onMessage: () => void; onView: () => void; onCancelled: () => void;
}) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const seeker = interview.application?.seeker;
  const job = interview.application?.job;
  const scheduledAt = interview.scheduledAt ? new Date(interview.scheduledAt) : null;

  async function cancelProposal() {
    if (!confirm('Cancel this interview proposal? The candidate will no longer be able to confirm it.')) return;
    setBusy(true);
    try {
      await api(`/interviews/${interview.id}`, { method: 'PATCH', body: { status: 'CANCELLED' } });
      onCancelled();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <SeekerAvatar seeker={seeker} size={40} className="flex-none" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{seekerDisplayName(seeker)}</div>
          <div className="text-sm text-muted truncate">
            {job?.title}
            {scheduledAt && ` · ${scheduledAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`}
            {interview.status === 'PROPOSED' && ` · ${interview.slots?.length || 0} time${(interview.slots?.length || 0) === 1 ? '' : 's'} offered — awaiting response`}
          </div>
        </div>
        <span className={`badge ${STATUS_BADGE[interview.status]} flex-none`}>{interview.status}</span>
      </div>

      {interview.status === 'PROPOSED' && interview.slots && interview.slots.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5 ml-[52px]">
          {interview.slots.map((s) => (
            <span key={s.id} className="badge badge-grey">
              {new Date(s.startsAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 mt-3">
        {interview.mode === 'VIDEO_CALL' && interview.location && interview.status === 'SCHEDULED' && (
          <a href={interview.location} target="_blank" rel="noopener noreferrer" className="btn-secondary h-9 text-sm flex items-center gap-1.5">
            <Video className="w-4 h-4" /> Join call
          </a>
        )}
        {interview.status === 'SCHEDULED' && (
          <button className="btn-secondary h-9 text-sm" onClick={() => downloadFile(`/interviews/${interview.id}/ics`, accessToken, 'interview.ics')}>
            Add to calendar
          </button>
        )}
        <button className="text-primary text-sm font-semibold" onClick={onView}>👤 View profile</button>
        <button className="text-primary text-sm font-semibold" onClick={onMessage}>💬 Message</button>
        {interview.status === 'PROPOSED' && (
          <button className="text-danger text-sm font-semibold" disabled={busy} onClick={cancelProposal}>Cancel proposal</button>
        )}
      </div>
    </div>
  );
}

export default function CompanyInterviewsPage() {
  const { accessToken } = useAuth();
  const api = useApi();
  const router = useRouter();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewing, setViewing] = useState<Interview | null>(null);

  function load() {
    setLoading(true);
    api<Interview[]>('/me/interviews').then(setInterviews).finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function messageCandidate(interview: Interview) {
    const app = interview.application;
    if (!app) return;
    const conversation = await api<Conversation>('/me/conversations', {
      method: 'POST',
      body: { seekerId: app.seekerId, jobId: app.job.id },
    });
    router.push(`/company/messages?c=${conversation.id}`);
  }

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
        <h1 className="text-2xl font-bold">Interviews</h1>
        {selectedDate && (
          <button className="text-sm text-primary font-semibold" onClick={() => setSelectedDate(null)}>
            Clear date filter ×
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : interviews.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No interviews booked yet.</div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div className="w-full lg:w-[320px] flex-none lg:sticky lg:top-20">
            <InterviewCalendar month={month} onMonthChange={setMonth} markedDates={markedDates} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          </div>

          <div className="flex-1 w-full flex flex-col gap-6">
            {proposed.length > 0 && (
              <div>
                <h2 className="text-sm font-bold tracking-wide text-muted mb-3">AWAITING CANDIDATE RESPONSE</h2>
                <div className="flex flex-col gap-3">
                  {proposed.map((i) => (
                    <InterviewRow key={i.id} interview={i} accessToken={accessToken} onMessage={() => messageCandidate(i)} onView={() => setViewing(i)} onCancelled={load} />
                  ))}
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
                  {visibleUpcoming.map((i) => (
                    <InterviewRow key={i.id} interview={i} accessToken={accessToken} onMessage={() => messageCandidate(i)} onView={() => setViewing(i)} onCancelled={load} />
                  ))}
                </div>
              )}
            </div>

            {past.length > 0 && (
              <div>
                <h2 className="text-sm font-bold tracking-wide text-muted mb-3">PAST</h2>
                <div className="flex flex-col gap-2.5">
                  {past.map((i) => {
                    const seeker = i.application?.seeker;
                    const job = i.application?.job;
                    return (
                      <div key={i.id} className="card p-4 flex items-center gap-3">
                        <SeekerAvatar seeker={seeker} size={36} className="flex-none" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{seekerDisplayName(seeker)}</div>
                          <div className="text-xs text-muted truncate">
                            {job?.title}{i.scheduledAt ? ` · ${new Date(i.scheduledAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}` : ''}
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

      {viewing && (
        <SeekerProfileModal seeker={viewing.application?.seeker} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
