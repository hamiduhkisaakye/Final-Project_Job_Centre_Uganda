'use client';

import { useEffect, useRef, useState } from 'react';
import { useApi, useApiUpload } from '@/lib/auth-context';
import { API_ORIGIN, ApiError } from '@/lib/api';
import type { BlogPost, BlogPostStatus } from '@/lib/types';

interface EditorState {
  id?: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  status: BlogPostStatus;
}

function toEditorState(p?: BlogPost): EditorState {
  return p
    ? { id: p.id, title: p.title, excerpt: p.excerpt || '', content: p.content, coverImageUrl: p.coverImageUrl || '', status: p.status }
    : { title: '', excerpt: '', content: '', coverImageUrl: '', status: 'DRAFT' };
}

export default function AdminBlogPage() {
  const api = useApi();
  const upload = useApiUpload();
  const fileRef = useRef<HTMLInputElement>(null);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api<BlogPost[]>('/admin/blog').then(setPosts).finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploadingCover(true);
    setCoverError(null);
    try {
      const { coverImageUrl } = await upload<{ coverImageUrl: string }>('/uploads/blog-cover', file);
      setEditor((prev) => (prev ? { ...prev, coverImageUrl } : prev));
    } catch (err) {
      setCoverError(err instanceof ApiError ? err.message : 'Upload failed — please try again.');
    } finally {
      setUploadingCover(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save() {
    if (!editor) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: editor.title,
        excerpt: editor.excerpt || undefined,
        content: editor.content,
        coverImageUrl: editor.coverImageUrl || undefined,
      };
      if (editor.id) {
        await api(`/admin/blog/${editor.id}`, { method: 'PATCH', body });
      } else {
        await api('/admin/blog', { method: 'POST', body });
      }
      setEditor(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(post: BlogPost) {
    setBusyId(post.id);
    try {
      await api(`/admin/blog/${post.id}/${post.status === 'PUBLISHED' ? 'unpublish' : 'publish'}`, { method: 'POST' });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(post: BlogPost) {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setBusyId(post.id);
    try {
      await api(`/admin/blog/${post.id}`, { method: 'DELETE' });
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (editor) {
    return (
      <div className="max-w-[760px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h1 className="text-2xl font-bold">{editor.id ? 'Edit post' : 'New post'}</h1>
          <button className="btn-ghost w-fit" onClick={() => setEditor(null)}>← Back to posts</button>
        </div>

        <div className="card p-6 flex flex-col gap-4">
          {error && <div className="border border-danger bg-red-50 rounded p-3 text-sm text-danger">{error}</div>}

          <div className="flex items-center gap-4">
            <div className="w-32 h-20 rounded bg-ground flex-none overflow-hidden">
              {editor.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${API_ORIGIN}${editor.coverImageUrl}`} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted">No cover</div>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold mb-1">Cover image</div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onCoverChange} disabled={uploadingCover} className="text-sm" />
              <div className="text-xs text-muted mt-1">PNG, JPEG or WebP, up to 2MB.</div>
              {uploadingCover && <div className="text-xs text-primary mt-1">Uploading…</div>}
              {coverError && <div className="text-xs text-danger mt-1">{coverError}</div>}
            </div>
          </div>

          <div>
            <label className="label">Title</label>
            <input className="input" value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} placeholder="5 tips for a standout CV" />
          </div>
          <div>
            <label className="label">Excerpt (optional)</label>
            <textarea
              className="input h-20"
              value={editor.excerpt}
              onChange={(e) => setEditor({ ...editor, excerpt: e.target.value })}
              placeholder="Shown on the blog index card — falls back to the start of the post if left blank."
            />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea
              className="input h-64"
              value={editor.content}
              onChange={(e) => setEditor({ ...editor, content: e.target.value })}
              placeholder="Write the post. Leave a blank line between paragraphs."
            />
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button className="btn-primary" disabled={saving || !editor.title || !editor.content} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {editor.id && (
              <span className={`badge ${editor.status === 'PUBLISHED' ? 'badge-blue' : 'badge-grey'}`}>
                {editor.status === 'PUBLISHED' ? 'Published' : 'Draft'}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Blog</h1>
          <p className="text-sm text-muted mt-1">Write and publish posts to the public blog.</p>
        </div>
        <button className="btn-primary w-fit flex-none" onClick={() => setEditor(toEditorState())}>+ New post</button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No posts yet. Create your first one.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-white text-left">
                <th className="px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap">TITLE</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap">STATUS</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap">DATE</th>
                <th className="px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p, i) => (
                <tr key={p.id} className={i % 2 ? 'bg-ground' : ''}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{p.title}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`badge ${p.status === 'PUBLISHED' ? 'badge-blue' : 'badge-grey'}`}>
                      {p.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">
                    {new Date(p.publishedAt || p.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button className="text-primary font-semibold" onClick={() => setEditor(toEditorState(p))}>Edit</button>
                      <button disabled={busyId === p.id} className="text-primary font-semibold" onClick={() => togglePublish(p)}>
                        {p.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button disabled={busyId === p.id} className="text-danger" onClick={() => remove(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
