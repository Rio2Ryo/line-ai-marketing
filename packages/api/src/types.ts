export interface Env {
  DB: D1Database;
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_LOGIN_CHANNEL_ID: string;
  LINE_LOGIN_CHANNEL_SECRET: string;
  JWT_SECRET: string;
  ANTHROPIC_API_KEY: string;
  ENVIRONMENT: string;
  FRONTEND_URL: string;
}

export interface User {
  id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  status_message: string | null;
  access_token: string | null;
  refresh_token: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export interface UserTag {
  user_id: string;
  tag_id: string;
  assigned_at: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string | null;
  is_active: number;
  trigger_type: 'follow' | 'message_keyword' | 'tag_added' | 'manual';
  trigger_config: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScenarioStep {
  id: string;
  scenario_id: string;
  step_order: number;
  message_type: string;
  message_content: string;
  delay_minutes: number;
  condition_json: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string | null;
  raw_json: string | null;
  sent_at: string;
}

export interface KnowledgeBase {
  id: string;
  title: string;
  content: string;
  category: string | null;
  embedding_json: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DeliveryLog {
  id: string;
  scenario_id: string | null;
  scenario_step_id: string | null;
  user_id: string;
  status: 'pending' | 'sent' | 'failed';
  scheduled_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface UserAttribute {
  user_id: string;
  key: string;
  value: string | null;
}
