'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';
import { useTranslation, Locale } from '@/lib/i18n';
import { useTheme, COLOR_THEMES, ThemeMode, ColorTheme } from '@/lib/theme';

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const { mode, setMode, isDark, colorTheme, setColorTheme } = useTheme();
  const [aiAutoReply, setAiAutoReply] = useState(true);
  const [escalationNotify, setEscalationNotify] = useState(true);
  const [notifySlack, setNotifySlack] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [notifyEmailAddress, setNotifyEmailAddress] = useState('');
  const [knowledgeCount, setKnowledgeCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ channel: string; ok: boolean } | null>(null);
  const [lineStatus, setLineStatus] = useState<{ channelSecret: boolean; channelToken: boolean } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, knowledgeRes] = await Promise.all([
          fetchWithAuth(getApiUrl() + '/api/settings'),
          fetchWithAuth(getApiUrl() + '/api/knowledge'),
        ]);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          const s = settingsData.data || {};
          setAiAutoReply(s.ai_auto_reply !== 'false');
          setEscalationNotify(s.escalation_notify !== 'false');
          setNotifySlack(s.notify_slack === 'true');
          setNotifyEmail(s.notify_email === 'true');
          setSlackWebhookUrl(s.slack_webhook_url || '');
          setNotifyEmailAddress(s.notify_email_address || '');
          if (s.language === 'en') {
            setLocale('en');
          }
        }
        if (knowledgeRes.ok) {
          const data = await knowledgeRes.json();
          const items = Array.isArray(data) ? data : data.items || [];
          setKnowledgeCount(items.length);
        }
        // Check LINE channel configuration via health endpoint
        try {
          const healthRes = await fetch(getApiUrl() + '/health/deep');
          if (healthRes.ok) {
            const healthData = await healthRes.json();
            const config = healthData.checks?.config || {};
            setLineStatus({
              channelSecret: config.line_channel_secret === 'configured',
              channelToken: config.line_channel_token === 'configured',
            });
          }
        } catch {}
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const updateSetting = useCallback(async (key: string, value: string) => {
    setSavingKey(key);
    try {
      await fetchWithAuth(getApiUrl() + '/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    } catch (err) {
      console.error('Failed to save setting:', err);
    } finally {
      setTimeout(() => setSavingKey(null), 600);
    }
  }, []);

  const handleToggle = (key: string, current: boolean, setter: (v: boolean) => void) => {
    const newVal = !current;
    setter(newVal);
    updateSetting(key, String(newVal));
  };

  const handleSaveUrl = (key: string, value: string) => {
    updateSetting(key, value);
  };

  const handleTestNotification = async (channel: 'slack' | 'email') => {
    setTestingChannel(channel);
    setTestResult(null);
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      const json = await res.json();
      setTestResult({ channel, ok: json.success });
    } catch {
      setTestResult({ channel, ok: false });
    } finally {
      setTestingChannel(null);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('settings.title')}</h1>

      {/* LINE未設定警告バナー */}
      {lineStatus && (!lineStatus.channelSecret || !lineStatus.channelToken) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
                LINE Messaging API {locale === 'ja' ? '未設定' : 'Not Configured'}
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                {locale === 'ja'
                  ? 'LINE本番チャネルの認証情報が未設定です。Webhook受信・メッセージ送信・LIFF連携が動作しません。AI応答やダッシュボード機能はシミュレーターで引き続き利用できます。'
                  : 'LINE channel credentials are not configured. Webhook, message sending, and LIFF integration will not work. AI responses and dashboard features remain available via the simulator.'}
              </p>
              <div className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <p className="font-medium">{locale === 'ja' ? '不足項目:' : 'Missing:'}</p>
                <ul className="list-disc list-inside ml-1 space-y-0.5">
                  {!lineStatus.channelSecret && (
                    <li>LINE_CHANNEL_SECRET — {locale === 'ja' ? 'Webhook署名検証に必要' : 'Required for webhook signature verification'}</li>
                  )}
                  {!lineStatus.channelToken && (
                    <li>LINE_CHANNEL_ACCESS_TOKEN — {locale === 'ja' ? 'メッセージ送信に必要' : 'Required for sending messages'}</li>
                  )}
                </ul>
              </div>
              <div className="mt-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
                <p className="font-medium mb-1">{locale === 'ja' ? '設定手順:' : 'Setup steps:'}</p>
                <ol className="list-decimal list-inside space-y-0.5 text-xs">
                  <li>{locale === 'ja' ? 'LINE Developers (developers.line.biz) でMessaging APIチャネルを作成' : 'Create Messaging API channel at LINE Developers (developers.line.biz)'}</li>
                  <li>{locale === 'ja' ? 'チャネルシークレットとアクセストークンを取得' : 'Obtain channel secret and access token'}</li>
                  <li><code className="bg-amber-200 dark:bg-amber-800 px-1 rounded text-xs">wrangler secret put LINE_CHANNEL_SECRET</code></li>
                  <li><code className="bg-amber-200 dark:bg-amber-800 px-1 rounded text-xs">wrangler secret put LINE_CHANNEL_ACCESS_TOKEN</code></li>
                  <li>{locale === 'ja' ? 'Webhook URLを設定: ' : 'Set webhook URL: '}<code className="bg-amber-200 dark:bg-amber-800 px-1 rounded text-xs">https://line-ai-marketing-api.common-gifted-tokyo.workers.dev/webhook</code></li>
                </ol>
              </div>
              <p className="mt-2 text-xs text-amber-500 dark:text-amber-400">
                {locale === 'ja'
                  ? '代替手段: /api/webhook-test/simulate エンドポイントでWebhookパイプライン全体をテスト可能です。'
                  : 'Alternative: Use /api/webhook-test/simulate to test the full webhook pipeline without LINE credentials.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 言語設定セクション */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          {t('settings.language')}
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">{t('settings.language')}</p>
            <p className="text-sm text-gray-500">{t('settings.languageDesc')}</p>
          </div>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => {
                setLocale('ja');
                updateSetting('language', 'ja');
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                locale === 'ja'
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t('settings.japanese')}
            </button>
            <button
              onClick={() => {
                setLocale('en');
                updateSetting('language', 'en');
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                locale === 'en'
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t('settings.english')}
            </button>
          </div>
        </div>
      </div>

      {/* テーマ設定セクション */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          {locale === 'ja' ? 'テーマ設定' : 'Theme Settings'}
        </h3>

        <div className="space-y-6">
          {/* Dark Mode */}
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              {locale === 'ja' ? 'ダークモード' : 'Dark Mode'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {locale === 'ja' ? '画面の表示モードを切り替えます' : 'Switch between light and dark display modes'}
            </p>
            <div className="flex items-center gap-2">
              {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    updateSetting('theme_mode', m);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    mode === m
                      ? 'border-gray-800 bg-gray-800 text-white dark:border-gray-200 dark:bg-gray-200 dark:text-gray-900'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {m === 'light' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                  {m === 'dark' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                  {m === 'system' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                  {m === 'light' ? (locale === 'ja' ? 'ライト' : 'Light') :
                   m === 'dark' ? (locale === 'ja' ? 'ダーク' : 'Dark') :
                   locale === 'ja' ? 'システム' : 'System'}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              {locale === 'ja' ? 'アクセントカラー' : 'Accent Color'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {locale === 'ja' ? 'サイドバーやボタンのテーマカラーを変更します' : 'Change the theme color for sidebar and buttons'}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => {
                    setColorTheme(theme);
                    updateSetting('theme_color', theme.name);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                    colorTheme.accent === theme.accent
                      ? 'border-2 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  style={colorTheme.accent === theme.accent ? { borderColor: theme.accent } : undefined}
                >
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: theme.accent }}
                  />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI設定セクション */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {t('settings.aiSettings')}
        </h3>
        <div className="space-y-5">
          <ToggleRow
            label="AI自動応答"
            description="LINE受信メッセージにAIが自動で応答します"
            value={aiAutoReply}
            saving={savingKey === 'ai_auto_reply'}
            onToggle={() => handleToggle('ai_auto_reply', aiAutoReply, setAiAutoReply)}
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">応答モデル</p>
              <p className="text-sm text-gray-500">AIの応答に使用されるモデル</p>
            </div>
            <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg">Claude 3.5 Haiku</span>
          </div>
          <ToggleRow
            label="エスカレーション通知"
            description="AIが対応できない場合にオペレーターへ通知します"
            value={escalationNotify}
            saving={savingKey === 'escalation_notify'}
            onToggle={() => handleToggle('escalation_notify', escalationNotify, setEscalationNotify)}
          />
        </div>
      </div>

      {/* 通知設定セクション */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {t('settings.notificationSettings')}
        </h3>
        <p className="text-sm text-gray-500 mb-5">エスカレーション発生時の通知先を設定します。エスカレーション通知がONの場合のみ送信されます。</p>

        <div className="space-y-6">
          {/* Slack */}
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#4A154B] rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.271 0a2.527 2.527 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.164 0a2.528 2.528 0 0 1 2.521 2.522v6.312zM15.164 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.164 24a2.527 2.527 0 0 1-2.521-2.522v-2.522h2.521zm0-1.271a2.527 2.527 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.522h6.314A2.528 2.528 0 0 1 24 15.164a2.528 2.528 0 0 1-2.522 2.521h-6.314z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Slack通知</p>
                  <p className="text-xs text-gray-500">Incoming Webhook URLを設定</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {savingKey === 'notify_slack' && <span className="text-xs text-gray-400 animate-pulse">保存中...</span>}
                <button
                  onClick={() => handleToggle('notify_slack', notifySlack, setNotifySlack)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifySlack ? 'bg-[#06C755]' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifySlack ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            {notifySlack && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://hooks.slack.com/services/..."
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                  />
                  <button
                    onClick={() => handleSaveUrl('slack_webhook_url', slackWebhookUrl)}
                    disabled={!slackWebhookUrl}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {savingKey === 'slack_webhook_url' ? '保存中...' : '保存'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestNotification('slack')}
                    disabled={!slackWebhookUrl || testingChannel === 'slack'}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {testingChannel === 'slack' ? '送信中...' : 'テスト送信'}
                  </button>
                  {testResult?.channel === 'slack' && (
                    <span className={`text-xs font-medium ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                      {testResult.ok ? '送信成功' : '送信失敗 — URLを確認してください'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">メール通知</p>
                  <p className="text-xs text-gray-500">メールアドレスに通知を送信</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {savingKey === 'notify_email' && <span className="text-xs text-gray-400 animate-pulse">保存中...</span>}
                <button
                  onClick={() => handleToggle('notify_email', notifyEmail, setNotifyEmail)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifyEmail ? 'bg-[#06C755]' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifyEmail ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            {notifyEmail && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="admin@example.com"
                    value={notifyEmailAddress}
                    onChange={(e) => setNotifyEmailAddress(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                  />
                  <button
                    onClick={() => handleSaveUrl('notify_email_address', notifyEmailAddress)}
                    disabled={!notifyEmailAddress}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {savingKey === 'notify_email_address' ? '保存中...' : '保存'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestNotification('email')}
                    disabled={!notifyEmailAddress || testingChannel === 'email'}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {testingChannel === 'email' ? '送信中...' : 'テスト送信'}
                  </button>
                  {testResult?.channel === 'email' && (
                    <span className={`text-xs font-medium ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                      {testResult.ok ? '送信成功' : '送信失敗 — DNS設定が必要な場合があります'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">※ メール送信にはCloudflare MailChannelsを利用します。送信元ドメインのSPF/DKIM設定が必要な場合があります。</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LINE連携設定セクション */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#06C755]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.066-.022.137-.033.194-.033.195 0 .375.104.515.254l2.449 3.32V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
          </svg>
          {t('settings.lineSettings')}
        </h3>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Channel Secret</p>
              <p className="text-sm text-gray-500">Webhook署名検証に使用</p>
            </div>
            {lineStatus ? (
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${lineStatus.channelSecret ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {lineStatus.channelSecret ? '設定済み' : '未設定'}
              </span>
            ) : (
              <span className="text-sm text-gray-400">確認中...</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Channel Access Token</p>
              <p className="text-sm text-gray-500">メッセージ送信・プロフィール取得に使用</p>
            </div>
            {lineStatus ? (
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${lineStatus.channelToken ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {lineStatus.channelToken ? '設定済み' : '未設定'}
              </span>
            ) : (
              <span className="text-sm text-gray-400">確認中...</span>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="font-medium text-gray-900">Webhook URL</p>
                <p className="text-sm text-gray-500">LINE Developersに設定するWebhook URL</p>
              </div>
            </div>
            <div className="mt-2 bg-gray-50 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-600 break-all">
              https://line-ai-marketing-api.common-gifted-tokyo.workers.dev/webhook
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">接続ステータス</p>
              <p className="text-sm text-gray-500">LINE Messaging APIとの接続状態</p>
            </div>
            {lineStatus ? (
              lineStatus.channelSecret && lineStatus.channelToken ? (
                <span className="text-sm font-medium px-3 py-1 rounded-full bg-green-100 text-green-700">接続可能</span>
              ) : (
                <span className="text-sm font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700">設定不完全 — シミュレーターで代替可能</span>
              )
            ) : (
              <span className="text-sm text-gray-400">確認中...</span>
            )}
          </div>
        </div>
      </div>

      {/* ナレッジベース統計セクション */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {t('settings.knowledgeBase')}
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">
              登録済みナレッジ:{' '}
              {loading ? (
                <span className="inline-block w-8 h-5 bg-gray-200 rounded animate-pulse align-middle" />
              ) : (
                <span className="text-[#06C755] font-bold">{knowledgeCount ?? 0}件</span>
              )}
            </p>
            <p className="text-sm text-gray-500">FAQや商品情報を登録してAIの応答品質を向上させましょう</p>
          </div>
          <Link
            href="/dashboard/knowledge"
            className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors text-sm"
          >
            ナレッジ管理へ
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- Toggle Row ---------- */
function ToggleRow({ label, description, value, saving, onToggle }: {
  label: string; description: string; value: boolean; saving: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {saving && <span className="text-xs text-gray-400 animate-pulse">保存中...</span>}
        <button
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-[#06C755]' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    </div>
  );
}
