'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, CheckCheck, Paperclip, Search, Star, X } from 'lucide-react';
import { useAuth, useApi, useApiUpload } from '@/lib/auth-context';
import { getChatSocket } from '@/lib/socket';
import { seekerDisplayName, linkifyMessage } from '@/lib/format';
import { API_ORIGIN } from '@/lib/api';
import SeekerProfileModal from './SeekerProfileModal';
import SeekerAvatar from './SeekerAvatar';
import CompanyLogo from './CompanyLogo';
import ConversationContextPanel from './ConversationContextPanel';
import type { Conversation, Message } from '@/lib/types';

function otherPartyName(role: 'JOB_SEEKER' | 'COMPANY', c: Conversation) {
  return role === 'JOB_SEEKER' ? c.company.name : seekerDisplayName(c.seeker);
}

function OtherPartyAvatar({ role, c, size, online }: { role: 'JOB_SEEKER' | 'COMPANY'; c: Conversation; size: number; online?: boolean }) {
  return (
    <div className="relative flex-none">
      {role === 'JOB_SEEKER' ? <CompanyLogo company={c.company} size={size} rounded="rounded-full" /> : <SeekerAvatar seeker={c.seeker} size={size} />}
      {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success border-2 border-white" />}
    </div>
  );
}

function AttachmentPreview({ m }: { m: Message }) {
  if (!m.attachmentUrl) return null;
  const url = `${API_ORIGIN}${m.attachmentUrl}`;
  if (m.attachmentType === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={m.attachmentName || 'Attachment'} className="max-w-[220px] max-h-[220px] rounded object-cover" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 mt-1.5 text-sm underline">
      <Paperclip className="w-3.5 h-3.5 flex-none" /> {m.attachmentName || 'Attachment'}
    </a>
  );
}

// Shared thread-list + conversation view for both portals. The seeker and
// company sides differ only in which field of a Conversation is "me" vs
// "the other party" — everything else (history, live delivery, unread
// counts) is identical, so this one component drives both /dashboard/messages
// and /company/messages.
export default function MessagesPanel({ role }: { role: 'JOB_SEEKER' | 'COMPANY' }) {
  const { user, accessToken } = useAuth();
  const api = useApi();
  const upload = useApiUpload();
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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otherTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setOtherTyping(false);
    setOtherOnline(false);
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
        if (payload.message.senderId !== user?.id) setOtherTyping(false);
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

    function onRead(payload: { conversationId: string; readerId: string; readAt: string }) {
      if (payload.conversationId !== activeId || payload.readerId === user?.id) return;
      setMessages((prev) => prev.map((m) => (m.senderId === user?.id && !m.readAt ? { ...m, readAt: payload.readAt } : m)));
    }

    function onTyping(payload: { conversationId: string; userId: string; isTyping: boolean }) {
      if (payload.conversationId !== activeId || payload.userId === user?.id) return;
      setOtherTyping(payload.isTyping);
      if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
      if (payload.isTyping) otherTypingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 6000);
    }

    function onPresence(payload: { conversationId: string; userId: string; online: boolean }) {
      if (payload.conversationId !== activeId || payload.userId === user?.id) return;
      setOtherOnline(payload.online);
    }

    socket.on('message:new', onNew);
    socket.on('message:read', onRead);
    socket.on('typing:update', onTyping);
    socket.on('presence:update', onPresence);
    if (activeId) socket.emit('conversation:join', { conversationId: activeId });

    return () => {
      socket.off('message:new', onNew);
      socket.off('message:read', onRead);
      socket.off('typing:update', onTyping);
      socket.off('presence:update', onPresence);
      if (activeId) socket.emit('conversation:leave', { conversationId: activeId });
    };
  }, [accessToken, activeId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'unread' && c.unreadCount === 0) return false;
      if (filter === 'starred' && !c.starred) return false;
      if (q && !(otherPartyName(role, c).toLowerCase().includes(q) || c.job.title.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [conversations, search, filter, role]);

  function selectConversation(id: string) {
    setActiveId(id);
    setViewingProfile(false);
    setMobileShowThread(true);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  }

  function emitTyping(isTyping: boolean) {
    if (!accessToken || !activeId) return;
    getChatSocket(accessToken).emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId: activeId });
  }

  function onDraftChange(value: string) {
    setDraft(value);
    emitTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 2000);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activeId) return;
    setDraft('');
    emitTyping(false);
    const socket = accessToken ? getChatSocket(accessToken) : null;
    if (socket?.connected) {
      socket.emit('message:send', { conversationId: activeId, body });
    } else {
      const message = await api<Message>(`/conversations/${activeId}/messages`, { method: 'POST', body: { body } });
      setMessages((prev) => [...prev, message]);
    }
  }

  async function onAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    setUploadingAttachment(true);
    setAttachmentError(null);
    try {
      const attachment = await upload<{ url: string; type: string; name: string }>('/uploads/chat-attachment', file);
      const socket = accessToken ? getChatSocket(accessToken) : null;
      if (socket?.connected) {
        socket.emit('message:send', { conversationId: activeId, body: '', attachment });
      } else {
        const message = await api<Message>(`/conversations/${activeId}/messages`, {
          method: 'POST',
          body: { attachmentUrl: attachment.url, attachmentType: attachment.type, attachmentName: attachment.name },
        });
        setMessages((prev) => [...prev, message]);
      }
    } catch {
      setAttachmentError('Upload failed — please try again.');
    } finally {
      setUploadingAttachment(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function toggleStar(id: string) {
    const result = await api<{ starred: boolean }>(`/conversations/${id}/star`, { method: 'POST' });
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, starred: result.starred } : c)));
  }

  async function unblockConversation(id: string) {
    await api(`/conversations/${id}/unblock`, { method: 'POST' });
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, blocked: false } : c)));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-0 card overflow-hidden h-[calc(100vh-200px)] sm:h-[calc(100vh-160px)] min-h-[420px]">
      <div className={`border-r border-border flex flex-col min-h-0 ${mobileShowThread ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 border-b border-border flex-none flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-ground rounded px-3 h-9">
            <Search className="w-4 h-4 text-muted flex-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages"
              className="bg-transparent text-sm outline-none flex-1 min-w-0"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(['all', 'unread', 'starred'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`pill border text-xs ${filter === f ? 'bg-primary text-white border-primary' : 'bg-white border-border text-ink/80'}`}
              >
                {f === 'all' ? 'All' : f === 'unread' ? `Unread ${conversations.filter((c) => c.unreadCount > 0).length || ''}` : 'Starred'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto min-h-0 flex-1">
          {loadingList ? (
            <div className="p-4 text-sm text-muted">Loading…</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-sm text-muted">{conversations.length === 0 ? 'No conversations yet.' : 'No conversations match.'}</div>
          ) : (
            filteredConversations.map((c) => (
              <div
                key={c.id}
                className={`w-full text-left px-4 py-3 border-b border-ground flex gap-2.5 items-start transition-colors cursor-pointer ${c.id === activeId ? 'bg-ground' : 'hover:bg-ground/60'}`}
                onClick={() => selectConversation(c.id)}
              >
                <OtherPartyAvatar role={role} c={c} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate flex items-center gap-1.5">
                      {otherPartyName(role, c)}
                      {c.starred && <Star className="w-3 h-3 text-accent-pressed flex-none" fill="currentColor" />}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="bg-accent text-ink text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-none">{c.unreadCount}</span>
                    )}
                  </div>
                  {/* Job title is the thread's identity now that a company/seeker
                      pair can have one open thread per posting — badged so it
                      reads as "which conversation" at a glance, not a footnote. */}
                  <span className="badge badge-blue max-w-full truncate inline-block my-1">{c.job.title}</span>
                  <div className="text-xs text-muted truncate">{c.lastMessage?.body || (c.lastMessage?.attachmentUrl ? '📎 Attachment' : 'No messages yet')}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleStar(c.id); }}
                  className="flex-none text-muted hover:text-accent-pressed transition-colors"
                  aria-label={c.starred ? 'Unstar' : 'Star'}
                >
                  <Star className="w-4 h-4" fill={c.starred ? 'currentColor' : 'none'} />
                </button>
              </div>
            ))
          )}
        </div>
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
          <div className="flex flex-1 min-h-0">
            <div className="flex flex-col flex-1 min-w-0 min-h-0">
              <div className="h-14 border-b border-border flex items-center justify-between px-4 flex-none">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setMobileShowThread(false)}
                    className="md:hidden text-muted hover:text-ink transition-colors flex-none -ml-1"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <OtherPartyAvatar role={role} c={active} size={32} online={otherOnline} />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{otherPartyName(role, active)}</div>
                    <div className="text-xs truncate">
                      {otherTyping ? (
                        <span className="text-primary font-medium">typing…</span>
                      ) : (
                        <span className="text-primary font-medium">{active.job.title}</span>
                      )}
                    </div>
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
                        {(m.body || !m.attachmentUrl) && (
                          <div className={`rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap ${mine ? 'bg-primary text-white' : 'bg-ground text-ink'}`}>
                            {m.body && linkifyMessage(m.body)}
                            {m.attachmentUrl && <AttachmentPreview m={m} />}
                          </div>
                        )}
                        {!m.body && m.attachmentUrl && (
                          <div className={`rounded-lg px-2 py-2 ${mine ? 'bg-primary text-white' : 'bg-ground text-ink'}`}>
                            <AttachmentPreview m={m} />
                          </div>
                        )}
                        <div className={`flex items-center gap-1 text-[10px] text-muted mt-0.5 ${mine ? 'justify-end' : ''}`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {mine && (m.readAt ? <CheckCheck className="w-3 h-3 text-primary" /> : <Check className="w-3 h-3" />)}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
              {active.blocked ? (
                <div className="border-t border-border p-3 flex-none flex items-center justify-between gap-3 bg-ground">
                  <span className="text-sm text-muted">This conversation has been blocked — no further messages can be sent.</span>
                  <button className="text-primary text-sm font-semibold flex-none" onClick={() => unblockConversation(active.id)}>Unblock</button>
                </div>
              ) : (
                <>
                  <form onSubmit={send} className="border-t border-border p-3 flex gap-2 flex-none items-center">
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,.pdf,.doc,.docx" onChange={onAttachmentChange} className="hidden" />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadingAttachment}
                      className="text-muted hover:text-primary transition-colors flex-none p-2"
                      aria-label="Attach a file"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                      className="input flex-1"
                      placeholder={uploadingAttachment ? 'Uploading…' : 'Write a message… (Enter to send)'}
                      value={draft}
                      onChange={(e) => onDraftChange(e.target.value)}
                      disabled={uploadingAttachment}
                    />
                    <button className="btn-primary px-5" disabled={!draft.trim()}>Send</button>
                  </form>
                  {attachmentError && <div className="px-4 pb-2 text-xs text-danger flex-none">{attachmentError}</div>}
                </>
              )}
            </div>

            <ConversationContextPanel
              conversation={active}
              role={role}
              onBlocked={() => {
                setConversations((prev) => prev.map((c) => (c.id === active.id ? { ...c, blocked: true } : c)));
              }}
            />
          </div>
        )}
      </div>

      {viewingProfile && active && role === 'COMPANY' && (
        <SeekerProfileModal seeker={active.seeker} onClose={() => setViewingProfile(false)} />
      )}
    </div>
  );
}
