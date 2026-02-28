'use client';

export default function LoginPage() {
  const handleLineLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    window.location.href = `${apiUrl}/auth/line`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-line rounded-2xl flex items-center justify-center mb-6">
            <svg
              className="w-10 h-10 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.95 1.95 5.55 4.87 7.03-.19.66-.68 2.46-.78 2.84-.13.5.18.49.38.36.16-.1 2.54-1.73 3.58-2.43.62.09 1.26.14 1.95.14 5.52 0 10-3.82 10-8.5S17.52 2 12 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            LINE AI Marketing
          </h1>
          <p className="mt-2 text-gray-600">
            LINE公式アカウント向けAIマーケティングプラットフォーム
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={handleLineLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-line hover:bg-line-dark text-white font-semibold rounded-xl transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.95 1.95 5.55 4.87 7.03-.19.66-.68 2.46-.78 2.84-.13.5.18.49.38.36.16-.1 2.54-1.73 3.58-2.43.62.09 1.26.14 1.95.14 5.52 0 10-3.82 10-8.5S17.52 2 12 2z" />
            </svg>
            LINEでログイン
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          ログインすることで、利用規約とプライバシーポリシーに同意します。
        </p>
      </div>
    </div>
  );
}
