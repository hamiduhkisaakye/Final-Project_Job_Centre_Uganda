'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { CATEGORY_ICONS, categoryIcon } from '@/lib/category-icons';
import type { Category } from '@/lib/types';

const ICON_NAMES = Object.keys(CATEGORY_ICONS);

interface EditorState {
  id?: string;
  name: string;
  icon: string;
  sortOrder: string;
}

function toEditorState(c?: Category): EditorState {
  return c
    ? { id: c.id, name: c.name, icon: c.icon, sortOrder: String(c.sortOrder) }
    : { name: '', icon: ICON_NAMES[0], sortOrder: '0' };
}

export default function AdminCategoriesPage() {
  const api = useApi();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api<Category[]>('/categories').then(setCategories).finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!editor) return;
    setSaving(true);
    setError(null);
    try {
      const body = { name: editor.name, icon: editor.icon, sortOrder: Number(editor.sortOrder) || 0 };
      if (editor.id) {
        await api(`/admin/categories/${editor.id}`, { method: 'PATCH', body });
      } else {
        await api('/admin/categories', { method: 'POST', body });
      }
      setEditor(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Delete "${c.name}"? Jobs already posted under this category keep it — this only removes it from the picklist.`)) return;
    setBusyId(c.id);
    try {
      await api(`/admin/categories/${c.id}`, { method: 'DELETE' });
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (editor) {
    const Preview = categoryIcon(editor.icon);
    return (
      <div className="max-w-[560px]">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h1 className="text-2xl font-bold">{editor.id ? 'Edit category' : 'New category'}</h1>
          <button className="btn-ghost w-fit" onClick={() => setEditor(null)}>← Back to categories</button>
        </div>

        <div className="card p-6 flex flex-col gap-4">
          {error && <div className="border border-danger bg-red-50 rounded p-3 text-sm text-danger">{error}</div>}
          <div>
            <label className="label">Name</label>
            <input className="input" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="Sales & Marketing" />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3.5 items-end">
            <div>
              <label className="label">Icon</label>
              <select className="input" value={editor.icon} onChange={(e) => setEditor({ ...editor, icon: e.target.value })}>
                {ICON_NAMES.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="w-11 h-11 rounded bg-ground flex items-center justify-center flex-none">
              <Preview className="w-6 h-6 text-primary" strokeWidth={1.75} />
            </div>
          </div>
          <div className="max-w-[180px]">
            <label className="label">Sort order</label>
            <input className="input" type="number" value={editor.sortOrder} onChange={(e) => setEditor({ ...editor, sortOrder: e.target.value })} />
            <p className="text-xs text-muted mt-1.5">Lower numbers appear first on the homepage&apos;s top 8.</p>
          </div>
          <div>
            <button className="btn-primary" disabled={saving || !editor.name} onClick={save}>
              {saving ? 'Saving…' : 'Save category'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted mt-1">Manage the picklist used by job postings, filters and the homepage.</p>
        </div>
        <button className="btn-primary w-fit flex-none" onClick={() => setEditor(toEditorState())}>+ New category</button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : categories.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No categories yet. Create your first one.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-white text-left">
                <th className="px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap">CATEGORY</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap">JOBS</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap">SORT</th>
                <th className="px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => {
                const Icon = categoryIcon(c.icon);
                return (
                  <tr key={c.id} className={i % 2 ? 'bg-ground' : ''}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-ground flex items-center justify-center flex-none">
                          <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
                        </div>
                        {c.name}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted whitespace-nowrap">{c.jobCount.toLocaleString()}</td>
                    <td className="px-3 py-3 text-muted whitespace-nowrap">{c.sortOrder}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button className="text-primary font-semibold" onClick={() => setEditor(toEditorState(c))}>Edit</button>
                        <button disabled={busyId === c.id} className="text-danger" onClick={() => remove(c)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
