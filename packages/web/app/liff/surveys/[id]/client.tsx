'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { liffFetch } from '@/lib/liff';

interface Question {
  id: string;
  question_text: string;
  question_type: 'text' | 'single_choice' | 'multiple_choice' | 'rating';
  options_json: string | null;
  is_required: number;
}

interface SurveyDetail {
  id: string;
  title: string;
  description: string | null;
  questions: Question[];
  already_responded: boolean;
}

export default function LiffSurveyDetailClient() {
  const params = useParams();
  const surveyId = params.id as string;
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    liffFetch(`/api/liff/surveys/${surveyId}`)
      .then(r => r.json())
      .then(json => { if (json.data) setSurvey(json.data); })
      .finally(() => setLoading(false));
  }, [surveyId]);

  const handleSubmit = async () => {
    if (!survey) return;
    // Check required
    for (const q of survey.questions) {
      if (q.is_required && (!answers[q.id] || (Array.isArray(answers[q.id]) && (answers[q.id] as string[]).length === 0))) {
        setError(`「${q.question_text}」は必須です`);
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await liffFetch(`/api/liff/surveys/${surveyId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
      } else {
        setError(json.error || '送信に失敗しました');
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-white rounded-xl h-24" />)}</div>;
  }

  if (!survey) {
    return <div className="text-center py-8 text-gray-400 text-sm">アンケートが見つかりません</div>;
  }

  if (submitted || survey.already_responded) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-bold text-gray-900">回答済みです</p>
        <p className="text-sm text-gray-500 mt-1">ご回答ありがとうございました</p>
        <a href="/liff/surveys" className="inline-block mt-4 px-4 py-2 bg-[#06C755] text-white rounded-lg text-sm font-medium">アンケート一覧へ</a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{survey.title}</h2>
        {survey.description && <p className="text-sm text-gray-500 mt-1">{survey.description}</p>}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {survey.questions.map(q => {
        const options: string[] = q.options_json ? (() => { try { return JSON.parse(q.options_json); } catch { return []; } })() : [];

        return (
          <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-900 mb-2">
              {q.question_text}
              {q.is_required ? <span className="text-red-500 ml-1">*</span> : null}
            </p>

            {q.question_type === 'text' && (
              <textarea
                value={(answers[q.id] as string) || ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]"
                rows={3}
                placeholder="回答を入力..."
              />
            )}

            {q.question_type === 'single_choice' && (
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <label key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                      className="accent-[#06C755]"
                    />
                    <span className="text-sm text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {q.question_type === 'multiple_choice' && (
              <div className="space-y-2">
                {options.map((opt, i) => {
                  const selected = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                  return (
                    <label key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        value={opt}
                        checked={selected.includes(opt)}
                        onChange={(e) => {
                          const newSelected = e.target.checked ? [...selected, opt] : selected.filter(s => s !== opt);
                          setAnswers({ ...answers, [q.id]: newSelected });
                        }}
                        className="accent-[#06C755]"
                      />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.question_type === 'rating' && (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setAnswers({ ...answers, [q.id]: String(n) })}
                    className={`w-10 h-10 rounded-full text-sm font-bold transition-colors ${
                      answers[q.id] === String(n) ? 'bg-[#06C755] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3 bg-[#06C755] text-white rounded-xl text-sm font-bold hover:bg-[#05a347] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {submitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
        {submitting ? '送信中...' : '回答を送信'}
      </button>
    </div>
  );
}
