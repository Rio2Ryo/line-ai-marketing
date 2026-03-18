import { Hono } from 'hono';
import { Env } from '../types';

export const docsRoutes = new Hono<{ Bindings: Env }>();

// ─── OpenAPI 3.0 Spec ───

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'LINE AI Marketing API',
    description: '次世代AI-LINEマーケティングオートメーションツール — LSTEP全機能 + AI統合SaaS\n\nすべてのAPI（/health, /webhook, /auth, /docs以外）は `Authorization: Bearer <JWT>` ヘッダーが必要です。',
    version: '0.8.0',
    contact: { name: 'LINE AI Marketing', url: 'https://github.com/Rio2Ryo/line-ai-marketing' },
  },
  servers: [
    { url: 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev', description: 'Production' },
    { url: 'http://localhost:8787', description: 'Local development' },
  ],
  tags: [
    { name: 'Health', description: 'ヘルスチェック・監視' },
    { name: 'Auth', description: '認証・JWT' },
    { name: 'Customers', description: '顧客管理 (CRUD + タグ)' },
    { name: 'Tags', description: 'タグ管理' },
    { name: 'Scenarios', description: 'シナリオ配信 (ステップ配信・条件分岐)' },
    { name: 'Messages / Chat', description: 'チャット・メッセージ管理' },
    { name: 'Knowledge Base', description: 'ナレッジベース (FAQ・AI RAG用)' },
    { name: 'AI', description: 'AI機能 (生成・分類・最適化・チャットボット)' },
    { name: 'Templates', description: 'メッセージテンプレート' },
    { name: 'A/B Tests', description: 'A/Bテスト' },
    { name: 'Auto Response', description: '自動応答ルール' },
    { name: 'Surveys', description: 'アンケート' },
    { name: 'Delivery', description: '配信管理 (予約・キュー・エラー・リトライ)' },
    { name: 'Analytics', description: '分析・レポート' },
    { name: 'Engagement', description: 'エンゲージメントスコア・コンバージョン' },
    { name: 'Rich Menu', description: 'リッチメニュー管理' },
    { name: 'Notifications', description: '管理者通知' },
    { name: 'Settings', description: 'システム設定' },
    { name: 'Security', description: 'セキュリティ (監査ログ・IP制御)' },
    { name: 'Accounts', description: 'マルチアカウント管理' },
    { name: 'Webhook', description: 'LINE Webhook受信・シミュレーター' },
    { name: 'LIFF', description: 'LIFF (LINE Front-end Framework) エンドポイント' },
    { name: 'Admin', description: '管理者機能 (Cron・インポート・エクスポート)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          line_user_id: { type: 'string' },
          display_name: { type: 'string', nullable: true },
          picture_url: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['active', 'unfollowed', 'blocked'] },
          role: { type: 'string', enum: ['admin', 'operator', 'viewer'] },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      Tag: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          color: { type: 'string', example: '#06C755' },
          description: { type: 'string', nullable: true },
          user_count: { type: 'integer' },
        },
      },
      Scenario: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          is_active: { type: 'integer', enum: [0, 1] },
          trigger_type: { type: 'string', enum: ['follow', 'message_keyword', 'tag_added', 'manual'] },
          trigger_config: { type: 'string', nullable: true },
        },
      },
      KnowledgeArticle: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          content: { type: 'string' },
          category: { type: 'string', nullable: true },
          is_active: { type: 'integer', enum: [0, 1] },
        },
      },
      Message: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          direction: { type: 'string', enum: ['inbound', 'outbound'] },
          message_type: { type: 'string' },
          content: { type: 'string', nullable: true },
          sent_at: { type: 'string', format: 'date-time' },
        },
      },
      Template: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          message_type: { type: 'string' },
          content: { type: 'string' },
          category: { type: 'string', nullable: true },
          use_count: { type: 'integer' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // ═══ Health ═══
    '/health': {
      get: {
        tags: ['Health'], summary: 'Simple health check', security: [],
        responses: { '200': { description: '{ status: "healthy" }' } },
      },
    },
    '/health/monitor': {
      get: {
        tags: ['Health'], summary: 'Fast monitoring endpoint (D1 only, ~30ms)',
        description: 'UptimeRobot/Pingdom向け。キーワード "HEALTHY" or "UNHEALTHY" を返す。',
        security: [],
        responses: {
          '200': { description: 'HEALTHY | tables=N | Nms', content: { 'text/plain': { schema: { type: 'string' } } } },
          '503': { description: 'UNHEALTHY | ...' },
        },
      },
    },
    '/health/deep': {
      get: {
        tags: ['Health'], summary: 'Deep health check (D1 + Claude API + config)', security: [],
        responses: { '200': { description: '全チェック結果JSON (status, checks.d1, checks.data, checks.claude, checks.config)' } },
      },
    },
    '/health/check': {
      post: {
        tags: ['Health'], summary: 'Deep check + alert on state transitions', security: [],
        description: 'healthy↔unhealthy遷移時にSlack/Email自動通知。Cronから呼び出し用。',
        responses: { '200': { description: 'Check result with alert status' } },
      },
    },
    '/health/e2e-token': {
      post: {
        tags: ['Health'], summary: 'Issue JWT for E2E testing',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['cf_api_token'], properties: { cf_api_token: { type: 'string' } } } } },
        },
        responses: {
          '200': { description: '{ success, token, user_id, expires_in }' },
          '403': { description: 'Invalid Cloudflare API token' },
        },
      },
    },

    // ═══ Auth ═══
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'LINE Loginコールバック → JWT発行', security: [],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { code: { type: 'string' }, redirect_uri: { type: 'string' } } } } } },
        responses: { '200': { description: '{ token, user }' } },
      },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: '現在のユーザー情報取得', responses: { '200': { description: 'User object' } } },
    },
    '/auth/refresh': {
      post: { tags: ['Auth'], summary: 'JWTリフレッシュ', responses: { '200': { description: '{ token }' } } },
    },

    // ═══ Customers ═══
    '/api/customers': {
      get: {
        tags: ['Customers'], summary: '顧客一覧 (ページネーション・検索・フィルタ)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: '表示名で部分一致検索' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'unfollowed', 'blocked'] } },
          { name: 'tag_id', in: 'query', schema: { type: 'string' }, description: 'タグでフィルタ' },
        ],
        responses: { '200': { description: '{ success, data: User[], pagination }' } },
      },
    },
    '/api/customers/{id}': {
      get: {
        tags: ['Customers'], summary: '顧客詳細 (タグ・メッセージ・属性含む)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'User with tags, messages, attributes' }, '404': { description: 'Not found' } },
      },
      put: {
        tags: ['Customers'], summary: '顧客情報更新',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { display_name: { type: 'string' }, status: { type: 'string' } } } } } },
        responses: { '200': { description: 'Updated user' } },
      },
      delete: {
        tags: ['Customers'], summary: '顧客削除',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/api/customers/{id}/tags': {
      post: {
        tags: ['Customers'], summary: '顧客にタグ追加',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['tag_id'], properties: { tag_id: { type: 'string' } } } } } },
        responses: { '200': { description: 'Tag assigned' } },
      },
    },
    '/api/customers/{id}/tags/{tagId}': {
      delete: {
        tags: ['Customers'], summary: '顧客からタグ削除',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'tagId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Tag removed' } },
      },
    },
    '/api/customers/{id}/attributes': {
      put: {
        tags: ['Customers'], summary: '顧客属性更新',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: { type: 'string' } } } } },
        responses: { '200': { description: 'Attributes updated' } },
      },
    },

    // ═══ Tags ═══
    '/api/tags': {
      get: { tags: ['Tags'], summary: 'タグ一覧 (user_count付き)', responses: { '200': { description: 'Tag[]' } } },
      post: {
        tags: ['Tags'], summary: 'タグ作成',
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, color: { type: 'string', default: '#06C755' }, description: { type: 'string' } } } } } },
        responses: { '201': { description: 'Created tag' } },
      },
    },
    '/api/tags/{id}': {
      put: {
        tags: ['Tags'], summary: 'タグ更新',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Updated tag' } },
      },
      delete: {
        tags: ['Tags'], summary: 'タグ削除',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },

    // ═══ Scenarios ═══
    '/api/scenarios': {
      get: { tags: ['Scenarios'], summary: 'シナリオ一覧 (ステップ数付き)', responses: { '200': { description: 'Scenario[]' } } },
      post: {
        tags: ['Scenarios'], summary: 'シナリオ作成',
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['name', 'trigger_type'], properties: { name: { type: 'string' }, description: { type: 'string' }, trigger_type: { type: 'string' }, trigger_config: { type: 'string' } } } } } },
        responses: { '201': { description: 'Created scenario' } },
      },
    },
    '/api/scenarios/{id}': {
      get: { tags: ['Scenarios'], summary: 'シナリオ詳細 (ステップ含む)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Scenario with steps' } } },
      put: { tags: ['Scenarios'], summary: 'シナリオ更新', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Scenarios'], summary: 'シナリオ削除', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    '/api/scenarios/{id}/steps': {
      post: { tags: ['Scenarios'], summary: 'ステップ追加', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created step' } } },
    },
    '/api/scenarios/{id}/steps/{stepId}': {
      put: { tags: ['Scenarios'], summary: 'ステップ更新', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'stepId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Scenarios'], summary: 'ステップ削除', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'stepId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    '/api/scenarios/{id}/execute': {
      post: { tags: ['Scenarios'], summary: 'シナリオ手動実行', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Execution result' } } },
    },
    '/api/scenarios/{id}/toggle': {
      post: { tags: ['Scenarios'], summary: 'シナリオ有効/無効切替', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Toggled' } } },
    },

    // ═══ Knowledge Base ═══
    '/api/knowledge': {
      get: {
        tags: ['Knowledge Base'], summary: 'ナレッジ記事一覧',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'KnowledgeArticle[] with pagination' } },
      },
      post: {
        tags: ['Knowledge Base'], summary: 'ナレッジ記事作成',
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['title', 'content'], properties: { title: { type: 'string' }, content: { type: 'string' }, category: { type: 'string' } } } } } },
        responses: { '201': { description: 'Created article' } },
      },
    },
    '/api/knowledge/{id}': {
      get: { tags: ['Knowledge Base'], summary: 'ナレッジ記事詳細', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Article' } } },
      put: { tags: ['Knowledge Base'], summary: 'ナレッジ記事更新', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Knowledge Base'], summary: 'ナレッジ記事削除', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },

    // ═══ Chat ═══
    '/api/chat/conversations': {
      get: { tags: ['Messages / Chat'], summary: '会話一覧 (最新メッセージ・未読数付き)', responses: { '200': { description: 'Conversation list' } } },
    },
    '/api/chat/{userId}/messages': {
      get: { tags: ['Messages / Chat'], summary: 'ユーザーとのメッセージ履歴', parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Message[]' } } },
    },
    '/api/chat/{userId}/send': {
      post: {
        tags: ['Messages / Chat'], summary: 'メッセージ送信 (LINE Push API)',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } } } } },
        responses: { '200': { description: 'Sent' } },
      },
    },
    '/api/chat/{userId}/read': {
      post: { tags: ['Messages / Chat'], summary: '既読マーク', parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Marked as read' } } },
    },

    // ═══ AI ═══
    '/api/ai': {
      get: { tags: ['AI'], summary: 'AIチャットログ一覧', responses: { '200': { description: 'AiChatLog[]' } } },
    },
    '/api/ai/{id}': {
      get: { tags: ['AI'], summary: 'AIチャットログ詳細', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Log detail' } } },
    },
    '/api/ai/generate/message': {
      post: {
        tags: ['AI'], summary: 'AI メッセージ文面生成',
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['purpose', 'target'], properties: { purpose: { type: 'string' }, target: { type: 'string' }, tone: { type: 'string' }, count: { type: 'integer', default: 3 } } } } } },
        responses: { '200': { description: '{ suggestions: string[] }' } },
      },
    },
    '/api/ai/generate/flex': {
      post: { tags: ['AI'], summary: 'AI Flex Messageデザイン生成', responses: { '200': { description: 'Flex Message JSON' } } },
    },
    '/api/ai/classify/intent': {
      post: {
        tags: ['AI'], summary: 'AIメッセージ意図分類',
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } } },
        responses: { '200': { description: '{ intent, confidence, entities }' } },
      },
    },
    '/api/ai/classify/sentiment': {
      post: { tags: ['AI'], summary: 'AI感情分析', responses: { '200': { description: '{ sentiment, score }' } } },
    },
    '/api/ai-optimize/timing': {
      get: { tags: ['AI'], summary: '配信タイミング最適化分析', responses: { '200': { description: 'Hourly/daily engagement data' } } },
    },
    '/api/ai-optimize/recommend': {
      post: { tags: ['AI'], summary: 'AI配信最適化レコメンド', responses: { '200': { description: 'Optimization suggestions' } } },
    },

    // ═══ Chat Analytics ═══
    '/api/chat-analytics/overview': {
      get: {
        tags: ['Analytics'], summary: '会話品質サマリー',
        parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 30 } }],
        responses: { '200': { description: 'Satisfaction score, escalation rate, avg confidence, etc.' } },
      },
    },
    '/api/chat-analytics/satisfaction-trend': {
      get: { tags: ['Analytics'], summary: '日別満足度推移', parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 30 } }], responses: { '200': { description: 'Daily trend data' } } },
    },
    '/api/chat-analytics/faq': {
      get: { tags: ['Analytics'], summary: 'FAQ自動抽出', responses: { '200': { description: 'Top FAQ list' } } },
    },
    '/api/chat-analytics/knowledge-gaps': {
      get: { tags: ['Analytics'], summary: 'ナレッジベース改善提案', responses: { '200': { description: 'Knowledge gaps + suggestions' } } },
    },
    '/api/chat-analytics/quality': {
      get: { tags: ['Analytics'], summary: '会話品質スコア詳細', responses: { '200': { description: 'Confidence/time distribution, hourly, top users' } } },
    },
    '/api/chat-analytics/ai-suggest': {
      post: { tags: ['Analytics'], summary: 'AIによる改善提案生成', responses: { '200': { description: 'AI-generated suggestions' } } },
    },

    // ═══ Templates ═══
    '/api/templates': {
      get: {
        tags: ['Templates'], summary: 'テンプレート一覧',
        parameters: [{ name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }],
        responses: { '200': { description: 'Template[]' } },
      },
      post: { tags: ['Templates'], summary: 'テンプレート作成', responses: { '201': { description: 'Created' } } },
    },
    '/api/templates/categories': {
      get: { tags: ['Templates'], summary: 'カテゴリ一覧', responses: { '200': { description: 'string[]' } } },
    },
    '/api/templates/{id}': {
      get: { tags: ['Templates'], summary: 'テンプレート詳細', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Template' } } },
      put: { tags: ['Templates'], summary: 'テンプレート更新', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Templates'], summary: 'テンプレート削除', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    '/api/templates/ai-generate': {
      post: { tags: ['Templates'], summary: 'AIテンプレート生成', responses: { '200': { description: 'Generated template' } } },
    },
    '/api/templates/{id}/ab-variations': {
      post: { tags: ['Templates'], summary: 'A/Bテストバリエーション生成', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Variations' } } },
    },

    // ═══ A/B Tests ═══
    '/api/ab-tests': {
      get: { tags: ['A/B Tests'], summary: 'A/Bテスト一覧', responses: { '200': { description: 'AbTest[]' } } },
      post: { tags: ['A/B Tests'], summary: 'A/Bテスト作成', responses: { '201': { description: 'Created' } } },
    },
    '/api/ab-tests/{id}': {
      get: { tags: ['A/B Tests'], summary: 'A/Bテスト詳細 (バリエーション・結果)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Test detail' } } },
      put: { tags: ['A/B Tests'], summary: 'A/Bテスト更新', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['A/B Tests'], summary: 'A/Bテスト削除', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    '/api/ab-tests/{id}/start': {
      post: { tags: ['A/B Tests'], summary: 'テスト開始', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Started' } } },
    },
    '/api/ab-tests/{id}/complete': {
      post: { tags: ['A/B Tests'], summary: 'テスト完了 (勝者判定)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Completed with winner' } } },
    },

    // ═══ Auto Response ═══
    '/api/auto-response': {
      get: { tags: ['Auto Response'], summary: '自動応答ルール一覧', responses: { '200': { description: 'Rule[]' } } },
      post: {
        tags: ['Auto Response'], summary: '自動応答ルール作成',
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['trigger_type', 'trigger_pattern', 'response_content'], properties: { trigger_type: { type: 'string', enum: ['keyword', 'exact_match', 'regex'] }, trigger_pattern: { type: 'string' }, response_type: { type: 'string', default: 'text' }, response_content: { type: 'string' }, priority: { type: 'integer' } } } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/api/auto-response/{id}': {
      put: { tags: ['Auto Response'], summary: 'ルール更新', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Auto Response'], summary: 'ルール削除', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    '/api/auto-response/test': {
      post: {
        tags: ['Auto Response'], summary: 'ルールマッチテスト',
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } } },
        responses: { '200': { description: '{ matched, rule_id, response }' } },
      },
    },

    // ═══ Surveys ═══
    '/api/surveys': {
      get: { tags: ['Surveys'], summary: 'アンケート一覧', responses: { '200': { description: 'Survey[]' } } },
      post: { tags: ['Surveys'], summary: 'アンケート作成', responses: { '201': { description: 'Created' } } },
    },
    '/api/surveys/{id}': {
      get: { tags: ['Surveys'], summary: 'アンケート詳細 (設問・回答集計)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Survey with questions and stats' } } },
      put: { tags: ['Surveys'], summary: 'アンケート更新', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Surveys'], summary: 'アンケート削除', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },

    // ═══ Delivery ═══
    '/api/scheduled': {
      get: { tags: ['Delivery'], summary: '予約配信一覧', responses: { '200': { description: 'ScheduledDelivery[]' } } },
      post: { tags: ['Delivery'], summary: '予約配信作成', responses: { '201': { description: 'Created' } } },
    },
    '/api/delivery-queue': {
      get: { tags: ['Delivery'], summary: '配信キュー一覧', responses: { '200': { description: 'Queue[]' } } },
      post: { tags: ['Delivery'], summary: '配信キュー作成', responses: { '201': { description: 'Created' } } },
    },
    '/api/delivery-queue/{id}/start': {
      post: { tags: ['Delivery'], summary: '配信開始', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Started' } } },
    },
    '/api/delivery-errors': {
      get: { tags: ['Delivery'], summary: '配信エラー一覧', responses: { '200': { description: 'Error logs' } } },
    },

    // ═══ Stats & Analytics ═══
    '/api/stats': {
      get: { tags: ['Analytics'], summary: 'ダッシュボード概要統計', responses: { '200': { description: 'total_friends, messages, active, growth_rate etc.' } } },
    },
    '/api/stats/overview': {
      get: { tags: ['Analytics'], summary: '統計概要', responses: { '200': { description: 'Overview stats' } } },
    },
    '/api/analytics/delivery-effectiveness': {
      get: { tags: ['Analytics'], summary: '配信効果分析', responses: { '200': { description: 'Delivery effectiveness metrics' } } },
    },
    '/api/analytics/user-activity': {
      get: { tags: ['Analytics'], summary: 'ユーザーアクティビティ分析', responses: { '200': { description: 'Activity data' } } },
    },
    '/api/analytics/ai-performance': {
      get: { tags: ['Analytics'], summary: 'AIパフォーマンス分析', responses: { '200': { description: 'AI performance metrics' } } },
    },
    '/api/analytics/churn-risk': {
      get: { tags: ['Analytics'], summary: '離脱リスク分析', responses: { '200': { description: 'Churn risk users' } } },
    },
    '/api/reports': {
      get: { tags: ['Analytics'], summary: 'レポート一覧 (期間指定)', responses: { '200': { description: 'Report data' } } },
    },
    '/api/line-stats': {
      get: { tags: ['Analytics'], summary: 'LINE統計情報', responses: { '200': { description: 'LINE-specific stats' } } },
    },

    // ═══ Engagement ═══
    '/api/engagement-scores': {
      get: { tags: ['Engagement'], summary: 'エンゲージメントスコア一覧', responses: { '200': { description: 'Score data' } } },
    },
    '/api/engagement-scores/ranking': {
      get: { tags: ['Engagement'], summary: 'スコアランキング', responses: { '200': { description: 'Ranked users' } } },
    },
    '/api/conversions/goals': {
      get: { tags: ['Engagement'], summary: 'コンバージョンゴール一覧', responses: { '200': { description: 'Goal[]' } } },
      post: { tags: ['Engagement'], summary: 'コンバージョンゴール作成', responses: { '201': { description: 'Created' } } },
    },
    '/api/conversions/track': {
      post: { tags: ['Engagement'], summary: 'コンバージョン記録', responses: { '200': { description: 'Tracked' } } },
    },
    '/api/conversions/funnel': {
      get: { tags: ['Engagement'], summary: 'ファネル分析', responses: { '200': { description: 'Funnel data' } } },
    },
    '/api/score-actions': {
      get: { tags: ['Engagement'], summary: 'スコア自動アクションルール一覧', responses: { '200': { description: 'Rule[]' } } },
      post: { tags: ['Engagement'], summary: 'スコア自動アクションルール作成', responses: { '201': { description: 'Created' } } },
    },

    // ═══ Rich Menu ═══
    '/api/richmenu': {
      get: { tags: ['Rich Menu'], summary: 'リッチメニュー一覧 (LINE API)', responses: { '200': { description: 'RichMenu[]' } } },
      post: { tags: ['Rich Menu'], summary: 'リッチメニュー作成', responses: { '200': { description: 'Created' } } },
    },
    '/api/richmenu-rules': {
      get: { tags: ['Rich Menu'], summary: 'リッチメニュー切替ルール一覧', responses: { '200': { description: 'Rule[]' } } },
      post: { tags: ['Rich Menu'], summary: '切替ルール作成', responses: { '201': { description: 'Created' } } },
    },

    // ═══ Notifications ═══
    '/api/notifications': {
      get: { tags: ['Notifications'], summary: '通知一覧 (ページネーション)', responses: { '200': { description: 'Notification[]' } } },
    },
    '/api/notifications/unread-count': {
      get: { tags: ['Notifications'], summary: '未読通知数', responses: { '200': { description: '{ count }' } } },
    },
    '/api/notifications/poll': {
      get: { tags: ['Notifications'], summary: '通知ポーリング (since指定)', responses: { '200': { description: 'New notifications since timestamp' } } },
    },
    '/api/notifications/{id}/read': {
      put: { tags: ['Notifications'], summary: '通知既読', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Marked read' } } },
    },
    '/api/notifications/read-all': {
      put: { tags: ['Notifications'], summary: '全通知既読', responses: { '200': { description: 'All marked read' } } },
    },

    // ═══ Settings ═══
    '/api/settings': {
      get: { tags: ['Settings'], summary: 'システム設定取得', responses: { '200': { description: 'Key-value settings' } } },
      put: {
        tags: ['Settings'], summary: 'システム設定更新',
        requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: { type: 'string' } } } } },
        responses: { '200': { description: 'Updated settings' } },
      },
    },

    // ═══ Security ═══
    '/api/security/audit-logs': {
      get: { tags: ['Security'], summary: '監査ログ一覧', responses: { '200': { description: 'AuditLog[]' } } },
    },
    '/api/security/ip-rules': {
      get: { tags: ['Security'], summary: 'IPルール一覧', responses: { '200': { description: 'IpRule[]' } } },
      post: { tags: ['Security'], summary: 'IPルール作成', responses: { '201': { description: 'Created' } } },
    },

    // ═══ Accounts ═══
    '/api/accounts': {
      get: { tags: ['Accounts'], summary: 'LINEアカウント一覧', responses: { '200': { description: 'Account[]' } } },
      post: { tags: ['Accounts'], summary: 'アカウント追加', responses: { '201': { description: 'Created' } } },
    },

    // ═══ Webhook ═══
    '/webhook': {
      post: { tags: ['Webhook'], summary: 'LINE Webhook受信', security: [], description: 'LINE Messaging APIからのWebhookイベントを受信。X-Line-Signature検証。', responses: { '200': { description: 'OK' } } },
    },
    '/api/webhook-test/simulate': {
      post: {
        tags: ['Webhook'], summary: 'Webhookシミュレーター (LINE API不要)',
        description: 'LINE Webhookと同等のパイプラインをシミュレート。自動応答→AI RAG→シナリオ→通知。',
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['event_type', 'line_user_id'], properties: { event_type: { type: 'string', enum: ['message', 'follow', 'unfollow', 'postback'] }, line_user_id: { type: 'string' }, message: { type: 'object', properties: { type: { type: 'string' }, text: { type: 'string' } } }, postback_data: { type: 'string' } } } } } },
        responses: { '200': { description: 'Pipeline execution result' } },
      },
    },
    '/api/webhook-test/cleanup': {
      post: { tags: ['Webhook'], summary: 'テストデータクリーンアップ', responses: { '200': { description: 'Cleaned tables' } } },
    },
    '/api/webhook-stream/events': {
      get: { tags: ['Webhook'], summary: 'Webhookイベント履歴', responses: { '200': { description: 'WebhookEvent[]' } } },
    },

    // ═══ LIFF ═══
    '/api/liff/profile': {
      get: { tags: ['LIFF'], summary: 'LIFFユーザープロフィール', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Profile data' } } },
    },
    '/api/liff/surveys': {
      get: { tags: ['LIFF'], summary: 'LIFFアンケート一覧', responses: { '200': { description: 'Survey[]' } } },
    },
    '/api/liff/history': {
      get: { tags: ['LIFF'], summary: 'LIFFメッセージ履歴', responses: { '200': { description: 'Message[]' } } },
    },

    // ═══ Admin ═══
    '/api/cron-tasks/run': {
      post: { tags: ['Admin'], summary: '全Cronタスク実行 (admin)', description: 'シナリオ配信・予約配信・リトライ・キャッシュクリーンアップを並列実行', responses: { '200': { description: 'Task results' } } },
    },
    '/api/cron-tasks/run/{task}': {
      post: {
        tags: ['Admin'], summary: '個別タスク実行',
        parameters: [{ name: 'task', in: 'path', required: true, schema: { type: 'string', enum: ['scenario-deliveries', 'scheduled-deliveries', 'retries', 'cache-cleanup', 'health-check'] } }],
        responses: { '200': { description: 'Task result' } },
      },
    },
    '/api/cron-tasks/status': {
      get: { tags: ['Admin'], summary: 'Cronステータス (最終実行・保留件数)', responses: { '200': { description: 'Status data' } } },
    },
    '/api/import/customers': {
      post: { tags: ['Admin'], summary: '顧客CSVインポート', responses: { '200': { description: 'Import result' } } },
    },
    '/api/export/customers': {
      get: { tags: ['Admin'], summary: '顧客CSVエクスポート', responses: { '200': { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string' } } } } } },
    },
    '/api/export/ai-logs': {
      get: { tags: ['Admin'], summary: 'AIログCSVエクスポート', responses: { '200': { description: 'CSV file' } } },
    },
    '/api/roles': {
      get: { tags: ['Admin'], summary: 'ロール一覧・権限管理', responses: { '200': { description: 'Role data' } } },
    },
    '/api/api-monitor/summary': {
      get: { tags: ['Admin'], summary: 'APIリクエスト監視サマリー', responses: { '200': { description: 'Request stats' } } },
    },
    '/api/rate-limit/stats': {
      get: { tags: ['Admin'], summary: 'レートリミット統計', responses: { '200': { description: 'Rate limit stats' } } },
    },
    '/api/segments': {
      get: { tags: ['Customers'], summary: 'セグメント配信 (条件指定)', responses: { '200': { description: 'Segment data' } } },
    },
    '/api/follow-sources': {
      get: { tags: ['Analytics'], summary: '友だち追加経路一覧', responses: { '200': { description: 'FollowSource[]' } } },
      post: { tags: ['Analytics'], summary: '追加経路作成', responses: { '201': { description: 'Created' } } },
    },
    '/api/widgets/data': {
      get: { tags: ['Analytics'], summary: 'ダッシュボードウィジェットデータ', responses: { '200': { description: 'Widget data' } } },
    },
    '/api/calendar': {
      get: { tags: ['Delivery'], summary: '配信カレンダー', responses: { '200': { description: 'Calendar events' } } },
    },
    '/api/media/{messageId}': {
      get: { tags: ['Messages / Chat'], summary: 'メディアファイル取得 (LINE Content API)', parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Binary content' } } },
    },
  },
} as const;

// ─── Swagger UI HTML ───

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>LINE AI Marketing API — Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"/>
  <style>
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: './openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      defaultModelsExpandDepth: 1,
      docExpansion: 'list',
      filter: true,
      tagsSorter: 'alpha',
    });
  </script>
</body>
</html>`;

// ─── Routes ───

docsRoutes.get('/', (c) => {
  return c.html(SWAGGER_HTML);
});

docsRoutes.get('/openapi.json', (c) => {
  c.header('Cache-Control', 'public, max-age=300');
  return c.json(spec);
});
