# LINE AI Marketing Automation Tool

次世代AI-LINEマーケティングオートメーションツール - LSTEP全機能 + AI統合SaaS

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Cloudflare Workers + Hono
- **Database**: Cloudflare D1 (SQLite) + KV
- **AI**: Anthropic Claude API
- **LINE**: LINE Messaging API + LINE Login
- **Deploy**: Cloudflare Pages + Workers

## Project Structure

```
line-ai-marketing/
├── packages/
│   ├── web/          # Next.js frontend
│   ├── api/          # Cloudflare Workers API
│   └── shared/       # Shared types & constants
├── turbo.json
└── package.json
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example packages/api/.dev.vars
   ```

3. Create D1 database:
   ```bash
   npx wrangler d1 create line-ai-marketing-db
   ```

4. Apply schema:
   ```bash
   npx wrangler d1 execute line-ai-marketing-db --file=packages/api/schema.sql
   ```

5. Start development servers:
   ```bash
   npm run dev:web   # Frontend on localhost:3000
   npm run dev:api   # API on localhost:8787
   ```

## LINE Messaging API Setup

LINE連携にはLINE Developersの認証情報が必要です。未設定でもAI応答・ダッシュボード・Webhookシミュレーターは動作します。

### Required Secrets

```bash
# Workers secrets (set via wrangler CLI)
wrangler secret put LINE_CHANNEL_SECRET        # Webhook署名検証
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN   # メッセージ送信
```

### Setup Steps

1. [LINE Developers](https://developers.line.biz/) でMessaging APIチャネルを作成
2. Channel Secret / Channel Access Token を取得
3. 上記 `wrangler secret put` で設定
4. LINE Developers管理画面でWebhook URLを設定:
   ```
   https://<your-workers-domain>/webhook
   ```
5. Webhook利用をONに切り替え

### Without LINE Credentials (Simulator Mode)

LINE認証情報が未設定の場合:
- **Webhook受信**: 署名検証でリジェクトされる（LINE実メッセージ不可）
- **メッセージ送信**: LINE Reply/Push APIが失敗する
- **LIFF**: LINE Login連携が動作しない
- **代替手段**: `/api/webhook-test/simulate` でWebhookパイプライン全体をテスト可能（認証→自動応答→AI RAG→シナリオ→通知）
- **管理画面**: ダッシュボード・顧客管理・ナレッジベース等は正常動作
- **確認方法**: `/health/deep` エンドポイントで `line_channel_secret` / `line_channel_token` の設定状態を確認可能

## Production URLs

| Service | URL |
|---------|-----|
| Frontend (Pages) | https://line-ai-marketing.pages.dev |
| API (Workers) | https://line-ai-marketing-api.common-gifted-tokyo.workers.dev |
| Health Check | https://line-ai-marketing-api.common-gifted-tokyo.workers.dev/health/deep |

## Phase 1-5 (Completed)
- [x] Monorepo setup (npm workspaces)
- [x] Next.js 15 frontend scaffold (49 pages)
- [x] Cloudflare Workers + Hono API (40 routes)
- [x] D1 schema (42 tables)
- [x] LINE Webhook endpoint + simulator
- [x] LINE Login auth flow + JWT
- [x] AI chatbot with RAG (Claude API)
- [x] Scenario engine + auto-response rules
- [x] A/B testing + AI content generation
- [x] Engagement scoring + conversion tracking
- [x] Production deploy (Pages + Workers + D1)
