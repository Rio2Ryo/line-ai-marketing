import { Env } from '../types';

export async function callClaude(
  env: Env,
  systemPrompt: string,
  userMessage: string | Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens = 2000
): Promise<string> {
  const isFoundry = !!env.ANTHROPIC_RESOURCE;
  const apiUrl = isFoundry
    ? `https://${env.ANTHROPIC_RESOURCE}.services.ai.azure.com/anthropic/v1/messages`
    : 'https://api.anthropic.com/v1/messages';
  const modelName = isFoundry ? 'claude-opus-4-6' : 'claude-haiku-4-5-20251001';

  const messages = typeof userMessage === 'string'
    ? [{ role: 'user' as const, content: userMessage }]
    : userMessage;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (isFoundry) {
    headers['Authorization'] = `Bearer ${env.ANTHROPIC_API_KEY}`;
  } else {
    headers['x-api-key'] = env.ANTHROPIC_API_KEY;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelName,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} ${err}`);
  }
  const data = (await response.json()) as any;
  return data.content?.[0]?.text || '';
}

export function parseJsonSafe(text: string): any {
  let cleaned = text.trim();
  const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) cleaned = m[1].trim();
  return JSON.parse(cleaned);
}

export async function testClaudeConnection(env: Env): Promise<{
  ok: boolean;
  model: string;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await callClaude(env, 'Reply with exactly one word: OK', 'ping', 10);
    return {
      ok: true,
      model: env.ANTHROPIC_RESOURCE ? 'claude-opus-4-6 (Azure AI Foundry)' : 'claude-haiku-4-5',
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return {
      ok: false,
      model: env.ANTHROPIC_RESOURCE ? 'claude-opus-4-6 (Azure AI Foundry)' : 'claude-haiku-4-5',
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
