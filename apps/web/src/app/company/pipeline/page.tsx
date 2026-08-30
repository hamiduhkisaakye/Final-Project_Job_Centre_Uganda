'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { seekerDisplayName } from '@/lib/format';
import SeekerProfileModal from '@/components/SeekerProfileModal';
import SeekerAvatar from '@/components/SeekerAvatar';
import ScheduleInterviewModal from '@/components/ScheduleInterviewModal';
import type { Application, ApplicationStage, Conversation, Interview, Job } from '@/lib/types';

// Only ever called with a SCHEDULED interview (see interviewsByApp below,
// which only keeps SCHEDULED ones) — scheduledAt is guaranteed set there.
function formatInterviewChip(i: Interview) {
  const d = new Date(i.scheduledAt!);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const COLUMNS: { stage: ApplicationStage; label: string; accent: string }[] = [
  { stage: 'APPLIED', label: 'Applied', accent: 'border-t-primary' },
  { stage: 'IN_REVIEW', label: 'In Review', accent: 'border-t-primary' },
  { stage: 'INTERVIEW', label: 'Interview', accent: 'border-t-accent' },
  { stage: 'OFFER', label: 'Offer', accent: 'border-t-accent' },
  { stage: 'HIRED', label: 'Hired', accent: 'border-t-success' },
];

function CandidateCard({ a, busy, interview, onMessage, onView, onSchedule }: {
  a: Application; busy: boolean; interview?: Interview; onMessage: () => void; onView: () => void; onSchedule: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: a.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10, opacity: isDragging ? 0.6 : 1 }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} className={`card p-3.5 ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <div className="flex gap-2.5 mb-1.5">
          <SeekerAvatar seeker={a.seeker} size={32} />
          <div>
            <div className="text-sm font-semibold">{seekerDisplayName(a.seeker)}</div>
            <div className="text-xs text-muted">{a.seeker?.seekerProfile?.headline || a.seeker?.seekerProfile?.location || '—'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-muted">Match {a.matchScore ?? '—'}%</span>
          {a.assessmentScore != null && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${a.assessmentPassed ? 'bg-success/15 text-success' : 'bg-danger/10 text-danger'}`}>
              Quiz {a.assessmentScore}%
            </span>
          )}
        </div>
        {interview && (
          <div className="bg-ground text-ink/80 text-[10px] font-semibold px-2 py-1 rounded mb-2 w-fit">
            📅 {formatInterviewChip(interview)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={(e) => { e.stopPropagation(); onView(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[11px] text-primary font-semibold"
        >
          👤 View profile
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMessage(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[11px] text-primary font-semibold"
        >
          💬 Message
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onSchedule(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[11px] text-primary font-semibold"
        >
          📅 {interview ? 'Propose new time' : 'Propose interview'}
        </button>
      </div>
    </div>
  );
}

function Column({ stage, label, accent, items, busyId, interviewsByApp, onMessage, onView, onSchedule }: {
  stage: ApplicationStage; label: string; accent: string; items: Application[]; busyId: string | null;
  interviewsByApp: Record<string, Interview>;
  onMessage: (a: Application) => void; onView: (a: Application) => void; onSchedule: (a: Application) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[240px] bg-ground rounded border-t-[3px] ${accent} p-3 transition-colors ${isOver ? 'bg-primary/5 ring-2 ring-primary/30' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <span className="text-[11px] font-bold tracking-wide text-ink/70">{label.toUpperCase()}</span>
        <span className="bg-white text-primary text-[11px] font-bold px-1.5 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="flex flex-col gap-2.5 min-h-[40px]">
        {items.map((a) => (
          <CandidateCard
            key={a.id}
            a={a}
            busy={busyId === a.id}
            interview={interviewsByApp[a.id]}
            onMessage={() => onMessage(a)}
            onView={() => onView(a)}
            onSchedule={() => onSchedule(a)}
          />
        ))}
        {items.length === 0 && <div className="text-xs text-muted/70 text-center py-6">Drop here</div>}
      </div>
    </div>
  );
}

function RejectZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'REJECTED' });
  return (
    <div
      ref={setNodeRef}
      className={`flex-none w-[120px] rounded border-2 border-dashed flex flex-col items-center justify-center text-center px-2 transition-colors ${
        isOver ? 'border-danger bg-danger/10' : 'border-border text-muted'
      }`}
    >
      <span className="text-lg">🗑️</span>
      <span className="text-[11px] font-semibold mt-1">Drop to reject</span>
    </div>
  );
}

function PipelineInner() {
  const api = useApi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState(searchParams.get('jobId') || '');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Application | null>(null);
  const [scheduling, setScheduling] = useState<Application | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    api<Job[]>('/jobs/mine').then((all) => {
      const published = all.filter((j) => j.status === 'PUBLISHED');
      setJobs(published);
      if (!jobId && published[0]) setJobId(published[0].id);
    });
    api<Interview[]>('/me/interviews').then(setInterviews).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function load(id: string) {
    if (!id) return;
    setLoading(true);
    api<Application[]>(`/applications?jobId=${id}`).then(setApplications).finally(() => setLoading(false));
  }
  useEffect(() => { load(jobId); }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Most recent scheduled interview per application, for the card chip.
  const interviewsByApp = interviews.reduce<Record<string, Interview>>((acc, i) => {
    if (i.status === 'SCHEDULED') acc[i.applicationId] = i;
    return acc;
  }, {});

  async function moveStage(id: string, stage: ApplicationStage, reason?: string) {
    setBusyId(id);
    try {
      await api(`/applications/${id}/stage`, { method: 'PATCH', body: reason ? { stage, reason } : { stage } });
      load(jobId);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const targetStage = over.id as ApplicationStage;
    const application = applications.find((a) => a.id === active.id);
    if (!application || application.stage === targetStage) return;

    if (targetStage === 'REJECTED') {
      const reason = prompt('Rejection reason (shown to the candidate context, required):');
      if (!reason) return;
      moveStage(application.id, 'REJECTED', reason);
      return;
    }
    moveStage(application.id, targetStage);
  }

  async function messageCandidate(a: Application) {
    const conversation = await api<Conversation>('/me/conversations', {
      method: 'POST',
      body: { seekerId: a.seekerId, jobId: a.jobId },
    });
    router.push(`/company/messages?c=${conversation.id}`);
  }

  const rejected = applications.filter((a) => a.stage === 'REJECTED');

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h1 className="text-2xl font-bold">Candidate Pipeline</h1>
        <select className="input h-10 w-auto max-w-[360px]" value={jobId} onChange={(e) => setJobId(e.target.value)}>
          {jobs.length === 0 && <option>No published jobs</option>}
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title} · {j.applicationsCount} applicants</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted mb-4">Drag a card to a different column to move that candidate's stage. Dragging to Rejected asks for a reason first.</p>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {COLUMNS.map((col) => (
              <Column
                key={col.stage}
                stage={col.stage}
                label={col.label}
                accent={col.accent}
                items={applications.filter((a) => a.stage === col.stage)}
                busyId={busyId}
                interviewsByApp={interviewsByApp}
                onMessage={messageCandidate}
                onView={setViewing}
                onSchedule={setScheduling}
              />
            ))}
            <RejectZone />
          </div>
        </DndContext>
      )}

      {rejected.length > 0 && (
        <div className="mt-6 text-sm text-muted">{rejected.length} rejected candidate{rejected.length === 1 ? '' : 's'} hidden from the board above.</div>
      )}

      {viewing && (
        <SeekerProfileModal
          seeker={viewing.seeker}
          matchScore={viewing.matchScore}
          assessmentScore={viewing.assessmentScore}
          assessmentPassed={viewing.assessmentPassed}
          coverLetter={viewing.coverLetter}
          onClose={() => setViewing(null)}
        />
      )}

      {scheduling && (
        <ScheduleInterviewModal
          applicationId={scheduling.id}
          onClose={() => setScheduling(null)}
          onScheduled={(interview) => {
            setInterviews((prev) => [...prev.filter((i) => i.id !== interview.id), interview]);
            setScheduling(null);
          }}
        />
      )}
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <PipelineInner />
    </Suspense>
  );
}
