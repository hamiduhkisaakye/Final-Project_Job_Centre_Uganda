'use client';

import { Suspense } from 'react';
import MessagesPanel from '@/components/MessagesPanel';

export default function SeekerMessagesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Messages</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <MessagesPanel role="JOB_SEEKER" />
      </Suspense>
    </div>
  );
}
