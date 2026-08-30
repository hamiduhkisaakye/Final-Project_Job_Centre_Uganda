'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useApi } from '@/lib/auth-context';

export default function CompanyFollowButton({ companyId, initialCount }: { companyId: string; initialCount: number }) {
  const { user } = useAuth();
  const api = useApi();
  const router = useRouter();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'JOB_SEEKER') return;
    api<{ following: boolean }>(`/companies/${companyId}/follow`).then((r) => setFollowing(r.following)).catch(() => undefined);
  }, [user, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Companies/admins viewing a profile have no use for following it.
  if (user && user.role !== 'JOB_SEEKER') return null;

  async function toggle() {
    if (!user) return router.push('/login');
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await api(`/companies/${companyId}/follow`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      setFollowing(!next);
      setCount((c) => c - (next ? 1 : -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className={following ? 'btn-secondary' : 'btn-primary'} onClick={toggle} disabled={busy}>
      {following ? '✓ Following' : '+ Follow'}
      {count > 0 && <span className="opacity-70 font-normal"> · {count.toLocaleString()}</span>}
    </button>
  );
}
