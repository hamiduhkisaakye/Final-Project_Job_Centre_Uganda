'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import type { Interview, InterviewMode } from '@/lib/types';

const MODES: { value: InterviewMode; label: string }[] = [
  { value: 'VIDEO_CALL', label: 'Video call' },
  { value: 'PHONE', label: 'Phone call' },
  { value: 'IN_PERSON', label: 'In person' },
];

// Offers one or more candidate times — the interview sits PROPOSED until
// the seeker confirms one (see interviews.service.ts#propose/confirmSlot).
// Even a single time still goes through that accept step.
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
  const [slots, setSlots] = useState<string[]>(['']);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [mode, setMode] = useState<InterviewMode>('VIDEO_CALL');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSlot(i: number, value: string) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  }

  async function submit() {
    const filled = slots.filter(Boolean);
    if (filled.length === 0) {
      setError('Offer at least one date and time');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const interview = await api<Interview>(`/applications/${applicationId}/interviews`, {
        method: 'POST',
        body: {
          slots: filled.map((s) => new Date(s).toISOString()),
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
        <div className="px-6 py-4 border-b border-border font-semibold">Propose interview time(s)</div>
        <div className="p-6 flex flex-col gap-4">
          {error && <div className="border border-danger bg-red-50 rounded p-3 text-sm text-danger">{error}</div>}
          <div>
            <label className="label">Candidate times</label>
            <div className="flex flex-col gap-2">
              {slots.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="input flex-1" type="datetime-local" value={s} onChange={(e) => updateSlot(i, e.target.value)} />
                  {slots.length > 1 && (
                    <button type="button" onClick={() => setSlots((prev) => prev.filter((_, idx) => idx !== i))} className="text-danger p-1" aria-label="Remove time">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSlots((prev) => [...prev, ''])}
              className="text-primary text-xs font-semibold mt-2 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add another time
            </button>
            <p className="text-xs text-muted mt-1.5">The candidate picks whichever works best for them.</p>
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
            <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Send to candidate'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
