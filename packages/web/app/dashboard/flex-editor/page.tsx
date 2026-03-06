'use client';

import { useState, useCallback } from 'react';

// ─── Types ───

interface FlexNode {
  type: string;
  [key: string]: any;
}

interface BubbleData {
  type: 'bubble';
  header?: FlexNode;
  hero?: FlexNode;
  body?: FlexNode;
  footer?: FlexNode;
}

type NodePath = string; // e.g. "body", "body.contents.0", "footer.contents.1"

// ─── Templates ───

const TEMPLATES: { label: string; data: BubbleData }[] = [
  {
    label: '空のバブル',
    data: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', paddingAll: 'lg', contents: [
          { type: 'text', text: 'テキストを編集', size: 'md', color: '#333333', wrap: true },
        ],
      },
    },
  },
  {
    label: '商品カード',
    data: {
      type: 'bubble',
      hero: { type: 'image', url: 'https://placehold.co/600x400/06C755/ffffff?text=Product', size: 'full', aspectRatio: '20:13', aspectMode: 'cover' },
      body: {
        type: 'box', layout: 'vertical', paddingAll: 'lg', spacing: 'md', contents: [
          { type: 'text', text: '商品名', weight: 'bold', size: 'xl', color: '#1a1a1a' },
          { type: 'text', text: '商品の説明文をここに入力します。', size: 'sm', color: '#666666', wrap: true },
          { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
            { type: 'text', text: '¥3,980', weight: 'bold', size: 'lg', color: '#06C755' },
            { type: 'text', text: '¥5,980', size: 'sm', color: '#aaaaaa', decoration: 'line-through', align: 'end' },
          ]},
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: 'md', contents: [
          { type: 'button', style: 'primary', color: '#06C755', action: { type: 'uri', label: '詳しく見る', uri: 'https://example.com' } },
        ],
      },
    },
  },
  {
    label: 'クーポン',
    data: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', paddingAll: 'lg', backgroundColor: '#06C755', contents: [
          { type: 'text', text: '20% OFF', weight: 'bold', size: '3xl', color: '#ffffff', align: 'center' },
          { type: 'text', text: 'クーポン', size: 'sm', color: '#ffffff', align: 'center' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: 'lg', spacing: 'md', contents: [
          { type: 'text', text: 'SPRING2026', weight: 'bold', size: 'lg', align: 'center', color: '#333333' },
          { type: 'separator', color: '#e5e5e5' },
          { type: 'text', text: '有効期限: 2026年3月31日', size: 'xs', color: '#999999', align: 'center' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: 'md', contents: [
          { type: 'button', style: 'primary', color: '#06C755', action: { type: 'uri', label: 'クーポンを使う', uri: 'https://example.com' } },
        ],
      },
    },
  },
  {
    label: 'お知らせ',
    data: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', paddingAll: 'lg', spacing: 'md', contents: [
          { type: 'text', text: 'お知らせ', weight: 'bold', size: 'sm', color: '#06C755' },
          { type: 'text', text: 'タイトルを入力', weight: 'bold', size: 'lg', color: '#1a1a1a' },
          { type: 'separator', color: '#e5e5e5' },
          { type: 'text', text: 'お知らせの本文をここに入力します。詳細はボタンからご確認ください。', size: 'sm', color: '#666666', wrap: true },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: 'md', contents: [
          { type: 'button', style: 'link', color: '#06C755', action: { type: 'uri', label: '詳細を見る', uri: 'https://example.com' } },
        ],
      },
    },
  },
];

// ─── Default components for adding ───

