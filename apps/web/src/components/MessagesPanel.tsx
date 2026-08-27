'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth, useApi } from '@/lib/auth-context';
import { getChatSocket } from '@/lib/socket';
import { seekerDisplayName, linkifyMessage } from '@/lib/format';
import SeekerProfileModal from './SeekerProfileModal';
import SeekerAvatar from './SeekerAvatar';
import CompanyLogo from './CompanyLogo';
import type { Conversation, Message } from '@/lib/types';

function otherPartyName(role: 'JOB_SEEKER' | 'COMPANY', c: Conversation) {
  return role === 'JOB_SEEKER' ? c.company.name : seekerDisplayName(c.seeker);
}

function OtherPartyAvatar({ role, c, size }: { role: 'JOB_SEEKER' | 'COMPANY'; c: Conversation; size: number }) {
  return role === 'JOB_SEEKER' ? <CompanyLogo company={c.company} size={size} rounded="rounded-full" /> : <SeekerAvatar seeker={c.seeker} size={size} />;
}

// Shared thread-list + conversation view for both portals. The seeker and
// company sides differ only in which field of a Conversation is "me" vs
// "the other party" — everything else (history, live delivery, unread
// counts) is identical, so this one component drives both /dashboard/messages
// and /company/messages.
export default function MessagesPanel({ role }: { role: 'JOB_SEEKER' | 'COMPANY' }) {
  const { user, accessToken } = useAuth();
  const api = useApi();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(searchParams.get('c'));
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(false);
  // Below `md`, the list and thread are two separate full-width screens
  // (the 300px-fixed two-pane grid was unusable on a phone) — this tracks
  // which one is showing; ignored at `md` and up, where both are visible.
  const [mobileShowThread, setMobileShowThread] = useState(!!searchParams.get('c'));
  const bottomRef = useRef<HTMLDivElement>(null);

  function loadConversations() {
    setLoadingList(true);
    api<Conversation[]>('/me/conversations')
      .then((list) => {
        setConversations(list);
        if (!activeId && list[0]) setActiveId(list[0].id);
      })
      .finally(() => setLoadingList(false));
  }
  useEffect(loadConversations, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeId) return;
    setLoadingThread(true);
    api<{ data: Message[] }>(`/conversations/${activeId}/messages`)
      .then((res) => setMessages(res.data))
      .finally(() => setLoadingThread(false));
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!accessToken) return;
    const socket = getChatSocket(accessToken);

    function onNew(payload: { conversationId: string; message: Message }) {
      if (payload.conversationId === activeId) {
        setMessages((prev) => [...prev, payload.message]);
      }
      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === payload.conversationId
              ? {
                  ...c,
                  lastMessage: payload.message,
                  lastMessageAt: payload.message.createdAt,
                  unreadCount: payload.conversationId === activeId ? 0 : c.unreadCount + 1,
                }
              : c,
          )
          .sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime()),
      );
    }
    socket.on('message:new', onNew);
    if (activeId) socket.emit('conversation:join', { conversationId: activeId });

    return () => {
      socket.off('message:new', onNew);
      if (activeId) socket.emit('conversation:leave', { conversationId: activeId });
    };
  }, [accessToken, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId]);

  function selectConversation(id: string) {
    setActiveId(id);
    setViewingProfile(false);
    setMobileShowThread(true);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activeId) return;
    setDraft('');
    const socket = accessToken ? getChatSocket(accessToken) : null;
    if (socket?.connected) {
      socket.emit('message:send', { conversationId: activeId, body });
    } else {
      const message = await api<Message>(`/conversations/${activeId}/messages`, { method: 'POST', body: { body } });
      setMessages((prev) => [...prev, message]);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-0 card overflow-hidden h-[calc(100vh-200px)] sm:h-[calc(100vh-160px)] min-h-[420px]">
      <div className={`border-r border-border overflow-y-auto min-h-0 ${mobileShowThread ? 'hidden md:block' : 'block'}`}>
        {loadingList ? (
          <div className="p-4 text-sm text-muted">Loading…</div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-sm text-muted">No conversations yet.</div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => selectConversation(c.id)}
              className={`w-full text-left px-4 py-3 border-b border-ground flex gap-2.5 items-start transition-colors ${c.id === activeId ? 'bg-ground' : 'hover:bg-ground/60'}`}
            >
              <OtherPartyAvatar role={role} c={c} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">{otherPartyName(role, c)}</span>
                  {c.unreadCount > 0 && (
                    <span className="bg-accent text-ink text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-none">{c.unreadCount}</span>
                  )}
                </div>
                {/* Job title is the thread's identity now that a company/seeker
                    pair can have one open thread per posting — badged so it
                    reads as "which conversation" at a glance, not a footnote. */}
                <span className="badge badge-blue max-w-full truncate inline-block my-1">{c.job.title}</span>
                <div className="text-xs text-muted truncate">{c.lastMessage?.body || 'No messages yet'}</div>
              </div>
            </button>
          ))
        )}
      </div>

      <div className={`flex-col min-w-0 min-h-0 ${mobileShowThread ? 'flex' : 'hidden md:flex'}`}>
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted">
            <button onClick={() => setMobileShowThread(false)} className="md:hidden text-primary font-semibold text-xs">
              ← Back to conversations
            </button>
            <span>Select a conversation</span>
          </div>
        ) : (
          <>
            <div className="h-14 border-b border-border flex items-center justify-between px-4 flex-none">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => setMobileShowThread(false)}
                  className="md:hidden text-muted hover:text-ink transition-colors flex-none -ml-1"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <OtherPartyAvatar role={role} c={active} size={32} />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{otherPartyName(role, active)}</div>
                  <div className="text-xs text-primary font-medium truncate">{active.job.title}</div>
                </div>
              </div>
              {role === 'COMPANY' && (
                <button onClick={() => setViewingProfile(true)} className="text-xs text-primary font-semibold flex-none ml-3">
                  👤 View profile
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2.5">
              {loadingThread ? (
                <div className="text-sm text-muted">Loading…</div>
              ) : (
                messages.map((m) => {
                  if (m.isSystem) {
                    return (
                      <div key={m.id} className="self-center max-w-[85%] text-center my-1">
                        <span className="pill bg-ground text-muted border border-border inline-block break-words whitespace-pre-wrap">
                          {linkifyMessage(m.body)}
                        </span>
                        <div className="text-[10px] text-muted mt-1">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  }
                  const mine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={`max-w-[70%] ${mine ? 'self-end' : 'self-start'}`}>
                      <div className={`rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap ${mine ? 'bg-primary text-white' : 'bg-ground text-ink'}`}>
                        {linkifyMessage(m.body)}
                      </div>
                      <div className={`text-[10px] text-muted mt-0.5 ${mine ? 'text-right' : ''}`}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={send} className="border-t border-border p-3 flex gap-2 flex-none">
              <input
                className="input flex-1"
                placeholder="Write a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button className="btn-primary px-5" disabled={!draft.trim()}>Send</button>
            </form>
          </>
        )}
      </div>

      {viewingProfile && active && role === 'COMPANY' && (
        <SeekerProfileModal seeker={active.seeker} onClose={() => setViewingProfile(false)} />
      )}
    </div>
  );
}
