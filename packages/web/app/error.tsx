'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">エラーが発生しました</h2>
        <p className="text-sm text-gray-500 mb-6">
          {error.message || 'ページの読み込み中に問題が発生しました。'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors"
        >
          再試行
        </button>
      </div>
    </div>
  );
}
