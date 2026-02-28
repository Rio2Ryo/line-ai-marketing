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

## Phase 1 (Current)
- [x] Monorepo setup (npm workspaces)
- [x] Next.js 15 frontend scaffold
- [x] Cloudflare Workers + Hono API
- [x] D1 schema (users, tags, scenarios, messages, knowledge_base)
- [x] LINE Webhook endpoint
- [x] LINE Login auth flow
- [x] wrangler.toml configuration
