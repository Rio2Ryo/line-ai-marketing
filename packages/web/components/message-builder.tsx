'use client';

import { useState } from 'react';

// ─── Types ───

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ImageBlock {
  type: 'image';
  originalContentUrl: string;
  previewImageUrl: string;
}

export interface VideoBlock {
  type: 'video';
  originalContentUrl: string;
  previewImageUrl: string;
}

export interface FlexBlock {
  type: 'flex';
  altText: string;
  contents: object;
}

export type MessageBlock = TextBlock | ImageBlock | VideoBlock | FlexBlock;

// ─── Helpers ───

function emptyText(): TextBlock {
  return { type: 'text', text: '' };
}

function isValidBlock(b: MessageBlock): boolean {
  switch (b.type) {
    case 'text': return b.text.trim().length > 0;
    case 'image': return b.originalContentUrl.trim().length > 0;
    case 'video': return b.originalContentUrl.trim().length > 0 && b.previewImageUrl.trim().length > 0;
    case 'flex': return b.altText.trim().length > 0 && Object.keys(b.contents).length > 0;
    default: return false;
  }
}

export function isValidMessages(blocks: MessageBlock[]): boolean {
  return blocks.length > 0 && blocks.every(isValidBlock);
}

// ─── Type Labels ───

const TYPE_LABELS: Record<MessageBlock['type'], string> = {
  text: 'テキスト',
  image: '画像',
  video: '動画',
  flex: 'Flex Message',
};

const TYPE_ICONS: Record<MessageBlock['type'], string> = {
  text: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  image: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  flex: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
};

// ─── Block Editor ───

function BlockEditor({
  block, onChange, onRemove, canRemove, index,
}: {
  block: MessageBlock;
  onChange: (b: MessageBlock) => void;
  onRemove: () => void;
  canRemove: boolean;
  index: number;
}) {
  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const [flexError, setFlexError] = useState<string | null>(null);

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Block header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={TYPE_ICONS[block.type]} />
          </svg>
          <span className="text-sm font-medium text-gray-700">{TYPE_LABELS[block.type]}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Type switcher */}
          <select
            value={block.type}
            onChange={e => {
              const t = e.target.value as MessageBlock['type'];
              switch (t) {
                case 'text': onChange(emptyText()); break;
                case 'image': onChange({ type: 'image', originalContentUrl: '', previewImageUrl: '' }); break;
                case 'video': onChange({ type: 'video', originalContentUrl: '', previewImageUrl: '' }); break;
                case 'flex': onChange({ type: 'flex', altText: '', contents: {} }); break;
              }
            }}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
          >
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {canRemove && (
            <button onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500" title="削除">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Block body */}
      <div className="p-4 space-y-3">
        {block.type === 'text' && (
          <textarea
            value={block.text}
            onChange={e => onChange({ ...block, text: e.target.value })}
            rows={3}
            placeholder="メッセージを入力..."
            className={inp + ' resize-y'}
          />
        )}

        {block.type === 'image' && (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">画像URL</label>
              <input
                type="url"
                value={block.originalContentUrl}
                onChange={e => onChange({ ...block, originalContentUrl: e.target.value, previewImageUrl: block.previewImageUrl || e.target.value })}
                placeholder="https://example.com/image.jpg"
                className={inp}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">プレビュー画像URL (省略時は同じURL)</label>
              <input
                type="url"
                value={block.previewImageUrl}
                onChange={e => onChange({ ...block, previewImageUrl: e.target.value })}
                placeholder="https://example.com/preview.jpg"
                className={inp}
              />
            </div>
            {block.originalContentUrl && (
              <div className="mt-2">
                <img
                  src={block.originalContentUrl}
                  alt="プレビュー"
                  className="max-w-[200px] max-h-[150px] rounded-lg border border-gray-200 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
          </>
        )}

        {block.type === 'video' && (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">動画URL (mp4)</label>
              <input
                type="url"
                value={block.originalContentUrl}
                onChange={e => onChange({ ...block, originalContentUrl: e.target.value })}
                placeholder="https://example.com/video.mp4"
                className={inp}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">サムネイル画像URL</label>
              <input
                type="url"
                value={block.previewImageUrl}
                onChange={e => onChange({ ...block, previewImageUrl: e.target.value })}
                placeholder="https://example.com/thumb.jpg"
                className={inp}
              />
            </div>
            {block.previewImageUrl && (
              <div className="mt-2 relative inline-block">
                <img
                  src={block.previewImageUrl}
                  alt="サムネイル"
                  className="max-w-[200px] max-h-[150px] rounded-lg border border-gray-200 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {block.type === 'flex' && (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">代替テキスト (通知に表示)</label>
              <input
                type="text"
                value={block.altText}
                onChange={e => onChange({ ...block, altText: e.target.value })}
                placeholder="Flexメッセージです"
                className={inp}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Flex Message JSON</label>
              <textarea
                value={Object.keys(block.contents).length > 0 ? JSON.stringify(block.contents, null, 2) : ''}
                onChange={e => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    onChange({ ...block, contents: parsed });
                    setFlexError(null);
                  } catch {
                    setFlexError('無効なJSON形式です');
                  }
                }}
                rows={8}
                placeholder='{ "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": [...] } }'
                className={inp + ' resize-y font-mono text-xs'}
              />
              {flexError && <p className="text-xs text-red-500 mt-1">{flexError}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Message Builder ───

interface MessageBuilderProps {
  blocks: MessageBlock[];
  onChange: (blocks: MessageBlock[]) => void;
  maxBlocks?: number;
}

export default function MessageBuilder({ blocks, onChange, maxBlocks = 5 }: MessageBuilderProps) {
  const updateBlock = (index: number, block: MessageBlock) => {
    const next = [...blocks];
    next[index] = block;
    onChange(next);
  };

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const addBlock = (type: MessageBlock['type']) => {
    let newBlock: MessageBlock;
    switch (type) {
      case 'text': newBlock = emptyText(); break;
      case 'image': newBlock = { type: 'image', originalContentUrl: '', previewImageUrl: '' }; break;
      case 'video': newBlock = { type: 'video', originalContentUrl: '', previewImageUrl: '' }; break;
      case 'flex': newBlock = { type: 'flex', altText: '', contents: {} }; break;
    }
    onChange([...blocks, newBlock]);
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <BlockEditor
          key={i}
          block={block}
          onChange={b => updateBlock(i, b)}
          onRemove={() => removeBlock(i)}
          canRemove={blocks.length > 1}
          index={i}
        />
      ))}

      {blocks.length < maxBlocks && (
        <div className="flex flex-wrap gap-2">
          {(['text', 'image', 'video', 'flex'] as MessageBlock['type'][]).map(type => (
            <button
              key={type}
              onClick={() => addBlock(type)}
              className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={TYPE_ICONS[type]} />
              </svg>
              + {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        {blocks.length}/{maxBlocks} ブロック (LINE APIは最大5メッセージまで)
      </p>
    </div>
  );
}
