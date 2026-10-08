// Jembatan ke plugin native Android `BluetoothPrinter`
// (android/app/src/main/java/com/masrijaya/pos/BluetoothPrinterPlugin.java).
//
// Dipakai HANYA saat app berjalan sebagai APK (Capacitor). WebView di APK
// tidak punya Web Bluetooth/WebUSB, jadi di sana koneksi printer harus lewat
// Android API asli (Bluetooth Classic / SPP) — yang juga jenis Bluetooth
// yang dipakai hampir semua printer thermal 58mm.

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativePairedDevice {
  name: string;
  address: string;
  /** Petunjuk dari Android: perangkat ini terdaftar sebagai printer. */
  isPrinter: boolean;
}

interface BluetoothPrinterPlugin {
  listPairedDevices(): Promise<{ devices: NativePairedDevice[] }>;
  connect(options: { address: string }): Promise<void>;
  write(options: { address: string; data: string }): Promise<void>;
  disconnect(options: { address: string }): Promise<void>;
  isConnected(options: { address: string }): Promise<{ connected: boolean }>;
  addListener(
    eventName: 'disconnected',
    listener: (event: { address: string }) => void
  ): Promise<PluginListenerHandle>;
}

const BluetoothPrinter = registerPlugin<BluetoothPrinterPlugin>('BluetoothPrinter');

/** True kalau app jalan di dalam APK/IPA (bukan browser biasa). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Plugin Bluetooth printer hanya ada di Android. */
export function isNativeBluetoothAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function listPairedBluetoothDevices(): Promise<NativePairedDevice[]> {
  const { devices } = await BluetoothPrinter.listPairedDevices();
  // Printer dulu, lalu urut abjad.
  return [...devices].sort((a, b) => Number(b.isPrinter) - Number(a.isPrinter) || a.name.localeCompare(b.name));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export async function connectNativeBluetooth(
  address: string,
  onDisconnect: () => void
): Promise<{ send: (bytes: Uint8Array) => Promise<void>; disconnect: () => void }> {
  await BluetoothPrinter.connect({ address });

  const listener = await BluetoothPrinter.addListener('disconnected', (event) => {
    if (event.address === address) onDisconnect();
  });

  const SEND_CHUNK = 2048;
  const send = async (bytes: Uint8Array) => {
    for (let i = 0; i < bytes.length; i += SEND_CHUNK) {
      await BluetoothPrinter.write({ address, data: bytesToBase64(bytes.subarray(i, i + SEND_CHUNK)) });
    }
  };

  const disconnect = () => {
    listener.remove().catch(() => {});
    BluetoothPrinter.disconnect({ address }).catch(() => {});
  };

  return { send, disconnect };
}
