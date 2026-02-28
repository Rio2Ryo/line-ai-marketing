// ブランドカラー
export const LINE_BRAND_COLOR = '#06C755';

// APIレスポンス型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// メッセージタイプ
export const MessageType = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  FILE: 'file',
  LOCATION: 'location',
  STICKER: 'sticker',
  FLEX: 'flex',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

// ユーザーステータス
export const UserStatus = {
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  UNFOLLOWED: 'unfollowed',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

// シナリオトリガータイプ
export const TriggerType = {
  FOLLOW: 'follow',
  MESSAGE_KEYWORD: 'message_keyword',
  TAG_ADDED: 'tag_added',
  MANUAL: 'manual',
} as const;
export type TriggerType = (typeof TriggerType)[keyof typeof TriggerType];

// メッセージ方向
export const MessageDirection = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;
export type MessageDirection = (typeof MessageDirection)[keyof typeof MessageDirection];

// LINE Webhook イベントタイプ
export const LineEventType = {
  MESSAGE: 'message',
  FOLLOW: 'follow',
  UNFOLLOW: 'unfollow',
  POSTBACK: 'postback',
  JOIN: 'join',
  LEAVE: 'leave',
} as const;
export type LineEventType = (typeof LineEventType)[keyof typeof LineEventType];

// ナビゲーション項目
export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const DASHBOARD_NAV: NavItem[] = [
  { label: 'ダッシュボード', href: '/dashboard', icon: 'home' },
  { label: '顧客管理', href: '/dashboard/customers', icon: 'users' },
  { label: 'シナリオ', href: '/dashboard/scenarios', icon: 'git-branch' },
  { label: 'メッセージ', href: '/dashboard/messages', icon: 'message-square' },
  { label: 'ナレッジベース', href: '/dashboard/knowledge', icon: 'book-open' },
  { label: '設定', href: '/dashboard/settings', icon: 'settings' },
];
