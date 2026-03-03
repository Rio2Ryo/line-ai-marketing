'use client';

let liffObject: any = null;
let isInitialized = false;

export async function initLiff(): Promise<any> {
  if (isInitialized && liffObject) return liffObject;

  // Dynamically import LIFF SDK
  const liff = (await import('@line/liff')).default;

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || 'pending-setup';

  try {
    await liff.init({ liffId });
    isInitialized = true;
    liffObject = liff;

    if (!liff.isLoggedIn()) {
      liff.login();
      return null; // Will redirect
    }

    return liff;
  } catch (e) {
    console.error('LIFF init error:', e);
    throw e;
  }
}

export function getLiffToken(): string | null {
  if (!liffObject) return null;
  return liffObject.getAccessToken();
}

export async function liffFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getLiffToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';
  return fetch(`${apiUrl}${path}`, { ...options, headers });
}

export function getLiff(): any {
  return liffObject;
}

export function closeLiff(): void {
  if (liffObject && liffObject.isInClient()) {
    liffObject.closeWindow();
  }
}
