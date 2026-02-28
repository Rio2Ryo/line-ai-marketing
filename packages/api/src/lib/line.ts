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
