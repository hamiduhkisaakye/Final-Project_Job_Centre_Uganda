'use client';

import { useState } from 'react';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import type { Interview, InterviewMode } from '@/lib/types';

const MODES: { value: InterviewMode; label: string }[] = [
  { value: 'VIDEO_CALL', label: 'Video call' },
  { value: 'PHONE', label: 'Phone call' },
  { value: 'IN_PERSON', label: 'In person' },
];

export default function ScheduleInterviewModal({
  applicationId,
  onClose,
  onScheduled,
}: {
  applicationId: string;
  onClose: () => void;
  onScheduled: (interview: Interview) => void;
}) {
  const api = useApi();
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [mode, setMode] = useState<InterviewMode>('VIDEO_CALL');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!scheduledAt) {
      setError('Pick a date and time');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const interview = await api<Interview>(`/applications/${applicationId}/interviews`, {
        method: 'POST',
        body: {
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMinutes: Number(durationMinutes) || 30,
          mode,
          location: location || undefined,
          notes: notes || undefined,
        },
      });
      onScheduled(interview);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card shadow-2 max-w-[480px] w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border font-semibold">Schedule interview</div>
        <div className="p-6 flex flex-col gap-4">
          {error && <div className="border border-danger bg-red-50 rounded p-3 text-sm text-danger">{error}</div>}
          <div>
            <label className="label">Date &amp; time</label>
            <input className="input" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="label">Duration (minutes)</label>
              <input className="input" type="number" min={5} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
            </div>
            <div>
              <label className="label">Mode</label>
              <select className="input" value={mode} onChange={(e) => setMode(e.target.value as InterviewMode)}>
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{mode === 'VIDEO_CALL' ? 'Meeting link' : mode === 'PHONE' ? 'Phone number' : 'Address'}</label>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Scheduling…' : 'Schedule interview'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
