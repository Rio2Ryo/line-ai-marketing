'use client';

const stats = [
  {
    label: '友だち数',
    value: '12,458',
    change: '+3.2%',
    positive: true,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: '今月配信数',
    value: '3,847',
    change: '+12.5%',
    positive: true,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'シナリオ稼働数',
    value: '24',
    change: '+2',
    positive: true,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: 'AI応答数',
    value: '8,291',
    change: '+18.7%',
    positive: true,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const recentMessages = [
  {
    id: 1,
    user: '田中太郎',
    message: '商品の在庫について教えてください',
    time: '5分前',
    type: 'AI応答',
  },
  {
    id: 2,
    user: '佐藤花子',
    message: '配送状況を確認したいです',
    time: '12分前',
    type: 'AI応答',
  },
  {
    id: 3,
    user: '鈴木一郎',
    message: '返品の手続きについて',
    time: '25分前',
    type: '手動対応',
  },
  {
    id: 4,
    user: '高橋美咲',
    message: 'セール情報を教えてください',
    time: '32分前',
    type: 'AI応答',
  },
  {
    id: 5,
    user: '山田健太',
    message: 'ポイントの有効期限はいつまでですか？',
    time: '1時間前',
    type: 'AI応答',
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">{stat.icon}</span>
              <span
                className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
                  stat.positive
                    ? 'bg-green-50 text-green-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {stat.change}
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* 最近のメッセージ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            最近のメッセージ
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {recentMessages.map((msg) => (
            <div
              key={msg.id}
              className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-line/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-line">
                    {msg.user.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{msg.user}</p>
                  <p className="text-sm text-gray-500">{msg.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`text-xs font-medium px-3 py-1 rounded-full ${
                    msg.type === 'AI応答'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-orange-50 text-orange-600'
                  }`}
                >
                  {msg.type}
                </span>
                <span className="text-sm text-gray-400">{msg.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
