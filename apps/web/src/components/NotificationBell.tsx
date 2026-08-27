'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useAuth, useApi } from '@/lib/auth-context';
import { getNotificationsSocket } from '@/lib/socket';
import type { Notification } from '@/lib/types';

// Bell icon + dropdown, following UserMenu's exact click-toggle +
// outside-click-to-close pattern (hover has no touch equivalent). Live
// updates arrive over the /notifications socket (see socket.ts); the
// initial list is fetched once on mount.
export default function NotificationBell() {
  const { accessToken } = useAuth();
  const api = useApi();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Notification[]>('/me/notifications').then(setItems).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!accessToken) return;
    const socket = getNotificationsSocket(accessToken);
    function onNew(n: Notification) {
      setItems((prev) => [n, ...prev].slice(0, 30));
    }
    socket.on('notification:new', onNew);
    return () => {
      socket.off('notification:new', onNew);
    };
  }, [accessToken]);

  useEffect(() => {
    function onOutside(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, []);

  const unreadCount = items.filter((n) => !n.readAt).length;

  function openNotification(n: Notification) {
    setOpen(false);
    if (!n.readAt) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      api(`/me/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => undefined);
    }
    if (n.link) router.push(n.link);
  }

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    api('/me/notifications/read-all', { method: 'PATCH' }).catch(() => undefined);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Notifications"
        className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-ground transition-colors flex-none"
      >
        <Bell className="w-5 h-5 text-ink" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <div
        className={`absolute right-0 top-full pt-2 z-40 origin-top-right transition-all duration-150 ease-out ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        <div className="w-80 max-w-[calc(100vw-2rem)] max-h-[420px] overflow-y-auto bg-white border border-border rounded-card shadow-2 py-2">
          <div className="px-3.5 py-2 border-b border-ground mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary font-semibold hover:text-primary-pressed transition-colors">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-3.5 py-6 text-sm text-muted text-center">No notifications yet.</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={`w-full text-left px-3.5 py-2.5 border-b border-ground last:border-b-0 hover:bg-ground transition-colors ${!n.readAt ? 'bg-ground/50' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {!n.readAt && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-none" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{n.title}</div>
                    <div className="text-xs text-muted line-clamp-2">{n.body}</div>
                    <div className="text-[10px] text-muted mt-0.5">
                      {new Date(n.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
