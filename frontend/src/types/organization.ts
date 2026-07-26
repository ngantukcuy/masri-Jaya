export interface Branch {
  name: string;
  location: string;
  manager: string;
  managerInitials: string;
  hwOk: number;
  hwError: number;
  address?: string;
  city?: string;
  branchCode?: string;
  phone?: string;
  postalCode?: string;
  receiptNote?: string;
  imageUrl?: string;
  allowNegativeStock?: boolean;
  showStockInDigital?: boolean;
  useDailyCash?: boolean;
  openingHours?: Record<string, { open: string; close: string; status: 'Open' | 'Closed' }>;
}

export interface StoreProfile {
  storeName: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxId?: string;
  receiptNote?: string;
  logoImageUrl?: string;
  pin?: string;
}

export interface StaffMember {
  id?: string;
  name: string;
  phone?: string;
  pin: string;
  role: 'Owner' | 'Admin' | 'Kasir' | 'Stoker';
  permissions: string[];
}

// A *saved* printer profile — name + how to reach it. The live connection
// itself (paired device, GATT/USB handle, connected/disconnected) is
// per-browser-tab runtime state, not stored here — see
// frontend/src/lib/printing/printerConnection.ts.
export interface Printer {
  id: string;
  name: string;
  connectionType: 'bluetooth' | 'usb';
}
