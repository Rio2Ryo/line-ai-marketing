## 🤖 マルチエージェント【確定版・動作確認済み 2026-02-28】

**kin で3エージェント並列実行を確認済み。必ずこのパターンを使うこと。**

CLAUDE_BIN=/home/gureocbot/.npm-global/bin/claude

並列起動パターン（env -u CLAUDECODE が必須）:
  env -u CLAUDECODE $CLAUDE_BIN --dangerously-skip-permissions -p 'タスク1' > /tmp/agent1.log 2>&1 &
  PID1=$!
  env -u CLAUDECODE $CLAUDE_BIN --dangerously-skip-permissions -p 'タスク2' > /tmp/agent2.log 2>&1 &
  PID2=$!
  env -u CLAUDECODE $CLAUDE_BIN --dangerously-skip-permissions -p 'タスク3' > /tmp/agent3.log 2>&1 &
  PID3=$!
  wait $PID1 $PID2 $PID3
  cat /tmp/agent1.log /tmp/agent2.log /tmp/agent3.log

なぜenv -u CLAUDECODEが必要か:
Claude CodeはCLAUDECODE環境変数をセットする。子プロセスに残るとネスト起動が拒否される。
env -u CLAUDECODEでその変数を除去してから起動することで解決。

タスク分解パターン:
- agent1: フロントエンド（UIコンポーネント・ページ）
- agent2: バックエンド（API・DB・ビジネスロジック）
- agent3: テスト（ユニット・E2E）
→ wait → 統合 → commit

ルール:
1. 複数ファイルにまたがる実装は必ず並列起動
2. 単独実行は1ファイル以内の小修正のみ
3. プロンプトは具体的に（ファイルパス・実装内容・コードスタイルを含める）
4. 完了報告に「何エージェントで並列実行したか」を明記

---

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


---

## タスク完了後のプロトコル（必須・毎回実行）

タスクが完了したら、次の指示を待つ前に**必ず以下を自分で実行**すること。

### STEP 1: 自己評価
コードベース・git log・テスト結果を自分で確認し、プロジェクトのゴールに対して「完成している機能」と「まだ足りないもの・改善すべきもの」を洗い出す。アオやRyoの指示を待たない。自分で考える。

### STEP 2: status-report.md を更新
~/status-report.md を最新状態に書き直す。完成済みはチェック、未実装・改善必要はHIGH/MEDIUM/LOW優先度付きで記載。

### STEP 3: Telegramで次タスクを提案
担当トピックに送信する形式:
【[プロジェクト名] 完了 + 次タスク提案】
✅ 今回完了: [やったこと]
💡 次の提案:
🔴 HIGH: [最重要タスク・理由]
🟡 MEDIUM: [中優先・理由]
🟢 LOW: [低優先・理由]
⚠️ ブロッカー: [外部対応必要なもの]
→ アオ確認後に実装開始します

### STEP 4: 待機とフォールバック
アオからの返信を受け取ってから実装開始。ただし30分以上返信がない場合はHIGHタスクを自律判断で開始してよい。
