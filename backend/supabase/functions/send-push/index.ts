/// <reference path="./editor-env.d.ts" />
// Supabase Edge Function: send-push
// Tokku POS Notification System v3
//
// Semua logika "kapan & apa isi notifikasi" sekarang ada di DATABASE
// (trigger di backend/supabase/security_notifications.sql yang menulis satu baris
// ke tabel `notification_events`). Function ini cuma:
//   1. menerima Database Webhook INSERT dari tabel `notification_events`,
//   2. mengambil token device (tabel `push_tokens`) yang role-nya termasuk
//      `record.roles`,
//   3. mengirimnya lewat FCM.
// Jadi cukup SATU webhook (tabel notification_events, event INSERT).
import { createClient } from "npm:@supabase/supabase-js@2";
import { createFcmSender, PushPayload } from "./fcm.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVICE_ACCOUNT_JSON = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Nilai role harus PERSIS sama dengan `StaffRole` di
// frontend/src/lib/permissions.ts ('Owner' | 'Admin' | 'Kasir' | 'Stoker').
async function loadTokens(roles: string[]) {
  const { data, error } = await supabase.from("push_tokens").select("token,role");
  if (error) throw error;
  return (data ?? [])
    .filter((row: any) => !!row?.role && roles.includes(row.role))
    .map((row: any) => row.token as string);
}

async function sendToRoles(payload: PushPayload, roles: string[]) {
  const tokens = await loadTokens(roles);
  if (tokens.length === 0) return { sent: 0, removed: 0 };

  const sender = await createFcmSender(FCM_SERVICE_ACCOUNT_JSON);
  let sent = 0;
  const stale: string[] = [];
  for (const token of tokens) {
    const result = await sender.send(token, payload);
    if (result.ok) sent++;
    if (result.shouldRemoveToken) stale.push(token);
  }
  if (stale.length > 0) {
    await supabase.from("push_tokens").delete().in("token", stale);
  }
  return { sent, removed: stale.length };
}

// PENTING: tanpa Deno.serve(...) function-nya "ada" tapi tidak pernah
// merespons request (termasuk dari Database Webhook).
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const webhook = await req.json();
    const record = webhook?.record;
    if (webhook?.type !== "INSERT" || webhook?.table !== "notification_events" || !record?.title) {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const roles: string[] = Array.isArray(record.roles) && record.roles.length > 0 ? record.roles : ["Owner"];
    const result = await sendToRoles(
      {
        title: String(record.title),
        body: String(record.body ?? ""),
        data: { kind: String(record.kind ?? ""), eventId: String(record.id ?? "") },
      },
      roles
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-push] Gagal memproses webhook:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
