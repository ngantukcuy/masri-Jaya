// Real hardware connections to ESC/POS thermal receipt printers, using the
// two transports a browser can actually reach directly: Web Bluetooth and
// WebUSB. Both are Chrome/Edge/Opera-only (no Firefox/Safari) and require
// HTTPS or localhost — the browser will refuse to expose these APIs
// otherwise.
//
// A plain "connect by IP address" option (like the old mock UI had) is
// deliberately NOT offered: browsers cannot open a raw TCP socket to a
// printer on port 9100 the way a native app or a local print-server (e.g.
// QZ Tray) can — there's no web API for it. Bluetooth/USB are the two
// connection types that can genuinely work from a page like this one.
//
// IMPORTANT: a connection here lives in this browser tab's memory only —
// it is NOT saved to Supabase. Pairing a printer is inherently a per-device
// action (whichever computer/tablet is physically near the printer has to
// do its own pairing), so "Aktif"/"Offline" status is local, live hardware
// state, not synced app data.

export interface PrinterConnectionHandle {
  send: (bytes: Uint8Array) => Promise<void>;
  disconnect: () => void;
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export function isUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

// The most common service/characteristic UUIDs used by generic (often
// unbranded) 58mm/80mm ESC/POS Bluetooth LE thermal printers. Printer
// vendors don't all agree on one standard UUID, so a specific model may use
// a different pair — if connection succeeds but the service lookup below
// fails, that's what's going on (see the thrown error message).
const BLE_PRINT_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const BLE_PRINT_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';
// Bluetooth LE has a small per-write payload limit; chunk long print jobs.
const BLE_WRITE_CHUNK_SIZE = 180;

export async function connectBluetoothPrinter(
  onDisconnect: () => void
): Promise<{ handle: PrinterConnectionHandle; deviceName: string }> {
  if (!isBluetoothSupported()) {
    throw new Error('Browser ini tidak mendukung Web Bluetooth. Pakai Chrome/Edge terbaru di desktop atau Android.');
  }

  const nav = navigator as Navigator & { bluetooth: any };
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [BLE_PRINT_SERVICE_UUID],
  });

  const server = await device.gatt.connect();

  let characteristic;
  try {
    const service = await server.getPrimaryService(BLE_PRINT_SERVICE_UUID);
    characteristic = await service.getCharacteristic(BLE_PRINT_CHARACTERISTIC_UUID);
  } catch {
    device.gatt?.disconnect();
    throw new Error(
      `Printer berhasil dipasangkan tapi service cetak standar tidak ditemukan di device ini. Model printer kamu kemungkinan pakai UUID custom dari vendornya sendiri — cek manual printer untuk service/characteristic UUID yang benar.`
    );
  }

  device.addEventListener('gattserverdisconnected', onDisconnect);

  const send = async (bytes: Uint8Array) => {
    for (let i = 0; i < bytes.length; i += BLE_WRITE_CHUNK_SIZE) {
      await characteristic.writeValue(bytes.slice(i, i + BLE_WRITE_CHUNK_SIZE));
    }
  };

  const disconnect = () => {
    device.removeEventListener('gattserverdisconnected', onDisconnect);
    device.gatt?.disconnect();
  };

  return { handle: { send, disconnect }, deviceName: device.name || 'Printer Bluetooth' };
}

