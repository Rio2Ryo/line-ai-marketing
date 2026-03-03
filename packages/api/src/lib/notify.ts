import { Env } from '../types';

interface NotifyPayload {
  title: string;
  message: string;
  userId?: string;
  userName?: string;
  priority?: 'high' | 'normal';
  userMessage?: string;
  aiReply?: string;
}

/** Load a setting value from D1 */
async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

/** Send Slack Incoming Webhook */
async function sendSlack(webhookUrl: string, payload: NotifyPayload): Promise<boolean> {
  try {
    const blocks: any[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: payload.title, emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: payload.message },
      },
    ];

    if (payload.userName || payload.userId) {
      blocks.push({
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*ユーザー:*\n${payload.userName || payload.userId || '不明'}` },
          { type: 'mrkdwn', text: `*優先度:*\n${payload.priority === 'high' ? '🔴 高' : '🟡 通常'}` },
        ],
      });
    }

    if (payload.userMessage) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*ユーザーメッセージ:*\n> ${payload.userMessage.slice(0, 200)}` },
      });
    }

    if (payload.aiReply) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*AI応答:*\n> ${payload.aiReply.slice(0, 200)}` },
      });
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    return res.ok;
  } catch (e) {
    console.error('Slack notify error:', e);
    return false;
  }
}

/** Send email via MailChannels (free for CF Workers) */
async function sendEmail(toAddress: string, payload: NotifyPayload): Promise<boolean> {
  try {
    const body = [
      payload.message,
      '',
      payload.userName ? `ユーザー: ${payload.userName}` : '',
      payload.userId ? `ユーザーID: ${payload.userId}` : '',
      payload.priority ? `優先度: ${payload.priority === 'high' ? '高' : '通常'}` : '',
      payload.userMessage ? `\nユーザーメッセージ:\n${payload.userMessage.slice(0, 500)}` : '',
      payload.aiReply ? `\nAI応答:\n${payload.aiReply.slice(0, 500)}` : '',
    ].filter(Boolean).join('\n');

    const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toAddress }] }],
        from: { email: 'noreply@line-ai-marketing.pages.dev', name: 'LINE AI Marketing' },
        subject: `[LINE AI] ${payload.title}`,
        content: [{ type: 'text/plain', value: body }],
      }),
    });
    return res.status >= 200 && res.status < 300;
  } catch (e) {
    console.error('Email notify error:', e);
    return false;
  }
}

/** Main notification dispatcher: reads settings and sends to enabled channels */
export async function sendNotification(env: Env, payload: NotifyPayload): Promise<{ slack: boolean | null; email: boolean | null }> {
  const result: { slack: boolean | null; email: boolean | null } = { slack: null, email: null };

  try {
    const [notifySlack, notifyEmail, slackUrl, emailAddress] = await Promise.all([
      getSetting(env, 'notify_slack'),
      getSetting(env, 'notify_email'),
      getSetting(env, 'slack_webhook_url'),
      getSetting(env, 'notify_email_address'),
    ]);

    if (notifySlack === 'true' && slackUrl) {
      result.slack = await sendSlack(slackUrl, payload);
    }

    if (notifyEmail === 'true' && emailAddress) {
      result.email = await sendEmail(emailAddress, payload);
    }
  } catch (e) {
    console.error('Notification dispatch error:', e);
  }

  return result;
}

/** Send escalation notification */
export async function notifyEscalation(
  env: Env,
  userId: string,
  userMessage: string,
  aiReply: string,
  confidence: number,
  userName?: string,
): Promise<void> {
  // Check if escalation_notify is enabled
  const enabled = await getSetting(env, 'escalation_notify');
  if (enabled === 'false') return;

  await sendNotification(env, {
    title: 'エスカレーション発生',
    message: `AIが対応できないメッセージを受信しました。オペレーター対応が必要です。\n確信度: ${Math.round(confidence * 100)}%`,
    userId,
    userName,
    priority: confidence < 0.2 ? 'high' : 'normal',
    userMessage,
    aiReply,
  });
}

/** Test notification (for settings page) */
export async function sendTestNotification(env: Env, channel: 'slack' | 'email'): Promise<boolean> {
  const payload: NotifyPayload = {
    title: 'テスト通知',
    message: 'LINE AI Marketingからのテスト通知です。この通知が届いていれば設定は正常です。',
    priority: 'normal',
  };

  if (channel === 'slack') {
    const url = await getSetting(env, 'slack_webhook_url');
    if (!url) return false;
    return sendSlack(url, payload);
  } else {
    const addr = await getSetting(env, 'notify_email_address');
    if (!addr) return false;
    return sendEmail(addr, payload);
  }
}
