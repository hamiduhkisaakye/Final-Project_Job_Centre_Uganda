'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import type { Assessment, AssessmentQuestion } from '@/lib/types';

const EMPTY_QUESTION: AssessmentQuestion = { question: '', options: ['', ''], correctIndex: 0 };

interface EditorState {
  id?: string;
  title: string;
  description: string;
  passScore: string;
  questions: AssessmentQuestion[];
}

function toEditorState(a?: Assessment): EditorState {
  return a
    ? { id: a.id, title: a.title, description: a.description || '', passScore: String(a.passScore), questions: a.questions }
    : { title: '', description: '', passScore: '60', questions: [{ ...EMPTY_QUESTION, options: [...EMPTY_QUESTION.options] }] };
}

export default function CompanyAssessmentsPage() {
  const api = useApi();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api<Assessment[]>('/company/assessments').then(setAssessments).finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  function addQuestion() {
    if (!editor) return;
    setEditor({ ...editor, questions: [...editor.questions, { ...EMPTY_QUESTION, options: [...EMPTY_QUESTION.options] }] });
  }

  function removeQuestion(qi: number) {
    if (!editor) return;
    setEditor({ ...editor, questions: editor.questions.filter((_, i) => i !== qi) });
  }

  function updateQuestion(qi: number, patch: Partial<AssessmentQuestion>) {
    if (!editor) return;
    setEditor({ ...editor, questions: editor.questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) });
  }

  function addOption(qi: number) {
    if (!editor) return;
    updateQuestion(qi, { options: [...editor.questions[qi].options, ''] });
  }

  function removeOption(qi: number, oi: number) {
    if (!editor) return;
    const q = editor.questions[qi];
    const options = q.options.filter((_, i) => i !== oi);
    const correctIndex = q.correctIndex === oi ? 0 : q.correctIndex! > oi ? q.correctIndex! - 1 : q.correctIndex;
    updateQuestion(qi, { options, correctIndex });
  }

  function updateOption(qi: number, oi: number, value: string) {
    if (!editor) return;
    const options = editor.questions[qi].options.map((o, i) => (i === oi ? value : o));
    updateQuestion(qi, { options });
  }

  async function save() {
    if (!editor) return;
    setSaving(true);
    setError(null);
    try {
      const questions = editor.questions.map((q) => ({
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        correctIndex: q.correctIndex ?? 0,
      }));
      for (const q of questions) {
        if (!q.question) throw new ApiError(400, 'Every question needs text');
        if (q.options.some((o) => !o)) throw new ApiError(400, 'Every option needs text');
      }
      const body = { title: editor.title, description: editor.description || undefined, passScore: Number(editor.passScore) || 60, questions };
      if (editor.id) {
        await api(`/company/assessments/${editor.id}`, { method: 'PATCH', body });
      } else {
        await api('/company/assessments', { method: 'POST', body });
      }
      setEditor(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (editor) {
    return (
      <div className="max-w-[760px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h1 className="text-2xl font-bold">{editor.id ? 'Edit assessment' : 'New assessment'}</h1>
          <button className="btn-ghost w-fit" onClick={() => setEditor(null)}>← Back to assessments</button>
        </div>

        <div className="card p-6 flex flex-col gap-4 mb-5">
          {error && <div className="border border-danger bg-red-50 rounded p-3 text-sm text-danger">{error}</div>}
          <div>
            <label className="label">Title</label>
            <input className="input" value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} placeholder="Excel Basics" />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea className="input h-20" value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
          </div>
          <div className="max-w-[220px]">
            <label className="label">Pass score (%)</label>
            <input className="input" type="number" min={1} max={100} value={editor.passScore} onChange={(e) => setEditor({ ...editor, passScore: e.target.value })} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {editor.questions.map((q, qi) => (
            <div key={qi} className="card p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <label className="label">Question {qi + 1}</label>
                  <input className="input" value={q.question} onChange={(e) => updateQuestion(qi, { question: e.target.value })} placeholder="What does VLOOKUP do?" />
                </div>
                {editor.questions.length > 1 && (
                  <button className="text-danger text-sm mt-6" onClick={() => removeQuestion(qi)}>Remove</button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correctIndex === oi}
                      onChange={() => updateQuestion(qi, { correctIndex: oi })}
                      title="Mark as the correct answer"
                    />
                    <input
                      className="input flex-1 h-9"
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                    />
                    {q.options.length > 2 && (
                      <button className="text-danger text-xs px-1" onClick={() => removeOption(qi, oi)}>✕</button>
                    )}
                  </div>
                ))}
                <button className="text-primary text-xs font-semibold text-left mt-1" onClick={() => addOption(qi)}>+ Add option</button>
              </div>
            </div>
          ))}
          <button className="btn-secondary w-fit" onClick={addQuestion}>+ Add question</button>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button className="btn-primary" disabled={saving || !editor.title} onClick={save}>
            {saving ? 'Saving…' : 'Save assessment'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Skills Assessments</h1>
          <p className="text-sm text-muted mt-1">Attach an assessment to a job posting to screen applicants automatically.</p>
        </div>
        <button className="btn-primary w-fit flex-none" onClick={() => setEditor(toEditorState())}>+ New assessment</button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : assessments.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          No assessments yet. Create one to attach to a job posting.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {assessments.map((a) => (
            <div key={a.id} className="card p-5 flex flex-col gap-2">
              <div className="font-semibold">{a.title}</div>
              {a.description && <p className="text-sm text-muted line-clamp-2">{a.description}</p>}
              <div className="flex items-center gap-3 text-xs text-muted mt-1">
                <span>{a.questions.length} question{a.questions.length === 1 ? '' : 's'}</span>
                <span>·</span>
                <span>Pass at {a.passScore}%</span>
              </div>
              <button className="btn-secondary h-9 text-sm w-fit mt-2" onClick={() => setEditor(toEditorState(a))}>Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
