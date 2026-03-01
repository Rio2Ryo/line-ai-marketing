'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';
type Tab = 'message' | 'flex' | 'improve';
type FlexView = 'preview' | 'json';

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

// ─── Flex Message Visual Preview Renderer ───

function FlexComponent({ node }: { node: any }) {
  if (!node || typeof node !== 'object') return null;

  switch (node.type) {
    case 'text': {
      const sizeMap: Record<string, string> = { xxs: '10px', xs: '11px', sm: '13px', md: '14px', lg: '16px', xl: '18px', xxl: '22px', '3xl': '26px', '4xl': '32px', '5xl': '40px' };
      const weightMap: Record<string, string> = { regular: '400', bold: '700' };
      const colorVal = node.color || '#333333';
      const fontSize = sizeMap[node.size] || sizeMap.md;
      const fontWeight = weightMap[node.weight] || '400';
      const align = node.align || 'left';
      const decoration = node.decoration === 'line-through' ? 'line-through' : node.decoration === 'underline' ? 'underline' : 'none';
      const margin = node.margin === 'none' ? '0' : node.margin === 'xs' ? '2px' : node.margin === 'sm' ? '4px' : node.margin === 'md' ? '8px' : node.margin === 'lg' ? '12px' : node.margin === 'xl' ? '16px' : node.margin === 'xxl' ? '20px' : '0';
      return (
        <p style={{ color: colorVal, fontSize, fontWeight, textAlign: align as any, textDecoration: decoration, marginTop: margin, lineHeight: 1.4, wordBreak: 'break-word' }}>
          {node.text || ''}
        </p>
      );
    }
    case 'button': {
      const action = node.action || {};
      const label = action.label || 'Button';
      const isPrimary = node.style === 'primary';
      const bgColor = isPrimary ? (node.color || '#06C755') : 'transparent';
      const textColor = isPrimary ? '#FFFFFF' : (node.color || '#06C755');
      const border = isPrimary ? 'none' : `1px solid ${node.color || '#06C755'}`;
      const height = node.height === 'sm' ? '36px' : '44px';
      const margin = node.margin === 'sm' ? '4px' : node.margin === 'md' ? '8px' : node.margin === 'xs' ? '2px' : '0';
      return (
        <button style={{ width: '100%', background: bgColor, color: textColor, border, borderRadius: '6px', padding: '0 16px', height, fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginTop: margin, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {label}
        </button>
      );
    }
    case 'image': {
      const size = node.size === 'full' ? '100%' : node.size === 'xl' ? '80%' : node.size === 'lg' ? '60%' : node.size === 'md' ? '40%' : node.size === 'sm' ? '30%' : node.size === 'xs' ? '20%' : '100%';
      const ratio = node.aspectRatio || '20:13';
      const [rw, rh] = ratio.split(':').map(Number);
      const paddingTop = rw && rh ? `${(rh / rw) * 100}%` : '65%';
      const aspectMode = node.aspectMode || 'cover';
      return (
        <div style={{ width: size, margin: '0 auto', position: 'relative', paddingTop, background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
          {node.url ? (
            <img src={node.url} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: aspectMode as any }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : null}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#9ca3af', fontSize: '11px' }}>
            {node.url ? '' : 'IMAGE'}
          </div>
        </div>
      );
    }
    case 'icon': {
      const sz = node.size === 'xxs' ? 14 : node.size === 'xs' ? 16 : node.size === 'sm' ? 18 : node.size === 'lg' ? 24 : node.size === 'xl' ? 28 : 20;
      return <span style={{ display: 'inline-block', width: sz, height: sz, background: '#e5e7eb', borderRadius: '50%' }} />;
    }
    case 'separator':
      return <hr style={{ border: 'none', borderTop: `1px solid ${node.color || '#e5e7eb'}`, margin: '8px 0' }} />;
    case 'filler':
      return <div style={{ flex: 1 }} />;
    case 'spacer': {
      const szMap: Record<string, string> = { xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px', xxl: '20px' };
      return <div style={{ height: szMap[node.size] || '8px' }} />;
    }
    case 'box':
      return <FlexBox node={node} />;
    default:
      return null;
  }
}

function FlexBox({ node }: { node: any }) {
  if (!node) return null;
  const layout = node.layout || 'vertical';
  const isH = layout === 'horizontal' || layout === 'baseline';
  const bgColor = node.backgroundColor || 'transparent';
  const paddingAll = node.paddingAll || node.paddingAll;
  const padMap: Record<string, string> = { none: '0', xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px', xxl: '20px' };
  const pad = padMap[paddingAll] || paddingAll || '0';
  const spacing = node.spacing ? (padMap[node.spacing] || '0') : '0';
  const margin = node.margin ? (padMap[node.margin] || '0') : '0';
  const borderWidth = node.borderWidth ? (padMap[node.borderWidth] || node.borderWidth) : '0';
  const cornerRadius = node.cornerRadius ? (padMap[node.cornerRadius] || node.cornerRadius) : '0';
  const paddingTop = node.paddingTop ? (padMap[node.paddingTop] || node.paddingTop) : undefined;
  const paddingBottom = node.paddingBottom ? (padMap[node.paddingBottom] || node.paddingBottom) : undefined;
  const paddingStart = node.paddingStart ? (padMap[node.paddingStart] || node.paddingStart) : undefined;
  const paddingEnd = node.paddingEnd ? (padMap[node.paddingEnd] || node.paddingEnd) : undefined;

  const contents = node.contents || [];
  const justifyMap: Record<string, string> = { start: 'flex-start', end: 'flex-end', center: 'center', 'space-between': 'space-between', 'space-around': 'space-around', 'space-evenly': 'space-evenly' };
  const alignMap: Record<string, string> = { start: 'flex-start', end: 'flex-end', center: 'center' };

  return (
    <div style={{
      display: 'flex',
      flexDirection: isH ? 'row' : 'column',
      gap: spacing,
      background: bgColor,
      padding: pad,
      paddingTop: paddingTop || undefined,
      paddingBottom: paddingBottom || undefined,
      paddingLeft: paddingStart || undefined,
      paddingRight: paddingEnd || undefined,
      marginTop: margin,
      borderWidth,
      borderColor: node.borderColor || 'transparent',
      borderStyle: borderWidth !== '0' ? 'solid' : 'none',
      borderRadius: cornerRadius,
      justifyContent: justifyMap[node.justifyContent] || 'flex-start',
      alignItems: alignMap[node.alignItems] || (isH ? 'center' : 'stretch'),
      width: node.width || undefined,
      height: node.height || undefined,
      flex: node.flex !== undefined ? node.flex : undefined,
    }}>
      {contents.map((c: any, i: number) => (
        <div key={i} style={{ flex: c.flex !== undefined ? c.flex : (isH ? undefined : undefined), width: isH && c.flex !== undefined ? undefined : undefined }}>
          <FlexComponent node={c} />
        </div>
      ))}
    </div>
  );
}

function FlexBubblePreview({ json }: { json: any }) {
  if (!json || typeof json !== 'object') return <p className="text-gray-400 text-sm">プレビューできません</p>;

  const bubble = json.type === 'bubble' ? json : json.type === 'carousel' ? json.contents?.[0] : json;
  if (!bubble) return <p className="text-gray-400 text-sm">プレビューできません</p>;

  const { header, hero, body, footer } = bubble;
  const dir = bubble.direction || 'ltr';

  return (
    <div className="mx-auto" style={{ width: '300px', direction: dir as any }}>
      {/* LINE chat frame */}
      <div style={{ background: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', border: '1px solid #e5e7eb' }}>
        {/* Header section */}
        {header && (
          <div style={{ padding: header.type === 'box' ? '0' : '12px 16px', background: header.backgroundColor || '#ffffff' }}>
            {header.type === 'box' ? <FlexBox node={header} /> : <FlexComponent node={header} />}
          </div>
        )}
        {/* Hero section (image) */}
        {hero && (
          <div style={{ background: hero.backgroundColor || '#e5e7eb' }}>
            {hero.type === 'image' ? <FlexComponent node={hero} /> : hero.type === 'box' ? <FlexBox node={hero} /> : null}
          </div>
        )}
        {/* Body section */}
        {body && (
          <div style={{ padding: body.type === 'box' ? '0' : '16px', background: body.backgroundColor || '#ffffff' }}>
            {body.type === 'box' ? <FlexBox node={{ ...body, paddingAll: body.paddingAll || 'lg' }} /> : <FlexComponent node={body} />}
          </div>
        )}
        {/* Footer section */}
        {footer && (
          <div style={{ padding: footer.type === 'box' ? '0' : '12px 16px', background: footer.backgroundColor || '#ffffff', borderTop: '1px solid #f3f4f6' }}>
            {footer.type === 'box' ? <FlexBox node={{ ...footer, paddingAll: footer.paddingAll || 'md' }} /> : <FlexComponent node={footer} />}
          </div>
        )}
      </div>

      {/* Carousel indicator */}
      {json.type === 'carousel' && json.contents?.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {json.contents.map((_: any, i: number) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-[#06C755]' : 'bg-gray-300'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Template presets ───

interface FlexTemplate {
  label: string;
  type: 'product' | 'coupon' | 'event' | 'news';
  purpose: string;
  details: string;
}

const FLEX_TEMPLATES: FlexTemplate[] = [
  { label: '商品カード', type: 'product', purpose: '新商品のプロモーション', details: '商品名: プレミアムスキンケアセット\n価格: ¥3,980（通常¥5,980）\n説明: 3点セットでお得！\nボタン: 詳しく見る' },
  { label: 'クーポン', type: 'coupon', purpose: '割引クーポン配布', details: '割引: 20% OFF\nコード: SPRING2026\n期限: 2026年3月31日まで\n対象: 全商品\nボタン: クーポンを使う' },
  { label: 'イベント招待', type: 'event', purpose: 'イベント告知', details: 'イベント名: Spring Sale 2026\n日時: 3月15日(土) 10:00-18:00\n場所: オンライン\n特典: 先着100名に限定グッズ\nボタン: 参加する' },
  { label: 'お知らせ', type: 'news', purpose: '重要なお知らせ', details: 'タイトル: サービスリニューアルのお知らせ\n内容: より使いやすくなりました\n日付: 2026年3月1日\nボタン: 詳細を見る' },
];

const IC = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent bg-white text-gray-900';
const BTN = 'w-full px-6 py-3 bg-[#06C755] text-white rounded-xl font-medium hover:bg-[#05b34c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
const CARD = 'bg-white rounded-2xl shadow-sm border border-gray-100 p-6';

function countComponents(node: any): number {
  if (!node) return 0;
  const contents = node.contents || [];
  let count = contents.length;
  for (const c of contents) {
    if (c.contents) count += countComponents(c);
  }
  return count;
}

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
  const [flexJson, setFlexJson] = useState<any>(null);
  const [flexError, setFlexError] = useState('');
  const [flexView, setFlexView] = useState<FlexView>('preview');
  const [flexEditJson, setFlexEditJson] = useState('');
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
    setFlexLoading(true); setFlexError(''); setFlexJson(null); setFlexEditJson('');
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate/flex`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ purpose: flexPurpose, content_type: flexType, details: flexDetails }),
      });
      const data = await res.json();
      if (data.success && data.data?.flex_json) {
        setFlexJson(data.data.flex_json);
        setFlexEditJson(JSON.stringify(data.data.flex_json, null, 2));
        setFlexView('preview');
      } else setFlexError(data.error || '生成に失敗しました');
    } catch { setFlexError('通信エラーが発生しました'); } finally { setFlexLoading(false); }
  };

  const applyTemplate = (tmpl: FlexTemplate) => {
    setFlexPurpose(tmpl.purpose);
    setFlexType(tmpl.type);
    setFlexDetails(tmpl.details);
  };

  const handleJsonEdit = (value: string) => {
    setFlexEditJson(value);
    try {
      const parsed = JSON.parse(value);
      setFlexJson(parsed);
      setFlexError('');
    } catch {
      // Don't clear flexJson on parse errors so preview stays visible
    }
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
          {/* Template presets */}
          <div className={CARD}>
            <h3 className="text-sm font-medium text-gray-700 mb-3">テンプレートから始める</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FLEX_TEMPLATES.map((tmpl) => (
                <button key={tmpl.label} onClick={() => applyTemplate(tmpl)}
                  className="px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:border-[#06C755] hover:text-[#06C755] transition-colors text-gray-600">
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

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
              {flexLoading && <Spinner />}{flexLoading ? '生成中...' : 'AIで生成する'}
            </button>
          </div>

          {flexError && <ErrorBox msg={flexError} />}

          {flexJson && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">生成結果</h3>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                    <button onClick={() => setFlexView('preview')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${flexView === 'preview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      プレビュー
                    </button>
                    <button onClick={() => setFlexView('json')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${flexView === 'json' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      JSON
                    </button>
                  </div>
                  <button onClick={() => copyText(JSON.stringify(flexJson, null, 2), 'flex-json')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${copiedKey === 'flex-json' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {copiedKey === 'flex-json' ? 'コピー済み' : 'JSONをコピー'}
                  </button>
                </div>
              </div>

              {/* Preview / JSON toggle */}
              {flexView === 'preview' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* LINE chat mockup */}
                  <div className="flex justify-center">
                    <div style={{ width: '340px' }}>
                      <div className="bg-[#7B9EB0] rounded-t-2xl px-4 py-2 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-white/30" />
                        <span className="text-white text-sm font-medium">LINE Preview</span>
                      </div>
                      <div className="bg-[#8CAAB5] px-5 py-6 rounded-b-2xl min-h-[200px]">
                        <FlexBubblePreview json={flexJson} />
                      </div>
                    </div>
                  </div>
                  {/* Structure summary */}
                  <div className={CARD}>
                    <h4 className="text-sm font-bold text-gray-900 mb-3">構造</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#06C755]" />
                        <span className="text-gray-600">Type: <span className="font-mono text-gray-900">{flexJson?.type || 'unknown'}</span></span>
                      </div>
                      {flexJson?.type === 'bubble' && (
                        <>
                          {flexJson.header && <div className="flex items-center gap-2 pl-4"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /><span className="text-gray-600">Header</span></div>}
                          {flexJson.hero && <div className="flex items-center gap-2 pl-4"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" /><span className="text-gray-600">Hero (Image)</span></div>}
                          {flexJson.body && <div className="flex items-center gap-2 pl-4"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" /><span className="text-gray-600">Body ({countComponents(flexJson.body)} components)</span></div>}
                          {flexJson.footer && <div className="flex items-center gap-2 pl-4"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="text-gray-600">Footer ({countComponents(flexJson.footer)} components)</span></div>}
                        </>
                      )}
                      {flexJson?.type === 'carousel' && (
                        <div className="flex items-center gap-2 pl-4"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /><span className="text-gray-600">{flexJson.contents?.length || 0} bubbles</span></div>
                      )}
                      <div className="pt-2 border-t border-gray-100 mt-2">
                        <span className="text-xs text-gray-400">JSON size: {JSON.stringify(flexJson).length} bytes</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={CARD}>
                  <textarea value={flexEditJson} onChange={(e) => handleJsonEdit(e.target.value)}
                    className="w-full h-96 font-mono text-sm bg-gray-50 border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent resize-y"
                    spellCheck={false} />
                  <p className="text-xs text-gray-400 mt-2">JSONを直接編集できます。プレビュータブでリアルタイムに確認できます。</p>
                </div>
              )}
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
