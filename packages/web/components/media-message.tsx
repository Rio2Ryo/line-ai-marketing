'use client';

import { useState } from 'react';
import { getApiUrl, getToken } from '@/lib/auth';

interface MediaMetadata {
  messageId?: string;
  contentProvider?: string;
  duration?: number;
  fileName?: string;
  fileSize?: number;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  packageId?: string;
  stickerId?: string;
  stickerResourceType?: string;
}

interface MediaMessageProps {
  messageType: string;
  content: string;
  rawJson?: string;
  direction: 'inbound' | 'outbound';
}

function getMediaUrl(messageId: string): string {
  const token = getToken();
  return `${getApiUrl()}/api/media/${messageId}?token=${token}`;
}

function parseMetadata(rawJson?: string): MediaMetadata | null {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson);
    return parsed._mediaMetadata || null;
  } catch {
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default function MediaMessage({ messageType, content, rawJson, direction }: MediaMessageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const metadata = parseMetadata(rawJson);
  const isOutbound = direction === 'outbound';

  // Text messages - render as-is
  if (messageType === 'text' || !metadata) {
    return <p className="text-sm whitespace-pre-wrap break-words">{content}</p>;
  }

  // Image
  if (messageType === 'image' && metadata.messageId) {
    const url = getMediaUrl(metadata.messageId);
    if (imageError) {
      return (
        <div className="flex items-center gap-2 text-sm opacity-70">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>画像を読み込めません</span>
        </div>
      );
    }
    return (
      <div className="relative">
        {imageLoading && (
          <div className="w-48 h-32 bg-gray-200 animate-pulse rounded-lg" />
        )}
        <img
          src={url}
          alt="画像"
          className={`max-w-48 max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${imageLoading ? 'hidden' : ''}`}
          onLoad={() => setImageLoading(false)}
          onError={() => { setImageError(true); setImageLoading(false); }}
          onClick={() => window.open(url, '_blank')}
        />
      </div>
    );
  }

  // Video
  if (messageType === 'video' && metadata.messageId) {
    return (
      <div className="space-y-1">
        <div className="relative w-48 h-32 bg-gray-900 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-90"
          onClick={() => window.open(getMediaUrl(metadata.messageId!), '_blank')}
        >
          <svg className="w-12 h-12 text-white/80" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <p className="text-xs opacity-70">
          動画 {metadata.duration ? `(${formatDuration(metadata.duration)})` : ''}
        </p>
      </div>
    );
  }

  // Audio
  if (messageType === 'audio' && metadata.messageId) {
    return (
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
        <div>
          <p className="text-sm">音声メッセージ</p>
          {metadata.duration && <p className="text-xs opacity-70">{formatDuration(metadata.duration)}</p>}
        </div>
      </div>
    );
  }

  // File
  if (messageType === 'file' && metadata.messageId) {
    return (
      <div
        className="flex items-center gap-2 cursor-pointer hover:opacity-80"
        onClick={() => window.open(getMediaUrl(metadata.messageId!), '_blank')}
      >
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <div>
          <p className="text-sm underline">{metadata.fileName || 'ファイル'}</p>
          {metadata.fileSize ? <p className="text-xs opacity-70">{formatFileSize(metadata.fileSize)}</p> : null}
        </div>
      </div>
    );
  }

  // Location
  if (messageType === 'location' && metadata.latitude != null && metadata.longitude != null) {
    const mapUrl = `https://www.openstreetmap.org/?mlat=${metadata.latitude}&mlon=${metadata.longitude}#map=15/${metadata.latitude}/${metadata.longitude}`;
    return (
      <div
        className="cursor-pointer hover:opacity-80"
        onClick={() => window.open(mapUrl, '_blank')}
      >
        <div className="w-48 h-32 bg-blue-50 rounded-lg flex flex-col items-center justify-center border border-blue-200">
          <svg className="w-8 h-8 text-red-500 mb-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
          <p className="text-xs text-blue-700 font-medium px-2 text-center truncate w-full">
            {metadata.title || metadata.address || '位置情報'}
          </p>
        </div>
        {metadata.address && (
          <p className="text-xs opacity-70 mt-1 truncate max-w-48">{metadata.address}</p>
        )}
      </div>
    );
  }

  // Sticker
  if (messageType === 'sticker' && metadata.packageId && metadata.stickerId) {
    const stickerUrl = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${metadata.stickerId}/android/sticker.png`;
    return (
      <img
        src={stickerUrl}
        alt="スタンプ"
        className="w-24 h-24 object-contain"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  // Fallback
  return <p className="text-sm whitespace-pre-wrap break-words">{content}</p>;
}
