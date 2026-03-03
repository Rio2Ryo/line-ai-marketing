-- schema-v10: Message templates
CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK(message_type IN ('text','flex')),
  content TEXT NOT NULL,
  is_preset INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Preset templates: 飲食
INSERT OR IGNORE INTO message_templates (id, name, category, message_type, content, is_preset) VALUES
  ('preset-food-01', '新メニューのお知らせ', '飲食', 'text', '🍽️ 新メニュー登場！\n\n{menu_name}が本日よりスタート！\n\n期間限定の特別価格 {price}円でご提供中✨\n\nご予約はプロフィールのリンクから👆', 1),
  ('preset-food-02', 'ランチタイム告知', '飲食', 'text', '☀️ 本日のランチスペシャル\n\n{menu_name}\n通常{original_price}円 → {price}円\n\n11:00〜14:00限定！\nお早めにご来店ください🏃', 1),
  ('preset-food-03', 'クーポン配布', '飲食', 'text', '🎉 友だち限定クーポン！\n\n{discount}%OFF\n有効期限: {expiry}\n\nこのメッセージをレジで見せるだけ！\n※他クーポンとの併用不可', 1);

-- Preset templates: EC
INSERT OR IGNORE INTO message_templates (id, name, category, message_type, content, is_preset) VALUES
  ('preset-ec-01', 'セール告知', 'EC', 'text', '🔥 期間限定セール開催中！\n\n最大{discount}%OFF\n期間: {start_date}〜{end_date}\n\n人気商品が早い者勝ち！\n▶️ {shop_url}', 1),
  ('preset-ec-02', '新商品入荷', 'EC', 'text', '✨ 新商品入荷しました！\n\n{product_name}\n💰 {price}円（税込）\n\n{description}\n\n▶️ 詳細はこちら\n{product_url}', 1),
  ('preset-ec-03', 'カート放棄リマインド', 'EC', 'text', '🛒 お買い忘れはありませんか？\n\nカートに商品が残っています！\n\n{product_name}\n\n在庫残りわずかです。お早めにどうぞ👆\n▶️ {cart_url}', 1);

-- Preset templates: 美容
INSERT OR IGNORE INTO message_templates (id, name, category, message_type, content, is_preset) VALUES
  ('preset-beauty-01', '予約リマインド', '美容', 'text', '📅 ご予約のリマインドです\n\n{customer_name}様\n日時: {date} {time}\nメニュー: {menu}\n\n変更・キャンセルはお早めにご連絡ください📞', 1),
  ('preset-beauty-02', '新メニュー紹介', '美容', 'text', '💅 新メニューのご案内\n\n{menu_name}\n💰 {price}円〜\n所要時間: 約{duration}分\n\n{description}\n\n📱 ご予約はこちら\n{booking_url}', 1),
  ('preset-beauty-03', 'バースデークーポン', '美容', 'text', '🎂 お誕生日おめでとうございます！\n\n{customer_name}様への特別プレゼント🎁\n\n全メニュー{discount}%OFF\n有効期限: 今月末まで\n\nご来店お待ちしております✨', 1);

-- Preset templates: 汎用
INSERT OR IGNORE INTO message_templates (id, name, category, message_type, content, is_preset) VALUES
  ('preset-general-01', 'お知らせ', '汎用', 'text', '📢 お知らせ\n\n{title}\n\n{body}\n\n詳しくはこちら👇\n{url}', 1),
  ('preset-general-02', 'アンケート依頼', '汎用', 'text', '📝 アンケートのお願い\n\nいつもご利用ありがとうございます！\nサービス向上のため、簡単なアンケートにご協力ください🙏\n\n所要時間: 約{duration}分\n▶️ {survey_url}', 1),
  ('preset-general-03', '年末年始の営業案内', '汎用', 'text', '🎍 年末年始の営業案内\n\n休業期間: {start}〜{end}\n通常営業開始: {resume}\n\n期間中のお問い合わせは{contact}まで。\n\n来年もよろしくお願いいたします🙇', 1);
