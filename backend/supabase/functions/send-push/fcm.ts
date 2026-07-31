// Helper buat kirim push notification lewat Firebase Cloud Messaging HTTP
// v1 API dari dalam Supabase Edge Function (Deno runtime).
//
// FCM v1 butuh access token OAuth2 (BUKAN "server key" lama yang sudah
// dimatikan Google Juni 2024), jadi kita generate sendiri lewat service
// account JSON: signing JWT pakai private key punya service account itu,
// lalu tukar ke Google buat dapat access token — semuanya pakai Web Crypto
// bawaan Deno, tanpa dependency tambahan.

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function base64UrlEncode(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64UrlEncode(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Gagal menukar JWT ke access token Google: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Kirim satu notifikasi ke satu token FCM device. Mengembalikan `false`
 * (tanpa throw) kalau tokennya sudah tidak valid lagi (device uninstall
 * app dsb) — supaya caller bisa hapus token itu dari database.
 */
export async function sendPushToToken(
  serviceAccount: ServiceAccount,
  accessToken: string,
  token: string,
  payload: PushPayload
): Promise<{ ok: boolean; shouldRemoveToken: boolean }> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data || {},
          android: { priority: 'high' },
        },
      }),
    }
  );

  if (res.ok) return { ok: true, shouldRemoveToken: false };

  const errText = await res.text();
  // UNREGISTERED / NOT_FOUND -> token basi, aman dihapus dari database.
  const shouldRemoveToken = res.status === 404 || /UNREGISTERED|NOT_FOUND/i.test(errText);
  console.error(`[send-push] Gagal kirim ke token ${token.slice(0, 12)}...: ${res.status} ${errText}`);
  return { ok: false, shouldRemoveToken };
}

export async function createFcmSender(serviceAccountJson: string) {
  const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);
  const accessToken = await getAccessToken(serviceAccount);
  return {
    send: (token: string, payload: PushPayload) => sendPushToToken(serviceAccount, accessToken, token, payload),
  };
}
