const LINE_API_BASE = 'https://api.line.me';

export async function verifySignature(
  body: string,
  signature: string,
  channelSecret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  );

  const expectedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  );

  return signature === expectedSignature;
}

export async function sendReplyMessage(
  replyToken: string,
  messages: unknown[],
  accessToken: string
): Promise<void> {
  const response = await fetch(`${LINE_API_BASE}/v2/bot/message/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Failed to send reply message:', response.status, errorBody);
    throw new Error(`LINE API error: ${response.status} ${errorBody}`);
  }
}

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export async function getProfile(accessToken: string): Promise<LineProfile> {
  const response = await fetch(`${LINE_API_BASE}/v2/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Failed to get profile:', response.status, errorBody);
    throw new Error(`LINE API error: ${response.status} ${errorBody}`);
  }

  return response.json() as Promise<LineProfile>;
}

export async function sendPushMessage(to: string, messages: unknown[], accessToken: string): Promise<void> {
  const maxRetries = 3;
  const baseBackoff = 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
      body: JSON.stringify({ to, messages }),
    });

    if (res.ok) return;

    // Rate limited (429) — backoff and retry
    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = res.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : baseBackoff * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, Math.min(waitMs, 30000)));
      continue;
    }

    // Server errors (5xx) — retry with backoff
    if (res.status >= 500 && attempt < maxRetries) {
      await new Promise(r => setTimeout(r, baseBackoff * Math.pow(2, attempt)));
      continue;
    }

    const err = await res.text();
    throw new Error('Push failed: ' + res.status + ' ' + err);
  }
}

export async function getUserProfile(userId: string, accessToken: string): Promise<LineProfile> {
  const res = await fetch('https://api.line.me/v2/bot/profile/' + userId, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Profile fetch failed: ' + res.status + ' ' + err);
  }
  return res.json() as Promise<LineProfile>;
}

export async function getMessageContent(messageId: string, accessToken: string): Promise<{ contentType: string; body: ReadableStream }> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Content fetch failed: ${res.status}`);
  }
  return {
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    body: res.body!,
  };
}
