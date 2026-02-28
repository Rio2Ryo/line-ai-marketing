'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Stats {
  total_friends: number;
  new_friends_this_month: number;
  friends_last_month: number;
  messages_this_month: number;
  active_scenarios: number;
  outbound_this_month: number;
}

interface DailyMessage {
  date: string;
  inbound: number;
  outbound: number;
}

interface DeliveryStats {
  sent: number;
  pending: number;
  failed: number;
  daily_messages: DailyMessage[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, deliveryRes] = await Promise.all([
          fetchWithAuth(getApiUrl() + '/api/stats/overview'),
          fetchWithAuth(getApiUrl() + '/api/stats/delivery'),
        ]);
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
        if (deliveryRes.ok) {
          setDeliveryStats(await deliveryRes.json());
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getChangeRate = () => {
    if (!stats || !stats.friends_last_month || stats.friends_last_month <= 0)
      return null;
    const rate = (
      (stats.new_friends_this_month / stats.friends_last_month) * 100 -
      100
    ).toFixed(1);
    return rate;
  };

  const changeRate = getChangeRate();

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="w-16 h-5 bg-gray-200 rounded-full" />
              </div>
              <div className="h-8 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: '友だち数',
      value: stats?.total_friends?.toLocaleString() || '0',
      change: changeRate ? changeRate + '%' : null,
      positive: changeRate ? parseFloat(changeRate) >= 0 : true,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      label: '今月配信数',
      value: stats?.messages_this_month?.toLocaleString() || '0',
      change: null,
      positive: true,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      label: '稼働シナリオ',
      value: stats?.active_scenarios?.toLocaleString() || '0',
      change: null,
      positive: true,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
    },
    {
      label: '送信数',
      value: stats?.outbound_this_month?.toLocaleString() || '0',
      change: null,
      positive: true,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
      ),
    },
  ];

  // 日別メッセージ棒グラフ用データ（最新7日分）
  const dailyMessages = deliveryStats?.daily_messages?.slice(-7) || [];
  const maxCount = Math.max(
    ...dailyMessages.map((d) => Math.max(d.inbound, d.outbound)),
    1
  );

  // 配信ステータスバー
  const totalDelivery =
    (deliveryStats?.sent || 0) +
    (deliveryStats?.pending || 0) +
    (deliveryStats?.failed || 0);
  const sentPct =
    totalDelivery > 0
      ? ((deliveryStats?.sent || 0) / totalDelivery) * 100
      : 0;
  const pendingPct =
    totalDelivery > 0
      ? ((deliveryStats?.pending || 0) / totalDelivery) * 100
      : 0;
  const failedPct =
    totalDelivery > 0
      ? ((deliveryStats?.failed || 0) / totalDelivery) * 100
      : 0;

  return (
    <div className="space-y-8">
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">{stat.icon}</span>
              {stat.change && (
                <span
                  className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
                    stat.positive
                      ? 'bg-green-50 text-green-600'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  {stat.positive && parseFloat(stat.change) > 0 ? '+' : ''}
                  {stat.change}
                </span>
              )}
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* 日別メッセージ棒グラフ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          日別メッセージ（直近7日）
        </h3>
        {dailyMessages.length > 0 ? (
          <div
            className="flex items-end justify-around gap-4"
            style={{ height: 160 }}
          >
            {dailyMessages.map((day) => {
              const inH = (day.inbound / maxCount) * 120;
              const outH = (day.outbound / maxCount) * 120;
              const dateLabel = new Date(day.date).toLocaleDateString('ja-JP', {
                month: 'numeric',
                day: 'numeric',
              });
              return (
                <div
                  key={day.date}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className="flex items-end gap-1"
                    style={{ height: 120 }}
                  >
                    <div
                      className="w-6 bg-gray-300 rounded-t"
                      style={{ height: inH }}
                      title={'受信: ' + day.inbound}
                    />
                    <div
                      className="w-6 bg-[#06C755] rounded-t"
                      style={{ height: outH }}
                      title={'送信: ' + day.outbound}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{dateLabel}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">データなし</p>
        )}
        <div className="flex items-center gap-6 mt-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-300 rounded" />
            <span className="text-xs text-gray-500">受信</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#06C755] rounded" />
            <span className="text-xs text-gray-500">送信</span>
          </div>
        </div>
      </div>

      {/* 配信ステータスバー */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          配信ステータス
        </h3>
        {totalDelivery > 0 ? (
          <>
            <div className="flex rounded-full overflow-hidden h-6">
              {sentPct > 0 && (
                <div
                  className="bg-[#06C755] flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: sentPct + '%' }}
                >
                  {sentPct > 10 ? Math.round(sentPct) + '%' : ''}
                </div>
              )}
              {pendingPct > 0 && (
                <div
                  className="bg-yellow-400 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: pendingPct + '%' }}
                >
                  {pendingPct > 10 ? Math.round(pendingPct) + '%' : ''}
                </div>
              )}
              {failedPct > 0 && (
                <div
                  className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: failedPct + '%' }}
                >
                  {failedPct > 10 ? Math.round(failedPct) + '%' : ''}
                </div>
              )}
            </div>
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#06C755] rounded" />
                <span className="text-sm text-gray-600">
                  送信済 ({deliveryStats?.sent?.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-400 rounded" />
                <span className="text-sm text-gray-600">
                  保留中 ({deliveryStats?.pending?.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded" />
                <span className="text-sm text-gray-600">
                  失敗 ({deliveryStats?.failed?.toLocaleString()})
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            配信データなし
          </p>
        )}
      </div>
    </div>
  );
}