export async function connectUsbPrinter(
  onDisconnect: () => void
): Promise<{ handle: PrinterConnectionHandle; deviceName: string }> {
  if (!isUsbSupported()) {
    throw new Error('Browser ini tidak mendukung WebUSB. Pakai Chrome/Edge terbaru di desktop.');
  }

  const nav = navigator as Navigator & { usb: any };
  const device = await nav.usb.requestDevice({ filters: [] });

  await device.open();
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  // Find the first interface with a bulk OUT endpoint — that's the one
  // print data gets written to. USB descriptor layout varies by printer
  // model, so this is discovered rather than hardcoded.
  let interfaceNumber: number | null = null;
  let endpointNumber: number | null = null;
  for (const iface of device.configuration.interfaces) {
    for (const alt of iface.alternates) {
      const outEndpoint = alt.endpoints.find((e: any) => e.direction === 'out');
      if (outEndpoint) {
        interfaceNumber = iface.interfaceNumber;
        endpointNumber = outEndpoint.endpointNumber;
        break;
      }
    }
    if (interfaceNumber !== null) break;
  }

  if (interfaceNumber === null || endpointNumber === null) {
    await device.close().catch(() => {});
    throw new Error('Tidak menemukan endpoint output pada device USB ini — kemungkinan bukan printer, atau printer perlu driver khusus.');
  }

  await device.claimInterface(interfaceNumber);

  const handleDisconnect = (event: any) => {
    if (event.device === device) onDisconnect();
  };
  const nav2 = navigator as Navigator & { usb: any };
  nav2.usb.addEventListener('disconnect', handleDisconnect);

  const send = async (bytes: Uint8Array) => {
    await device.transferOut(endpointNumber, bytes);
  };

  const disconnect = () => {
    nav2.usb.removeEventListener('disconnect', handleDisconnect);
    device.close().catch(() => {});
  };

  return { handle: { send, disconnect }, deviceName: device.productName || 'Printer USB' };
}

// ---------------------------------------------------------------------------
// Global connection registry
//
// This app is a single-page app where switching tabs (Kasir <-> Pengaturan
// <-> Riwayat Transaksi) fully unmounts the previous view and mounts the new
// one (see App.tsx's renderActiveView, which keys each view on the current
// tab). A Bluetooth/USB handle kept only in a view's own React state — e.g. a
// `useState` inside SettingsView — is lost the instant the cashier leaves
// that tab, because nothing keeps a reference to the connected `device` /
// `characteristic` anymore. The connection isn't actually broken at the OS
// level, but from the app's point of view it might as well be: there is no
// longer any object to call `.send()` on.
//
// That's exactly what caused "connects fine, test print works, but printing
// a real receipt from Kasir/Riwayat Transaksi fails and the printer shows as
// disconnected again": Kasir and Riwayat Transaksi never had access to the
// handle created inside Pengaturan in the first place, and by the time you
// go back to Pengaturan to check, its state has reset to empty too.
//
// The fix is to keep connection handles in this module-level singleton
// instead of component state, so they survive navigating between tabs for as
// long as the browser tab/app itself stays open. Components subscribe to be
// notified when a connection is added or removed so they can re-render.

type PrinterConnectionsListener = (connections: Map<string, PrinterConnectionHandle>) => void;

const activeConnections = new Map<string, PrinterConnectionHandle>();
const listeners = new Set<PrinterConnectionsListener>();

function notifyListeners() {
  const snapshot = new Map(activeConnections);
  listeners.forEach((listener) => listener(snapshot));
}

/** Snapshot of every printer currently connected on this device. Safe to call anywhere, anytime. */
export function getPrinterConnections(): Map<string, PrinterConnectionHandle> {
  return new Map(activeConnections);
}

export function getPrinterConnection(printerId: string): PrinterConnectionHandle | undefined {
  return activeConnections.get(printerId);
}

export function isPrinterConnected(printerId: string): boolean {
  return activeConnections.has(printerId);
}

export function registerPrinterConnection(printerId: string, handle: PrinterConnectionHandle) {
  activeConnections.set(printerId, handle);
  notifyListeners();
}

export function removePrinterConnection(printerId: string) {
  if (activeConnections.delete(printerId)) {
    notifyListeners();
  }
}

/**
 * Lets a component re-render whenever a printer connects/disconnects
 * anywhere in the app (not just from within that component). Returns an
 * unsubscribe function — call it in a `useEffect` cleanup.
 */
export function subscribeToPrinterConnections(listener: PrinterConnectionsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
