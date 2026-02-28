# CLAUDE.md — line-ai-marketing

## プロジェクト概要
**次世代AI-LINEマーケティングオートメーションツール**

LSTEP（LINE公式アカウントMAツール）の全機能を実装し、そこにAI（LLM/ML）を全面統合した新世代SaaS。

- GitHub: https://github.com/Rio2Ryo/line-ai-marketing
- Telegram報告先: chat_id=-1003340768179, message_thread_id=19（gure/line-ai-marketing）

## 技術スタック
- Frontend: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Backend API: Cloudflare Workers + Hono
- DB: Cloudflare D1 (SQLite) + KV (セッション/キャッシュ)
- AI/LLM: Anthropic Claude API (claude-3-5-sonnet / claude-3-5-haiku)
- LINE: @line/bot-sdk + LINE Messaging API
- Auth: LINE Login + LIFF + JWT
- Deploy: Cloudflare Pages (Frontend) + Workers (API)
- CF Account: adeecb44ed0b5f045d01370f5dae595d
- CF API Token: wPYPF6_-IbPFe-tiofdjGJFLKLS2eGGhgDv-kKsT
- Anthropic API Key: 環境変数 ANTHROPIC_API_KEY として設定

## MVP機能（実装順）

### Phase 1: プロジェクト基盤
- Next.js + Workers モノレポ構成
- D1スキーマ設計（顧客/タグ/シナリオ/メッセージ）
- LINE Webhook受信エンドポイント
- LINE Login認証フロー

### Phase 2: ベース機能（LSTEP互換）
- 顧客管理: LINE友達一覧・属性・タグ管理
- シナリオ配信: ステップ配信・条件分岐
- セグメント配信: 属性/行動ベース絞り込み
- アンケートフォーム作成
- リッチメニュー管理
- 基本ダッシュボード

### Phase 3: AIアシスタントチャットボット（最重要）
- ナレッジベース登録（FAQ・商品情報）
- Claude APIによる自然な自動応答（RAG）
- Webhookで受信 → Claude → LINE返信
- オペレーターエスカレーション

### Phase 4: AIコンテンツジェネレーター
- 目的・ターゲット指定 → AIがメッセージ文面案を複数生成
- Flex Messageデザイン自動生成
- A/Bテスト用バリエーション生成

## 🤖 マルチエージェント必須ルール

CLAUDE_BIN=/home/gureocbot/.npm-global/bin/claude

並列実行例:
  $CLAUDE_BIN --dangerously-skip-permissions -p 'フロントエンド実装' > /tmp/a1.log 2>&1 &
  $CLAUDE_BIN --dangerously-skip-permissions -p 'バックエンドAPI実装' > /tmp/a2.log 2>&1 &
  wait && cat /tmp/a1.log /tmp/a2.log

ルール:
1. タスク受け取り → 並列化可能な単位に分解
2. 依存関係のないタスクは必ず並列実行
3. 全完了後に統合・commit・deploy
4. 完了報告に「何エージェントで並列実行したか」を明記

## Telegram報告コマンド
curl -s -X POST "https://api.telegram.org/bot8247958281:AAEeItTIVYFUklGEa4UxA7-SEJ5g1yfFAHU/sendMessage" \
  -d "chat_id=-1003340768179" \
  -d "message_thread_id=19" \
  --data-urlencode "text=✅ [完了内容]\n👉 URL\n次: [次タスク]"

## デプロイ
CLOUDFLARE_API_TOKEN=wPYPF6_-IbPFe-tiofdjGJFLKLS2eGGhgDv-kKsT npx wrangler deploy