function newComponent(type: string): FlexNode {
  switch (type) {
    case 'text': return { type: 'text', text: 'テキスト', size: 'md', color: '#333333', wrap: true };
    case 'button': return { type: 'button', style: 'primary', color: '#06C755', action: { type: 'uri', label: 'ボタン', uri: 'https://example.com' } };
    case 'image': return { type: 'image', url: 'https://placehold.co/400x300/e5e7eb/9ca3af?text=Image', size: 'full', aspectRatio: '20:13', aspectMode: 'cover' };
    case 'separator': return { type: 'separator', color: '#e5e5e5' };
    case 'spacer': return { type: 'spacer', size: 'md' };
    case 'box': return { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '左', size: 'sm', color: '#333333' }, { type: 'text', text: '右', size: 'sm', color: '#333333' }] };
    default: return { type: 'text', text: 'テキスト' };
  }
}

function newSection(section: string): FlexNode {
  if (section === 'hero') return { type: 'image', url: 'https://placehold.co/600x400/06C755/ffffff?text=Hero', size: 'full', aspectRatio: '20:13', aspectMode: 'cover' };
  return { type: 'box', layout: 'vertical', paddingAll: section === 'header' ? 'md' : 'lg', spacing: 'sm', contents: [{ type: 'text', text: section === 'header' ? 'ヘッダー' : section === 'footer' ? 'フッター' : 'テキスト', weight: section === 'header' ? 'bold' : 'regular', size: section === 'header' ? 'lg' : 'md', color: '#333333' }] };
}

// ─── Deep get/set helpers ───

function deepGet(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function deepSet(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = /^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i];
    cur = cur[k];
  }
  const last = /^\d+$/.test(keys[keys.length - 1]) ? Number(keys[keys.length - 1]) : keys[keys.length - 1];
  cur[last] = value;
  return clone;
}

function deepDelete(obj: any, path: string): any {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = /^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i];
    cur = cur[k];
  }
  const last = keys[keys.length - 1];
  if (Array.isArray(cur)) {
    cur.splice(Number(last), 1);
  } else {
    delete cur[last];
  }
  return clone;
}

// ─── Preview Renderer (shared with ai-generate) ───

