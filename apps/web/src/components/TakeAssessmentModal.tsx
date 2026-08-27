'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import type { AssessmentAttempt } from '@/lib/types';

interface AssessmentForTaking {
  id: string;
  title: string;
  description?: string | null;
  passScore: number;
  questions: { question: string; options: string[] }[];
}

// Opened from ApplyPanel when a job has a required assessment attached.
// Submits to POST /assessments/:id/attempts, which scores server-side —
// correctIndex never reaches this component (see assessments.service.ts#forSeeker).
export default function TakeAssessmentModal({
  assessmentId,
  onClose,
  onPassed,
}: {
  assessmentId: string;
  onClose: () => void;
  onPassed: () => void;
}) {
  const api = useApi();
  const [assessment, setAssessment] = useState<AssessmentForTaking | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AssessmentForTaking>(`/assessments/${assessmentId}`)
      .then((a) => {
        setAssessment(a);
        setAnswers(new Array(a.questions.length).fill(-1));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  async function submit() {
    if (answers.some((a) => a === -1)) {
      setError('Answer every question before submitting');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const attempt = await api<AssessmentAttempt>(`/assessments/${assessmentId}/attempts`, {
        method: 'POST',
        body: { answers },
      });
      setResult(attempt);
      if (attempt.passed) onPassed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card shadow-2 max-w-[640px] w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="p-8 text-sm text-muted">Loading assessment…</div>
        ) : !assessment ? (
          <div className="p-8 text-sm text-danger">Couldn&apos;t load this assessment.</div>
        ) : result ? (
          <div className="p-8 text-center">
            <div className={`text-3xl mb-2 ${result.passed ? 'text-success' : 'text-danger'}`}>{result.passed ? '✓' : '✕'}</div>
            <div className="text-xl font-bold mb-1">{result.passed ? 'Assessment passed!' : 'Not quite there'}</div>
            <p className="text-sm text-muted mb-5">
              You scored {result.score}% ({assessment.passScore}% required to pass).
            </p>
            {result.passed ? (
              <button className="btn-primary" onClick={onClose}>Continue to application</button>
            ) : (
              <div className="flex gap-2 justify-center">
                <button className="btn-secondary" onClick={onClose}>Close</button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setResult(null);
                    setAnswers(new Array(assessment.questions.length).fill(-1));
                  }}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-border">
              <div className="font-semibold">{assessment.title}</div>
              {assessment.description && <p className="text-xs text-muted mt-1">{assessment.description}</p>}
              <p className="text-xs text-muted mt-1">Pass score: {assessment.passScore}%</p>
            </div>
            <div className="p-6 flex flex-col gap-5">
              {error && <div className="border border-danger bg-red-50 rounded p-3 text-sm text-danger">{error}</div>}
              {assessment.questions.map((q, qi) => (
                <div key={qi}>
                  <div className="text-sm font-semibold mb-2">{qi + 1}. {q.question}</div>
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className="flex items-center gap-2.5 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`q-${qi}`}
                          checked={answers[qi] === oi}
                          onChange={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 justify-end pt-2 border-t border-ground">
                <button className="btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn-primary" disabled={submitting} onClick={submit}>
                  {submitting ? 'Submitting…' : 'Submit answers'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
