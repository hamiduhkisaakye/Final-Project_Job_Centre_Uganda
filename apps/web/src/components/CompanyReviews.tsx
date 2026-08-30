'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useAuth, useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { seekerDisplayName, seekerInitials } from '@/lib/format';
import SeekerAvatar from './SeekerAvatar';
import type { Company, CompanyReview } from '@/lib/types';

function StarRow({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i <= Math.round(value) ? 'text-accent' : 'text-border'}
          fill={i <= Math.round(value) ? 'currentColor' : 'none'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} star${i === 1 ? '' : 's'}`}>
          <Star
            width={26}
            height={26}
            className={i <= value ? 'text-accent' : 'text-border'}
            fill={i <= value ? 'currentColor' : 'none'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' });
}

export default function CompanyReviews({ company, initialReviews }: { company: Company; initialReviews: CompanyReview[] }) {
  const { user } = useAuth();
  const api = useApi();
  const [reviews, setReviews] = useState(initialReviews);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [editingMine, setEditingMine] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const isCompanyOwner = user?.role === 'COMPANY' && user.company?.id === company.id;
  const myReview = user?.role === 'JOB_SEEKER' ? reviews.find((r) => r.seekerId === user.id) : undefined;

  function load() {
    api<CompanyReview[]>(`/companies/${company.id}/reviews`).then(setReviews).catch(() => undefined);
  }

  useEffect(() => {
    if (myReview) {
      setMyRating(myReview.rating);
      setMyComment(myReview.comment || '');
    }
  }, [myReview?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitReview() {
    if (myRating < 1) return setError('Pick a star rating first');
    setSaving(true);
    setError(null);
    try {
      await api(`/companies/${company.id}/reviews`, { method: 'POST', body: { rating: myRating, comment: myComment || undefined } });
      setEditingMine(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function deleteMyReview() {
    if (!confirm('Delete your review? This cannot be undone.')) return;
    setSaving(true);
    try {
      await api(`/companies/${company.id}/reviews`, { method: 'DELETE' });
      setMyRating(0);
      setMyComment('');
      setEditingMine(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  function openResponse(review: CompanyReview) {
    setRespondingTo(review.id);
    setResponseText(review.response || '');
  }

  async function submitResponse(reviewId: string) {
    setBusyId(reviewId);
    try {
      await api(`/companies/${company.id}/reviews/${reviewId}/response`, { method: 'POST', body: { response: responseText } });
      setRespondingTo(null);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        {company.avgRating != null ? (
          <>
            <StarRow value={company.avgRating} size={20} />
            <span className="text-lg font-bold">{company.avgRating.toFixed(1)}</span>
            <span className="text-sm text-muted">({reviews.length} review{reviews.length === 1 ? '' : 's'})</span>
          </>
        ) : (
          <span className="text-sm text-muted">No reviews yet — be the first to share your experience.</span>
        )}
      </div>

      {user?.role === 'JOB_SEEKER' && (
        <div className="card p-5 mb-6">
          {myReview && !editingMine ? (
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold mb-1">Your review</div>
                <StarRow value={myReview.rating} />
              </div>
              <div className="flex items-center gap-3 text-sm flex-none">
                <button className="text-primary font-semibold" onClick={() => setEditingMine(true)}>Edit</button>
                <button className="text-danger" onClick={deleteMyReview} disabled={saving}>Delete</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-sm font-semibold">{myReview ? 'Edit your review' : `Review ${company.name}`}</div>
              <StarPicker value={myRating} onChange={setMyRating} />
              <textarea
                className="input h-20"
                value={myComment}
                onChange={(e) => setMyComment(e.target.value)}
                placeholder="Share what it's like to work with this company (optional)"
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex gap-2">
                {myReview && (
                  <button className="btn-secondary" onClick={() => { setEditingMine(false); setError(null); }} disabled={saving}>
                    Cancel
                  </button>
                )}
                <button className="btn-primary" onClick={submitReview} disabled={saving}>
                  {saving ? 'Saving…' : myReview ? 'Update review' : 'Post review'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted">No reviews yet.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {reviews.map((r) => (
            <div key={r.id} className="border-b border-ground pb-5 last:border-0">
              <div className="flex items-start gap-3 mb-2">
                <SeekerAvatar seeker={{ seekerProfile: r.seeker?.seekerProfile }} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{seekerDisplayName({ seekerProfile: r.seeker?.seekerProfile }) || seekerInitials({ seekerProfile: r.seeker?.seekerProfile })}</div>
                  <div className="flex items-center gap-2">
                    <StarRow value={r.rating} />
                    <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                  </div>
                </div>
              </div>
              {r.comment && <p className="text-sm leading-relaxed mb-2 ml-[52px]">{r.comment}</p>}

              {r.response && respondingTo !== r.id && (
                <div className="ml-[52px] bg-ground rounded p-3.5">
                  <div className="text-xs font-bold text-primary mb-1">Response from {company.name}</div>
                  <p className="text-sm leading-relaxed">{r.response}</p>
                  {isCompanyOwner && (
                    <button className="text-primary text-xs font-semibold mt-1.5" onClick={() => openResponse(r)}>Edit response</button>
                  )}
                </div>
              )}

              {isCompanyOwner && !r.response && respondingTo !== r.id && (
                <button className="text-primary text-sm font-semibold ml-[52px]" onClick={() => openResponse(r)}>Respond as {company.name}</button>
              )}

              {isCompanyOwner && respondingTo === r.id && (
                <div className="ml-[52px] flex flex-col gap-2">
                  <textarea
                    className="input h-20"
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Reply publicly to this review…"
                  />
                  <div className="flex gap-2">
                    <button className="btn-secondary h-9 text-sm" onClick={() => setRespondingTo(null)} disabled={busyId === r.id}>Cancel</button>
                    <button className="btn-primary h-9 text-sm" onClick={() => submitResponse(r.id)} disabled={busyId === r.id || !responseText.trim()}>
                      {busyId === r.id ? 'Saving…' : 'Post response'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
