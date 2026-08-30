'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, List as ListIcon, Search } from 'lucide-react';
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApi } from '@/lib/auth-context';
import CompanyLogo from '@/components/CompanyLogo';
import type { Application, ApplicationStage, Conversation, Interview } from '@/lib/types';

// Blueprint §8.3: the seeker board is read-only for stage (stage is
// recruiter-owned) — a card can only be withdrawn or dragged to reorder
// its priority *within* a column, never dragged between columns. Priority
// order is a personal preference (Application.priorityOrder), persisted
// via PATCH /applications/reorder.
const COLUMNS: { stage: ApplicationStage; label: string; accent: string }[] = [
  { stage: 'APPLIED', label: 'Applied', accent: 'border-t-primary' },
  { stage: 'IN_REVIEW', label: 'In Review', accent: 'border-t-primary' },
  { stage: 'INTERVIEW', label: 'Interview', accent: 'border-t-accent' },
  { stage: 'HIRED', label: 'Hired', accent: 'border-t-success' },
];

const DATE_FILTERS = [
  { value: 'all', label: 'All time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 365 days' },
];

const WITHDRAW_ZONE_ID = '__withdraw__';

function CardBody({ a, interview }: { a: Application; interview?: Interview }) {
  return (
    <>
      <div className="flex gap-2.5 mb-2">
        <CompanyLogo company={{ name: a.job?.company?.name || '', logoUrl: a.job?.company?.logoUrl }} size={32} className="text-xs flex-none" />
        <div className="text-sm font-semibold leading-snug">{a.job?.title}</div>
      </div>
      <div className="text-xs text-muted mb-2">{a.job?.company?.name} · {a.job?.location}</div>
      {interview && (
        <div className="bg-accent/15 text-ink text-[11px] font-semibold px-2 py-1 rounded mb-2">
          📅 {new Date(interview.scheduledAt!).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      )}
      <div className="bg-ground text-ink/70 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit">
        Match {a.matchScore ?? '—'}%
      </div>
    </>
  );
}

function SortableCard({ a, interview, busy, onWithdraw, onMessage }: {
  a: Application; interview?: Interview; busy: boolean;
  onWithdraw: () => void; onMessage: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: a.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`card p-3.5 ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <CardBody a={a} interview={interview} />
      </div>
      <div className="flex items-center justify-between mt-2">
        <button onClick={onWithdraw} disabled={busy} onPointerDown={(e) => e.stopPropagation()} className="text-[11px] text-danger font-semibold">
          Withdraw
        </button>
        <button onClick={onMessage} disabled={busy} onPointerDown={(e) => e.stopPropagation()} className="text-[11px] text-primary font-semibold">
          💬 Message recruiter
        </button>
      </div>
    </div>
  );
}

function Column({ stage, label, accent, items, interviewsByApp, busyId, onWithdraw, onMessage }: {
  stage: ApplicationStage; label: string; accent: string; items: Application[];
  interviewsByApp: Record<string, Interview>; busyId: string | null;
  onWithdraw: (a: Application) => void; onMessage: (a: Application) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] bg-ground rounded border-t-[3px] ${accent} p-3 transition-colors ${isOver ? 'ring-2 ring-primary/30' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <span className="text-[11px] font-bold tracking-wide text-ink/70">{label.toUpperCase()}</span>
        <span className="bg-white text-primary text-[11px] font-bold px-1.5 py-0.5 rounded-full">{items.length}</span>
      </div>
      <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2.5">
          {items.map((a) => (
            <SortableCard
              key={a.id}
              a={a}
              interview={interviewsByApp[a.id]}
              busy={busyId === a.id}
              onWithdraw={() => onWithdraw(a)}
              onMessage={() => onMessage(a)}
            />
          ))}
          {items.length === 0 && <div className="text-xs text-muted/70 text-center py-6">No applications here</div>}
        </div>
      </SortableContext>
    </div>
  );
}

function WithdrawZone() {
  const { setNodeRef, isOver } = useDroppable({ id: WITHDRAW_ZONE_ID });
  return (
    <div
      ref={setNodeRef}
      className={`mt-4 border-2 border-dashed rounded p-4 text-center text-sm font-semibold transition-colors ${
        isOver ? 'border-danger bg-danger/10 text-danger' : 'border-border text-muted'
      }`}
    >
      ↓ Drop here to withdraw application
      <div className="text-xs font-normal mt-0.5">You&apos;ll be asked to confirm</div>
    </div>
  );
}

function ListRow({ a, interview, busy, onWithdraw, onMessage }: {
  a: Application; interview?: Interview; busy: boolean; onWithdraw: () => void; onMessage: () => void;
}) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <CompanyLogo company={{ name: a.job?.company?.name || '', logoUrl: a.job?.company?.logoUrl }} size={40} className="flex-none" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{a.job?.title}</div>
        <div className="text-sm text-muted truncate">{a.job?.company?.name} · {a.job?.location}</div>
      </div>
      {interview && (
        <div className="hidden sm:block bg-accent/15 text-ink text-xs font-semibold px-2.5 py-1 rounded flex-none">
          📅 {new Date(interview.scheduledAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </div>
      )}
      <span className="badge badge-blue flex-none">{a.stage.replace('_', ' ')}</span>
      <div className="flex items-center gap-3 flex-none">
        <button onClick={onMessage} disabled={busy} className="text-xs text-primary font-semibold">💬 Message</button>
        {a.stage !== 'HIRED' && (
          <button onClick={onWithdraw} disabled={busy} className="text-xs text-danger font-semibold">Withdraw</button>
        )}
      </div>
    </div>
  );
}

export default function ApplicationsBoardPage() {
  const api = useApi();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('all');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const interviewsByApp = interviews.reduce<Record<string, Interview>>((acc, i) => {
    if (i.status === 'SCHEDULED') acc[i.applicationId] = i;
    return acc;
  }, {});

  async function messageRecruiter(a: Application) {
    const companyId = a.job?.company?.id;
    if (!companyId) return;
    setMessagingId(a.id);
    try {
      const conversation = await api<Conversation>('/me/conversations', {
        method: 'POST',
        body: { companyId, jobId: a.jobId },
      });
      router.push(`/dashboard/messages?c=${conversation.id}`);
    } finally {
      setMessagingId(null);
    }
  }

  function load() {
    setLoading(true);
    api<Application[]>('/applications').then(setApplications).finally(() => setLoading(false));
    api<Interview[]>('/me/interviews').then(setInterviews).catch(() => undefined);
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function withdraw(a: Application) {
    if (!confirm(`Withdraw your application for ${a.job?.title}? This cannot be undone.`)) return;
    setBusyId(a.id);
    try {
      await api(`/applications/${a.id}/withdraw`, { method: 'PATCH' });
      load();
    } finally {
      setBusyId(null);
    }
  }

  const companies = useMemo(
    () => Array.from(new Set(applications.map((a) => a.job?.company?.name).filter(Boolean))) as string[],
    [applications],
  );

  const filtered = useMemo(() => {
    const cutoffDays = dateFilter === 'all' ? null : Number(dateFilter);
    const cutoff = cutoffDays ? Date.now() - cutoffDays * 86400000 : null;
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      if (company !== 'ALL' && a.job?.company?.name !== company) return false;
      if (cutoff && new Date(a.submittedAt).getTime() < cutoff) return false;
      if (q && !(a.job?.title?.toLowerCase().includes(q) || a.job?.company?.name?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [applications, company, dateFilter, search]);

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const application = applications.find((a) => a.id === active.id);
    if (!application) return;

    if (over.id === WITHDRAW_ZONE_ID) {
      withdraw(application);
      return;
    }

    // Dropped on another card (reorder within the same column) or directly
    // on a column's droppable area (over.id is then the stage itself).
    const overApp = applications.find((a) => a.id === over.id);
    const targetStage = (overApp?.stage ?? over.id) as ApplicationStage;
    if (targetStage !== application.stage) return; // stage is employer-owned — no cross-column drop

    const columnItems = filtered
      .filter((a) => a.stage === targetStage)
      .sort((x, y) => applications.indexOf(x) - applications.indexOf(y));
    const oldIndex = columnItems.findIndex((a) => a.id === active.id);
    const newIndex = overApp ? columnItems.findIndex((a) => a.id === over.id) : columnItems.length - 1;
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(columnItems, oldIndex, newIndex);
    // Optimistic: splice the reordered column back into the full list so
    // the board reflects the new order immediately, before the server call
    // resolves.
    const reorderedIds = new Set(reordered.map((a) => a.id));
    let cursor = 0;
    setApplications((prev) => prev.map((a) => (reorderedIds.has(a.id) ? reordered[cursor++] : a)));

    try {
      await api('/applications/reorder', { method: 'PATCH', body: { stage: targetStage, orderedIds: reordered.map((a) => a.id) } });
    } catch {
      load(); // fall back to server state if the reorder failed to save
    }
  }

  const closed = applications.filter((a) => a.stage === 'REJECTED' || a.stage === 'WITHDRAWN' || a.stage === 'OFFER');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">My Applications</h1>
        <span className="text-sm text-muted">{applications.length} total</span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="flex items-center border border-border rounded overflow-hidden flex-none">
          <button
            onClick={() => setViewMode('board')}
            className={`h-9 px-3 flex items-center gap-1.5 text-sm font-semibold transition-colors ${viewMode === 'board' ? 'bg-primary text-white' : 'bg-white text-muted hover:text-ink'}`}
          >
            <LayoutGrid className="w-4 h-4" /> Board
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`h-9 px-3 flex items-center gap-1.5 text-sm font-semibold border-l border-border transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white text-muted hover:text-ink'}`}
          >
            <ListIcon className="w-4 h-4" /> List
          </button>
        </div>
        <div className="flex items-center gap-2 bg-white border border-border rounded px-3 h-9 w-full sm:w-[220px]">
          <Search className="w-4 h-4 text-muted flex-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applications"
            className="text-sm outline-none flex-1 min-w-0"
          />
        </div>
        <select value={company} onChange={(e) => setCompany(e.target.value)} className="input h-9 w-auto max-w-[200px] text-sm">
          <option value="ALL">All companies</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="input h-9 w-auto max-w-[180px] text-sm">
          {DATE_FILTERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        {viewMode === 'board' && (
          <span className="text-xs text-muted ml-auto hidden lg:block">
            Stage is set by the employer — drag to reorder your priority
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : viewMode === 'board' ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {COLUMNS.map((col) => (
              <Column
                key={col.stage}
                stage={col.stage}
                label={col.label}
                accent={col.accent}
                items={filtered.filter((a) => a.stage === col.stage)}
                interviewsByApp={interviewsByApp}
                busyId={busyId}
                onWithdraw={withdraw}
                onMessage={messageRecruiter}
              />
            ))}
          </div>
          <WithdrawZone />
        </DndContext>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.length === 0 ? (
            <div className="card p-8 text-center text-sm text-muted">No applications match these filters.</div>
          ) : (
            filtered.map((a) => (
              <ListRow
                key={a.id}
                a={a}
                interview={interviewsByApp[a.id]}
                busy={busyId === a.id || messagingId === a.id}
                onWithdraw={() => withdraw(a)}
                onMessage={() => messageRecruiter(a)}
              />
            ))
          )}
        </div>
      )}

      {closed.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold tracking-wide text-muted mb-2.5">CLOSED / OFFERS</h2>
          <div className="flex flex-col gap-2 max-w-[640px]">
            {closed.map((a) => (
              <div key={a.id} className="card p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{a.job?.title}</div>
                  <div className="text-xs text-muted">{a.job?.company?.name}</div>
                </div>
                <span className={`badge ${a.stage === 'OFFER' ? 'badge-yellow' : 'badge-grey'}`}>{a.stage}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
