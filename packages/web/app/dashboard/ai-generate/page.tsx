'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';
type Tab = 'message' | 'flex' | 'improve';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
      <p className="text-red-600 text-sm">{msg}</p>
    </div>
  );
}

function CopyBtn({ text, id, copiedKey, onCopy }: { text: string; id: string; copiedKey: string | null; onCopy: (t: string, k: string) => void }) {
  const copied = copiedKey === id;
  return (
    <button
      onClick={() => onCopy(text, id)}
      className={`flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      {copied ? 'コピー済み' : 'コピー'}
    </button>
  );
}

const IC = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent bg-white text-gray-900';
const BTN = 'w-full px-6 py-3 bg-[#06C755] text-white rounded-xl font-medium hover:bg-[#05b34c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
const CARD = 'bg-white rounded-2xl shadow-sm border border-gray-100 p-6';

export default function AiGeneratePage() {
  const [activeTab, setActiveTab] = useState<Tab>('message');
  const [msgPurpose, setMsgPurpose] = useState('');
  const [msgTarget, setMsgTarget] = useState('');
  const [msgTone, setMsgTone] = useState('casual');
  const [msgCount, setMsgCount] = useState(3);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgVariations, setMsgVariations] = useState<string[]>([]);
  const [msgError, setMsgError] = useState('');
  const [flexPurpose, setFlexPurpose] = useState('');
  const [flexType, setFlexType] = useState<'product' | 'coupon' | 'event' | 'news'>('product');
  const [flexDetails, setFlexDetails] = useState('');
  const [flexLoading, setFlexLoading] = useState(false);
  const [flexJson, setFlexJson] = useState<object | null>(null);
  const [flexError, setFlexError] = useState('');
  const [impOriginal, setImpOriginal] = useState('');
  const [impInstruction, setImpInstruction] = useState('');
  const [impLoading, setImpLoading] = useState(false);
  const [impImproved, setImpImproved] = useState('');
  const [impSuggestions, setImpSuggestions] = useState<string[]>([]);
  const [impError, setImpError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); } catch { /* noop */ }
  };

  const handleGenerateMessage = async () => {
    if (!msgPurpose.trim() || !msgTarget.trim()) return;
    setMsgLoading(true); setMsgError(''); setMsgVariations([]);
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate/message`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ purpose: msgPurpose, target_audience: msgTarget, tone: msgTone, count: msgCount }),
      });
      const data = await res.json();
      if (data.success && data.data?.variations) setMsgVariations(data.data.variations);
      else setMsgError(data.error || '生成に失敗しました');
    } catch { setMsgError('通信エラーが発生しました'); } finally { setMsgLoading(false); }
  };

  const handleGenerateFlex = async () => {
    if (!flexPurpose.trim() || !flexDetails.trim()) return;
    setFlexLoading(true); setFlexError(''); setFlexJson(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate/flex`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ purpose: flexPurpose, content_type: flexType, details: flexDetails }),
      });
      const data = await res.json();
      if (data.success && data.data?.flex_json) setFlexJson(data.data.flex_json);
      else setFlexError(data.error || '生成に失敗しました');
    } catch { setFlexError('通信エラーが発生しました'); } finally { setFlexLoading(false); }
  };

  const handleImprove = async () => {
    if (!impOriginal.trim()) return;
    setImpLoading(true); setImpError(''); setImpImproved(''); setImpSuggestions([]);
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate/improve`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ original_text: impOriginal, ...(impInstruction.trim() ? { instruction: impInstruction } : {}) }),
      });
      const data = await res.json();
      if (data.success && data.data) { setImpImproved(data.data.improved || ''); setImpSuggestions(data.data.suggestions || []); }
      else setImpError(data.error || '生成に失敗しました');
    } catch { setImpError('通信エラーが発生しました'); } finally { setImpLoading(false); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'message', label: 'メッセージ生成' },
    { key: 'flex', label: 'Flex Message' },
    { key: 'improve', label: '文章改善' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">AIコンテンツ生成</h1>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* メッセージ生成 */}
      {activeTab === 'message' && (
        <div className="space-y-6">
          <div className={`${CARD} space-y-4`}>
            <h2 className="text-lg font-bold text-gray-900">メッセージ文面を生成</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">配信の目的 <span className="text-red-500">*</span></label>
              <input type="text" value={msgPurpose} onChange={(e) => setMsgPurpose(e.target.value)}
                placeholder="例: セール告知、新商品案内、イベント招待" className={IC} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ターゲット層 <span className="text-red-500">*</span></label>
              <input type="text" value={msgTarget} onChange={(e) => setMsgTarget(e.target.value)}
                placeholder="例: 20代女性、既存顧客、新規友だち" className={IC} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">トーン</label>
                <select value={msgTone} onChange={(e) => setMsgTone(e.target.value)} className={IC}>
                  <option value="casual">カジュアル</option>
                  <option value="formal">フォーマル</option>
                  <option value="friendly">フレンドリー</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">生成数: {msgCount}</label>
                <input type="range" min={1} max={5} value={msgCount} onChange={(e) => setMsgCount(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#06C755] mt-2" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                </div>
              </div>
            </div>
            <button onClick={handleGenerateMessage} disabled={msgLoading || !msgPurpose.trim() || !msgTarget.trim()} className={BTN}>
              {msgLoading && <Spinner />}{msgLoading ? '生成中...' : '生成する'}
            </button>
          </div>
          {msgError && <ErrorBox msg={msgError} />}
          {msgVariations.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">生成結果</h3>
              {msgVariations.map((text, idx) => (
                <div key={idx} className={CARD}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <span className="inline-block text-xs font-medium text-[#06C755] bg-green-50 px-2 py-0.5 rounded mb-2">パターン {idx + 1}</span>
                      <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{text}</p>
                      <p className="text-xs text-gray-400 mt-2">{text.length}文字</p>
                    </div>
                    <CopyBtn text={text} id={`msg-${idx}`} copiedKey={copiedKey} onCopy={copyText} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Flex Message */}
      {activeTab === 'flex' && (
        <div className="space-y-6">
          <div className={`${CARD} space-y-4`}>
            <h2 className="text-lg font-bold text-gray-900">Flex Message生成</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目的 <span className="text-red-500">*</span></label>
              <input type="text" value={flexPurpose} onChange={(e) => setFlexPurpose(e.target.value)}
                placeholder="例: 新商品のプロモーション、割引クーポン配布" className={IC} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">コンテンツタイプ</label>
              <select value={flexType} onChange={(e) => setFlexType(e.target.value as typeof flexType)} className={IC}>
                <option value="product">商品紹介</option>
                <option value="coupon">クーポン</option>
                <option value="event">イベント</option>
                <option value="news">お知らせ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">詳細 <span className="text-red-500">*</span></label>
              <textarea value={flexDetails} onChange={(e) => setFlexDetails(e.target.value)} rows={4}
                placeholder="表示したい内容を記述してください（例: 商品名、価格、説明、ボタンテキスト）" className={`${IC} resize-y`} />
            </div>
            <button onClick={handleGenerateFlex} disabled={flexLoading || !flexPurpose.trim() || !flexDetails.trim()} className={BTN}>
              {flexLoading && <Spinner />}{flexLoading ? '生成中...' : '生成する'}
            </button>
          </div>
          {flexError && <ErrorBox msg={flexError} />}
          {flexJson && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">生成結果</h3>
              <div className={CARD}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Flex Message JSON</span>
                  <button onClick={() => copyText(JSON.stringify(flexJson, null, 2), 'flex-json')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${copiedKey === 'flex-json' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {copiedKey === 'flex-json' ? 'コピー済み' : 'JSONをコピー'}
                  </button>
                </div>
                <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-x-auto text-sm text-gray-800 max-h-96 overflow-y-auto">
                  <code>{JSON.stringify(flexJson, null, 2)}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 文章改善 */}
      {activeTab === 'improve' && (
        <div className="space-y-6">
          <div className={`${CARD} space-y-4`}>
            <h2 className="text-lg font-bold text-gray-900">文章改善</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">元のメッセージ <span className="text-red-500">*</span></label>
              <textarea value={impOriginal} onChange={(e) => setImpOriginal(e.target.value)} rows={4}
                placeholder="改善したいLINEメッセージを入力してください" className={`${IC} resize-y`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">改善指示（任意）</label>
              <input type="text" value={impInstruction} onChange={(e) => setImpInstruction(e.target.value)}
                placeholder="例: もっとカジュアルに、CTAを強くして、短くして" className={IC} />
            </div>
            <button onClick={handleImprove} disabled={impLoading || !impOriginal.trim()} className={BTN}>
              {impLoading && <Spinner />}{impLoading ? '生成中...' : '改善案を生成'}
            </button>
          </div>
          {impError && <ErrorBox msg={impError} />}
          {impImproved && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">改善結果</h3>
              <div className={CARD}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <span className="inline-block text-xs font-medium text-[#06C755] bg-green-50 px-2 py-0.5 rounded mb-2">改善済みメッセージ</span>
                    <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{impImproved}</p>
                  </div>
                  <CopyBtn text={impImproved} id="improved" copiedKey={copiedKey} onCopy={copyText} />
                </div>
                {impSuggestions.length > 0 && (
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">改善ポイント</h4>
                    <ul className="space-y-2">
                      {impSuggestions.map((s, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="mt-1 w-5 h-5 flex-shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-medium">{idx + 1}</span>
                          <span className="text-sm text-gray-700">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
