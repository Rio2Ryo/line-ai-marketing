import { Hono } from 'hono';
import { Env } from '../types';
import { verifySignature, sendReplyMessage } from '../lib/line';

function generateId(): string {
  return crypto.randomUUID();
}

export const webhookRoutes = new Hono<{ Bindings: Env }>();

webhookRoutes.post('/', async (c) => {
  const body = await c.req.text();
  const signature = c.req.header('x-line-signature');

  if (!signature) {
    return c.json({ success: false, error: 'Missing signature' }, 400);
  }

  const isValid = await verifySignature(body, signature, c.env.LINE_CHANNEL_SECRET);
  if (!isValid) {
    return c.json({ success: false, error: 'Invalid signature' }, 403);
  }

  const payload = JSON.parse(body);
  const events = payload.events || [];

  for (const event of events) {
    try {
      switch (event.type) {
        case 'message':
          await handleMessageEvent(c.env, event);
          break;
        case 'follow':
          await handleFollowEvent(c.env, event);
          break;
        case 'unfollow':
          await handleUnfollowEvent(c.env, event);
          break;
        default:
          console.log('Unhandled event type:', event.type);
      }
    } catch (error) {
      console.error('Error handling event:', event.type, error);
    }
  }

  return c.json({ success: true });
});

async function handleMessageEvent(env: Env, event: any): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  // Find or create user
  let user = await env.DB.prepare(
    'SELECT * FROM users WHERE line_user_id = ?'
  )
    .bind(lineUserId)
    .first();

  if (!user) {
    const userId = generateId();
    await env.DB.prepare(
      'INSERT INTO users (id, line_user_id, status) VALUES (?, ?, ?)'
    )
      .bind(userId, lineUserId, 'active')
      .run();
    user = { id: userId };
  }

  const userId = user.id as string;

  if (event.message?.type === 'text') {
    const textContent = event.message.text;

    // Save inbound message
    await env.DB.prepare(
      'INSERT INTO messages (id, user_id, direction, message_type, content, raw_json, sent_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))'
    )
      .bind(
        generateId(),
        userId,
        'inbound',
        'text',
        textContent,
        JSON.stringify(event)
      )
      .run();

    // Echo reply
    const replyMessages = [
      {
        type: 'text',
        text: textContent,
      },
    ];

    await sendReplyMessage(
      event.replyToken,
      replyMessages,
      env.LINE_CHANNEL_ACCESS_TOKEN
    );

    // Save outbound message
    await env.DB.prepare(
      'INSERT INTO messages (id, user_id, direction, message_type, content, sent_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
    )
      .bind(generateId(), userId, 'outbound', 'text', textContent)
      .run();
  }
}

async function handleFollowEvent(env: Env, event: any): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  const existing = await env.DB.prepare(
    'SELECT * FROM users WHERE line_user_id = ?'
  )
    .bind(lineUserId)
    .first();

  if (existing) {
    // Reactivate existing user
    await env.DB.prepare(
      'UPDATE users SET status = ?, updated_at = datetime(\'now\') WHERE line_user_id = ?'
    )
      .bind('active', lineUserId)
      .run();
  } else {
    // Create new user
    await env.DB.prepare(
      'INSERT INTO users (id, line_user_id, status, created_at, updated_at) VALUES (?, ?, ?, datetime(\'now\'), datetime(\'now\'))'
    )
      .bind(generateId(), lineUserId, 'active')
      .run();
  }
}

async function handleUnfollowEvent(env: Env, event: any): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  await env.DB.prepare(
    'UPDATE users SET status = ?, updated_at = datetime(\'now\') WHERE line_user_id = ?'
  )
    .bind('unfollowed', lineUserId)
    .run();
}
