'use client';

import { useState, useEffect } from 'react';
import { liffFetch } from '@/lib/liff';

interface Survey {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  responded: boolean;
}

export default function LiffSurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    liffFetch('/api/liff/surveys')
      .then(r => r.json())
      .then(json => { if (json.data) setSurveys(json.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-white rounded-xl h-20" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">アンケート</h2>
      {surveys.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">アンケートはありません</div>
      ) : (
        <div className="space-y-3">
          {surveys.map(s => (
            <a
              key={s.id}
              href={`/liff/surveys/${s.id}`}
              className={`block bg-white rounded-xl border p-4 transition-shadow hover:shadow-sm ${s.responded ? 'border-gray-200' : 'border-orange-200'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{s.title}</p>
                  {s.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description}</p>}
                </div>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                  s.responded ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {s.responded ? '回答済' : '未回答'}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
