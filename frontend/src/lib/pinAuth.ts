// =============================================================================
// Login PIN — semuanya diperiksa di DATABASE (fungsi SQL di
// backend/supabase/security_notifications.sql), bukan di browser.
//   - PIN disimpan sebagai hash bcrypt di tabel yang tidak bisa dibaca aplikasi.
//   - 5x salah berturut-turut -> akun terkunci permanen (tanpa hitungan mundur)
//     sampai Owner membukanya, atau (untuk akun Owner) lewat link reset di email.
// =============================================================================
import { supabase } from './supabase';

export type PinStatus = 'ok' | 'wrong' | 'locked' | 'no_pin' | 'unknown' | 'forbidden' | 'invalid_pin' | 'error';

export interface PinResult {
  status: PinStatus;
  attemptsLeft?: number;
  name?: string;
  role?: string;
}

async function call(fn: string, args: Record<string, unknown>): Promise<PinResult> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`[pinAuth] ${fn} gagal:`, error);
    return { status: 'error' };
  }
  return data as PinResult;
}

/** Periksa PIN sebuah akun. Percobaan salah dihitung & dicatat di database. */
export const verifyLogin = (staffId: string, pin: string) =>
  call('verify_login', { p_staff_id: staffId, p_pin: pin });

/** Buka kunci akun staf. Wajib PIN Owner yang benar. */
export const unlockLogin = (ownerPin: string, targetId: string) =>
  call('unlock_login', { p_owner_pin: ownerPin, p_target_id: targetId });

/**
 * Atur / ganti PIN. Wajib PIN Owner (kecuali PIN pertama Owner saat registrasi
 * toko, atau akun yang memang belum punya PIN di toko yang belum punya Owner).
 */
export const setPin = (ownerPin: string | null, targetId: string, newPin: string) =>
  call('set_pin', { p_owner_pin: ownerPin, p_target_id: targetId, p_new_pin: newPin });

/** ID akun yang sedang terkunci. */
export async function getLockedStaff(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_locked_staff');
  if (error) {
    console.error('[pinAuth] get_locked_staff gagal:', error);
    return [];
  }
  return (data as string[] | null) ?? [];
}

/** Kirim link reset PIN ke email Owner (email toko). Link membawa Owner kembali ke aplikasi. */
export async function sendOwnerPinResetEmail(ownerEmail: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.auth.signInWithOtp({
    email: ownerEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}${window.location.pathname}?reset-pin=1`,
    },
  });
  return error ? { ok: false, message: error.message } : { ok: true };
}

/** Dipanggil setelah Owner membuka link di email (sesi sudah terverifikasi email). */
export const resetOwnerPinViaEmail = (newPin: string) =>
  call('reset_owner_pin_via_email', { p_new_pin: newPin });

/** "owner@gmail.com" -> "ow***@gmail.com" */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(3, name.length - 2))}@${domain}`;
}
