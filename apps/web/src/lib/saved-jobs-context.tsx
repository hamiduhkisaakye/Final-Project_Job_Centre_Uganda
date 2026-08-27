'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth, useApi } from './auth-context';

interface SavedJobsState {
  loaded: boolean;
  isSaved: (jobId: string) => boolean;
  toggleSave: (jobId: string) => Promise<void>;
}

const SavedJobsContext = createContext<SavedJobsState | null>(null);

// Centralizes "which jobs has this seeker saved" so every save button
// (JobCard's bookmark icon, ApplyPanel's Save job button) reads/writes the
// same state instead of each tracking its own local, always-starts-false
// boolean — which meant a job saved from one place still showed unsaved
// everywhere else until a full reload.
export function SavedJobsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const api = useApi();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'JOB_SEEKER') {
      setSavedIds(new Set());
      setLoaded(true);
      return;
    }
    let cancelled = false;
    api<{ jobId: string }[]>('/saved-jobs')
      .then((items) => {
        if (!cancelled) setSavedIds(new Set(items.map((i) => i.jobId)));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const toggleSave = useCallback(
    async (jobId: string) => {
      const wasSaved = savedIds.has(jobId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        wasSaved ? next.delete(jobId) : next.add(jobId);
        return next;
      });
      try {
        if (wasSaved) {
          await api(`/saved-jobs/${jobId}`, { method: 'DELETE' });
        } else {
          await api('/saved-jobs', { method: 'POST', body: { jobId } });
        }
      } catch {
        // Revert the optimistic update if the request failed.
        setSavedIds((prev) => {
          const next = new Set(prev);
          wasSaved ? next.add(jobId) : next.delete(jobId);
          return next;
        });
      }
    },
    [savedIds, api],
  );

  const isSaved = useCallback((jobId: string) => savedIds.has(jobId), [savedIds]);

  return <SavedJobsContext.Provider value={{ loaded, isSaved, toggleSave }}>{children}</SavedJobsContext.Provider>;
}

export function useSavedJobs() {
  const ctx = useContext(SavedJobsContext);
  if (!ctx) throw new Error('useSavedJobs must be used within SavedJobsProvider');
  return ctx;
}