function FlexComponent({ node }: { node: any }) {
  if (!node || typeof node !== 'object') return null;
  switch (node.type) {
    case 'text': {
      const sizeMap: Record<string, string> = { xxs: '10px', xs: '11px', sm: '13px', md: '14px', lg: '16px', xl: '18px', xxl: '22px', '3xl': '26px', '4xl': '32px', '5xl': '40px' };
      const colorVal = node.color || '#333333';
      const fontSize = sizeMap[node.size] || sizeMap.md;
      const fontWeight = node.weight === 'bold' ? '700' : '400';
      const align = node.align || 'left';
      const decoration = node.decoration === 'line-through' ? 'line-through' : node.decoration === 'underline' ? 'underline' : 'none';
      const margin = node.margin === 'none' ? '0' : node.margin === 'xs' ? '2px' : node.margin === 'sm' ? '4px' : node.margin === 'md' ? '8px' : node.margin === 'lg' ? '12px' : node.margin === 'xl' ? '16px' : '0';
      return <p style={{ color: colorVal, fontSize, fontWeight, textAlign: align as any, textDecoration: decoration, marginTop: margin, lineHeight: 1.4, wordBreak: 'break-word' }}>{node.text || ''}</p>;
    }
    case 'button': {
      const action = node.action || {};
      const label = action.label || 'Button';
      const isPrimary = node.style === 'primary';
      const bgColor = isPrimary ? (node.color || '#06C755') : 'transparent';
      const textColor = isPrimary ? '#FFFFFF' : (node.color || '#06C755');
      const border = isPrimary ? 'none' : `1px solid ${node.color || '#06C755'}`;
      const height = node.height === 'sm' ? '36px' : '44px';
      return <button style={{ width: '100%', background: bgColor, color: textColor, border, borderRadius: '6px', padding: '0 16px', height, fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{label}</button>;
    }
    case 'image': {
      const ratio = node.aspectRatio || '20:13';
      const [rw, rh] = ratio.split(':').map(Number);
      const paddingTop = rw && rh ? `${(rh / rw) * 100}%` : '65%';
      return (
        <div style={{ width: '100%', position: 'relative', paddingTop, background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
          {node.url ? <img src={node.url} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: (node.aspectMode || 'cover') as any }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : null}
        </div>
      );
    }
    case 'separator': return <hr style={{ border: 'none', borderTop: `1px solid ${node.color || '#e5e7eb'}`, margin: '8px 0' }} />;
    case 'spacer': {
      const szMap: Record<string, string> = { xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px', xxl: '20px' };
      return <div style={{ height: szMap[node.size] || '8px' }} />;
    }
    case 'filler': return <div style={{ flex: 1 }} />;
    case 'box': return <FlexBox node={node} />;
    default: return null;
  }
}

function FlexBox({ node }: { node: any }) {
  if (!node) return null;
  const layout = node.layout || 'vertical';
  const isH = layout === 'horizontal' || layout === 'baseline';
  const padMap: Record<string, string> = { none: '0', xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px', xxl: '20px' };
  const pad = padMap[node.paddingAll] || node.paddingAll || '0';
  const spacing = node.spacing ? (padMap[node.spacing] || '0') : '0';
  return (
    <div style={{ display: 'flex', flexDirection: isH ? 'row' : 'column', gap: spacing, background: node.backgroundColor || 'transparent', padding: pad, borderRadius: node.cornerRadius ? (padMap[node.cornerRadius] || node.cornerRadius) : '0', justifyContent: node.justifyContent || 'flex-start', alignItems: node.alignItems || (isH ? 'center' : 'stretch'), flex: node.flex !== undefined ? node.flex : undefined }}>
      {(node.contents || []).map((c: any, i: number) => <div key={i} style={{ flex: c.flex !== undefined ? c.flex : undefined }}><FlexComponent node={c} /></div>)}
    </div>
  );
}

function BubblePreview({ bubble }: { bubble: BubbleData }) {
  return (
    <div style={{ width: '300px', margin: '0 auto' }}>
      <div style={{ background: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', border: '1px solid #e5e7eb' }}>
        {bubble.header && <div style={{ background: (bubble.header as any).backgroundColor || '#ffffff' }}>{bubble.header.type === 'box' ? <FlexBox node={bubble.header} /> : <FlexComponent node={bubble.header} />}</div>}
        {bubble.hero && <div style={{ background: (bubble.hero as any).backgroundColor || '#e5e7eb' }}><FlexComponent node={bubble.hero} /></div>}
        {bubble.body && <div style={{ background: (bubble.body as any).backgroundColor || '#ffffff' }}>{bubble.body.type === 'box' ? <FlexBox node={{ ...bubble.body, paddingAll: (bubble.body as any).paddingAll || 'lg' }} /> : <FlexComponent node={bubble.body} />}</div>}
        {bubble.footer && <div style={{ background: (bubble.footer as any).backgroundColor || '#ffffff', borderTop: '1px solid #f3f4f6' }}>{bubble.footer.type === 'box' ? <FlexBox node={{ ...bubble.footer, paddingAll: (bubble.footer as any).paddingAll || 'md' }} /> : <FlexComponent node={bubble.footer} />}</div>}
      </div>
    </div>
  );
}

// ─── Component Tree ───

function typeLabel(type: string): string {
  const map: Record<string, string> = { text: 'Text', button: 'Button', image: 'Image', box: 'Box', separator: 'Line', spacer: 'Spacer', filler: 'Filler' };
  return map[type] || type;
}

function typeIcon(type: string): string {
  const map: Record<string, string> = { text: 'T', button: 'B', image: 'I', box: '[]', separator: '—', spacer: '↕', filler: '↔' };
  return map[type] || '?';
}

function TreeNode({ node, path, selected, onSelect, depth = 0 }: { node: FlexNode; path: string; selected: string | null; onSelect: (p: string) => void; depth?: number }) {
  const isSelected = selected === path;
  const hasChildren = node.type === 'box' && Array.isArray(node.contents);
  const summary = node.type === 'text' ? (node.text?.substring(0, 20) || '') : node.type === 'button' ? (node.action?.label || '') : '';

  return (
    <div>
      <button
        onClick={() => onSelect(path)}
        className={`w-full text-left flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${isSelected ? 'bg-[#06C755] text-white' : 'hover:bg-gray-100 text-gray-700'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-[10px] font-bold ${isSelected ? 'bg-white/20' : 'bg-gray-200 text-gray-500'}`}>{typeIcon(node.type)}</span>
        <span className="font-medium">{typeLabel(node.type)}</span>
        {summary && <span className={`truncate ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>{summary}</span>}
      </button>
      {hasChildren && (node.contents || []).map((child: FlexNode, i: number) => (
        <TreeNode key={i} node={child} path={`${path}.contents.${i}`} selected={selected} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  );
}

// ─── Property Editor ───

const SIZES = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', '3xl', '4xl', '5xl'];
const SPACINGS = ['none', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
const ALIGNS = ['start', 'center', 'end'];
const LAYOUTS = ['vertical', 'horizontal', 'baseline'];
const BUTTON_STYLES = ['primary', 'secondary', 'link'];
const ASPECT_RATIOS = ['1:1', '1.51:1', '1.91:1', '20:13', '2:1', '3:1', '4:3', '16:9'];
const ASPECT_MODES = ['cover', 'fit'];

const IC = 'w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#06C755] bg-white';
const LBL = 'block text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wider';

function PropertyPanel({ node, onChange }: { node: FlexNode; onChange: (n: FlexNode) => void }) {
  const update = (key: string, value: any) => onChange({ ...node, [key]: value });
  const updateAction = (key: string, value: any) => onChange({ ...node, action: { ...node.action, [key]: value } });

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
        <span className="w-6 h-6 flex items-center justify-center rounded bg-[#06C755] text-white text-[10px] font-bold">{typeIcon(node.type)}</span>
        <span className="font-bold text-gray-900">{typeLabel(node.type)}</span>
      </div>

      {/* Text properties */}
      {node.type === 'text' && (
        <>
          <div><label className={LBL}>テキスト</label><textarea value={node.text || ''} onChange={e => update('text', e.target.value)} rows={2} className={IC + ' resize-y'} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={LBL}>サイズ</label><select value={node.size || 'md'} onChange={e => update('size', e.target.value)} className={IC}>{SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className={LBL}>ウェイト</label><select value={node.weight || 'regular'} onChange={e => update('weight', e.target.value)} className={IC}><option value="regular">Regular</option><option value="bold">Bold</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={LBL}>カラー</label><div className="flex gap-1"><input type="color" value={node.color || '#333333'} onChange={e => update('color', e.target.value)} className="w-7 h-7 rounded border border-gray-300 cursor-pointer" /><input type="text" value={node.color || '#333333'} onChange={e => update('color', e.target.value)} className={IC} /></div></div>
            <div><label className={LBL}>揃え</label><select value={node.align || 'start'} onChange={e => update('align', e.target.value)} className={IC}>{['start', 'center', 'end'].map(a => <option key={a} value={a}>{a}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={LBL}>装飾</label><select value={node.decoration || 'none'} onChange={e => update('decoration', e.target.value)} className={IC}><option value="none">none</option><option value="underline">underline</option><option value="line-through">line-through</option></select></div>
            <div><label className={LBL}>折り返し</label><select value={node.wrap ? 'true' : 'false'} onChange={e => update('wrap', e.target.value === 'true')} className={IC}><option value="true">on</option><option value="false">off</option></select></div>
          </div>
          <div><label className={LBL}>マージン</label><select value={node.margin || 'none'} onChange={e => update('margin', e.target.value)} className={IC}>{SPACINGS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        </>
      )}

      {/* Button properties */}
      {node.type === 'button' && (
        <>
          <div><label className={LBL}>ラベル</label><input type="text" value={node.action?.label || ''} onChange={e => updateAction('label', e.target.value)} className={IC} /></div>
          <div><label className={LBL}>URL</label><input type="url" value={node.action?.uri || ''} onChange={e => updateAction('uri', e.target.value)} className={IC} placeholder="https://..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={LBL}>スタイル</label><select value={node.style || 'primary'} onChange={e => update('style', e.target.value)} className={IC}>{BUTTON_STYLES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className={LBL}>カラー</label><div className="flex gap-1"><input type="color" value={node.color || '#06C755'} onChange={e => update('color', e.target.value)} className="w-7 h-7 rounded border border-gray-300 cursor-pointer" /><input type="text" value={node.color || '#06C755'} onChange={e => update('color', e.target.value)} className={IC} /></div></div>
          </div>
          <div><label className={LBL}>高さ</label><select value={node.height || 'md'} onChange={e => update('height', e.target.value)} className={IC}><option value="sm">Small</option><option value="md">Medium</option></select></div>
        </>
      )}

      {/* Image properties */}
      {node.type === 'image' && (
        <>
          <div><label className={LBL}>画像URL</label><input type="url" value={node.url || ''} onChange={e => update('url', e.target.value)} className={IC} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={LBL}>比率</label><select value={node.aspectRatio || '20:13'} onChange={e => update('aspectRatio', e.target.value)} className={IC}>{ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            <div><label className={LBL}>モード</label><select value={node.aspectMode || 'cover'} onChange={e => update('aspectMode', e.target.value)} className={IC}>{ASPECT_MODES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          </div>
          <div><label className={LBL}>サイズ</label><select value={node.size || 'full'} onChange={e => update('size', e.target.value)} className={IC}>{['xs', 'sm', 'md', 'lg', 'xl', 'full'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        </>
      )}

      {/* Box properties */}
      {node.type === 'box' && (
        <>
          <div><label className={LBL}>レイアウト</label><select value={node.layout || 'vertical'} onChange={e => update('layout', e.target.value)} className={IC}>{LAYOUTS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={LBL}>パディング</label><select value={node.paddingAll || 'none'} onChange={e => update('paddingAll', e.target.value)} className={IC}>{SPACINGS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className={LBL}>間隔</label><select value={node.spacing || 'none'} onChange={e => update('spacing', e.target.value)} className={IC}>{SPACINGS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={LBL}>背景色</label><div className="flex gap-1"><input type="color" value={node.backgroundColor || '#ffffff'} onChange={e => update('backgroundColor', e.target.value)} className="w-7 h-7 rounded border border-gray-300 cursor-pointer" /><input type="text" value={node.backgroundColor || ''} onChange={e => update('backgroundColor', e.target.value)} className={IC} placeholder="透明" /></div></div>
            <div><label className={LBL}>角丸</label><select value={node.cornerRadius || 'none'} onChange={e => update('cornerRadius', e.target.value)} className={IC}>{SPACINGS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={LBL}>横揃え</label><select value={node.justifyContent || 'start'} onChange={e => update('justifyContent', e.target.value)} className={IC}>{[...ALIGNS, 'space-between', 'space-around', 'space-evenly'].map(a => <option key={a} value={a}>{a}</option>)}</select></div>
            <div><label className={LBL}>縦揃え</label><select value={node.alignItems || 'start'} onChange={e => update('alignItems', e.target.value)} className={IC}>{ALIGNS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
          </div>
        </>
      )}

      {/* Separator */}
      {node.type === 'separator' && (
        <div><label className={LBL}>カラー</label><div className="flex gap-1"><input type="color" value={node.color || '#e5e5e5'} onChange={e => update('color', e.target.value)} className="w-7 h-7 rounded border border-gray-300 cursor-pointer" /><input type="text" value={node.color || '#e5e5e5'} onChange={e => update('color', e.target.value)} className={IC} /></div></div>
      )}

      {/* Spacer */}
      {node.type === 'spacer' && (
        <div><label className={LBL}>サイズ</label><select value={node.size || 'md'} onChange={e => update('size', e.target.value)} className={IC}>{SPACINGS.filter(s => s !== 'none').map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      )}

      {/* Flex property (common) */}
      {['text', 'button', 'image', 'box', 'filler'].includes(node.type) && (
        <div><label className={LBL}>Flex</label><input type="number" value={node.flex ?? ''} onChange={e => update('flex', e.target.value === '' ? undefined : Number(e.target.value))} className={IC} placeholder="auto" min={0} max={10} /></div>
      )}
    </div>
  );
}

// ─── Main Editor ───

export default function FlexEditorPage() {
  const [bubble, setBubble] = useState<BubbleData>(TEMPLATES[0].data);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const selectedNode = selectedPath ? deepGet(bubble, selectedPath) as FlexNode | null : null;

  const updateNode = useCallback((newNode: FlexNode) => {
    if (!selectedPath) return;
    setBubble(prev => deepSet(prev, selectedPath, newNode));
  }, [selectedPath]);

  const deleteNode = useCallback(() => {
    if (!selectedPath) return;
    const parts = selectedPath.split('.');
    // Can't delete sections via tree delete - only contents items
    if (parts.length < 3) return;
    setBubble(prev => deepDelete(prev, selectedPath));
    setSelectedPath(null);
  }, [selectedPath]);

  const addComponent = useCallback((section: 'header' | 'body' | 'footer', type: string) => {
    setBubble(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      const sec = clone[section];
      if (!sec || sec.type !== 'box' || !Array.isArray(sec.contents)) return prev;
      sec.contents.push(newComponent(type));
      return clone;
    });
  }, []);

  const toggleSection = useCallback((section: 'header' | 'hero' | 'body' | 'footer') => {
    setBubble(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      if (clone[section]) {
        delete clone[section];
        if (selectedPath?.startsWith(section)) setSelectedPath(null);
      } else {
        clone[section] = newSection(section);
      }
      return clone;
    });
  }, [selectedPath]);

  const loadTemplate = useCallback((tmpl: BubbleData) => {
    setBubble(JSON.parse(JSON.stringify(tmpl)));
    setSelectedPath(null);
  }, []);

  const syncJsonToEditor = useCallback(() => {
    setJsonText(JSON.stringify(bubble, null, 2));
    setJsonError('');
  }, [bubble]);

  const applyJsonToEditor = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed.type !== 'bubble') { setJsonError('type は "bubble" である必要があります'); return; }
      setBubble(parsed);
      setJsonError('');
      setSelectedPath(null);
    } catch { setJsonError('無効なJSON形式です'); }
  }, [jsonText]);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(bubble, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {}
  };

  const SECTIONS: { key: 'header' | 'hero' | 'body' | 'footer'; label: string; color: string }[] = [
    { key: 'header', label: 'Header', color: 'bg-blue-100 text-blue-700' },
    { key: 'hero', label: 'Hero', color: 'bg-purple-100 text-purple-700' },
    { key: 'body', label: 'Body', color: 'bg-orange-100 text-orange-700' },
    { key: 'footer', label: 'Footer', color: 'bg-red-100 text-red-700' },
  ];

  const ADDABLE_TYPES = ['text', 'button', 'image', 'separator', 'spacer', 'box'];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Flex Messageエディター</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowJson(!showJson); if (!showJson) syncJsonToEditor(); }} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${showJson ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {showJson ? 'エディターに戻る' : 'JSON表示'}
          </button>
          <button onClick={copyJson} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${copiedJson ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {copiedJson ? 'コピー済み' : 'JSONコピー'}
          </button>
        </div>
      </div>

      {/* Templates */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map(t => (
          <button key={t.label} onClick={() => loadTemplate(t.data)} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:border-[#06C755] hover:text-[#06C755] transition-colors text-gray-600">
            {t.label}
          </button>
        ))}
      </div>

      {showJson ? (
        /* JSON Editor */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <textarea value={jsonText} onChange={e => setJsonText(e.target.value)} className="w-full h-96 font-mono text-xs bg-gray-50 border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#06C755] resize-y" spellCheck={false} />
          {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
          <div className="flex gap-2">
            <button onClick={applyJsonToEditor} className="px-4 py-2 bg-[#06C755] text-white text-xs font-medium rounded-lg hover:bg-[#05b34c]">JSONを適用</button>
            <button onClick={syncJsonToEditor} className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200">エディターから同期</button>
          </div>
        </div>
      ) : (
        /* Visual Editor - 3 column layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Component Tree */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-3 space-y-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">構造</h3>

            {/* Section toggles */}
            <div className="flex flex-wrap gap-1">
              {SECTIONS.map(s => (
                <button key={s.key} onClick={() => toggleSection(s.key)} className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${bubble[s.key] ? s.color : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                  {bubble[s.key] ? s.label : `+ ${s.label}`}
                </button>
              ))}
            </div>

            {/* Tree */}
            <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
              {SECTIONS.map(s => bubble[s.key] ? (
                <div key={s.key}>
                  <button onClick={() => setSelectedPath(s.key)} className={`w-full text-left flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold transition-colors ${selectedPath === s.key ? 'bg-[#06C755] text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${s.color.split(' ')[0]}`} />
                    {s.label}
                  </button>
                  {bubble[s.key]!.type === 'box' && (bubble[s.key] as any).contents?.map((child: FlexNode, i: number) => (
                    <TreeNode key={i} node={child} path={`${s.key}.contents.${i}`} selected={selectedPath} onSelect={setSelectedPath} depth={1} />
                  ))}
                  {bubble[s.key]!.type !== 'box' && (
                    <TreeNode node={bubble[s.key]!} path={s.key} selected={selectedPath} onSelect={setSelectedPath} depth={1} />
                  )}
                </div>
              ) : null)}
            </div>

            {/* Add component buttons */}
            {(bubble.body || bubble.header || bubble.footer) && (
              <div className="border-t border-gray-100 pt-2 space-y-1">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">コンポーネント追加</p>
                {(['body', 'header', 'footer'] as const).filter(s => bubble[s] && (bubble[s] as any).type === 'box').map(section => (
                  <div key={section} className="space-y-1">
                    <p className="text-[10px] text-gray-500 font-medium">{section}:</p>
                    <div className="flex flex-wrap gap-1">
                      {ADDABLE_TYPES.map(type => (
                        <button key={type} onClick={() => addComponent(section, type)} className="px-1.5 py-0.5 text-[10px] border border-dashed border-gray-300 rounded hover:border-[#06C755] hover:text-[#06C755] text-gray-500 transition-colors">
                          +{typeLabel(type)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Center: Live Preview */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 w-full">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 text-center">プレビュー</h3>
              <div className="bg-[#8CAAB5] rounded-2xl px-5 py-6 min-h-[300px] flex items-start justify-center">
                <BubblePreview bubble={bubble} />
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-2">JSON: {JSON.stringify(bubble).length} bytes</p>
            </div>
          </div>

          {/* Right: Property Panel */}
          <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">プロパティ</h3>
              {selectedPath && selectedPath.includes('contents') && (
                <button onClick={deleteNode} className="px-2 py-0.5 text-[10px] font-medium text-red-500 hover:bg-red-50 rounded transition-colors">削除</button>
              )}
            </div>
            {selectedNode ? (
              <PropertyPanel node={selectedNode} onChange={updateNode} />
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-gray-400">左のツリーからコンポーネントを<br />選択して編集</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
