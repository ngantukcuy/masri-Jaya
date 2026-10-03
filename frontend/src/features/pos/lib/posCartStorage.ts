import { Product } from '../../../types';
import { db, SINGLETON_ID, type PosCartDraft } from '../../../lib/db/repos';

export interface CartItem {
  product: Product;
  quantity: number;
  selectedPriceType: 'retail' | 'wholesale' | 'project';
  /**
   * Actual unit price the cashier will charge for this line, editable in
   * the cart between the product's Harga Minimum and Harga Standard. Falls
   * back to selectedPriceType-derived pricing when unset (older persisted
   * carts / invoices from before this field existed).
   */
  customPrice?: number;
  bonus?: boolean;
  notes: string;
}

export interface AdditionalFee {
  name: string;
  amount: number;
}

export type PersistedPOSState = {
  cart: CartItem[];
  selectedCustomerId: string | null;
  discountMode: 'percent' | 'fixed';
  discountValue: number;
  additionalFees: AdditionalFee[];
  /** Legacy single-fee fields kept for older persisted state compatibility. */
  additionalFeeName: string;
  additionalFee: number;
  paymentMethod: 'Cash' | 'QRIS' | 'Transfer' | 'Split' | 'Deposit' | 'Piutang';
  fulfillmentMethod: 'Pickup' | 'Delivery';
  deliveryAddress: string;
};

const emptyState = (): PersistedPOSState => ({
  cart: [],
  selectedCustomerId: null,
  discountMode: 'percent',
  discountValue: 0,
  additionalFees: [],
  additionalFeeName: '',
  additionalFee: 0,
  paymentMethod: 'Cash',
  fulfillmentMethod: 'Pickup',
  deliveryAddress: ''
});

// Draft keranjang kasir disimpan di tabel `pos_cart_drafts` (1 baris per pelanggan) +
// `pos_cart_items` (tiap barang di keranjang) + `pos_cart_fees` (biaya tambahan).
// Barang di keranjang cuma menyimpan SKU-nya; data produk lengkapnya diambil
// dari tabel `products` saat draft dibaca.
const draftIdForCustomer = (customerId: string) => `cart:${customerId}`;

export const readPersistedPOSState = (customerId: string): PersistedPOSState => {
  const drafts = db.posCartDrafts.snapshot();
  const draft = drafts.find((item) => item.id === draftIdForCustomer(customerId))
    ?? drafts.find((item) => item.id === SINGLETON_ID && item.selectedCustomerId === customerId);
  if (!draft) return emptyState();
  const products = db.products.snapshot();
  const cart: CartItem[] = draft.cart.flatMap((line) => {
    const product = products.find((p) => p.sku === line.productSku);
    if (!product) return []; // produk sudah dihapus dari master -> baris draft dibuang
    return [{
      product,
      quantity: line.quantity,
      selectedPriceType: line.selectedPriceType,
      customPrice: line.customPrice,
      bonus: line.bonus,
      notes: line.notes ?? '',
    }];
  });
  const additionalFees = draft.additionalFees.filter((fee) => fee.amount >= 0);
  const method = draft.paymentMethod;
  return {
    cart,
    selectedCustomerId: draft.selectedCustomerId ?? null,
    discountMode: draft.discountMode === 'fixed' ? 'fixed' : 'percent',
    discountValue: draft.discountValue ?? 0,
    additionalFees,
    additionalFeeName: draft.additionalFeeName ?? '',
    additionalFee: draft.additionalFee ?? 0,
    paymentMethod: method === 'QRIS' || method === 'Transfer' || method === 'Split' || method === 'Deposit' || method === 'Piutang'
      ? method
      : 'Cash',
    fulfillmentMethod: draft.fulfillmentMethod === 'Delivery' ? 'Delivery' : 'Pickup',
    deliveryAddress: draft.deliveryAddress ?? '',
  };
};

export const writePersistedPOSState = (state: PersistedPOSState) => {
  if (!state.selectedCustomerId) return;
  const draft: PosCartDraft = {
    id: draftIdForCustomer(state.selectedCustomerId),
    selectedCustomerId: state.selectedCustomerId ?? undefined,
    discountMode: state.discountMode,
    discountValue: state.discountValue,
    additionalFeeName: state.additionalFeeName,
    additionalFee: state.additionalFee,
    paymentMethod: state.paymentMethod,
    fulfillmentMethod: state.fulfillmentMethod,
    deliveryAddress: state.deliveryAddress,
    cart: state.cart.map((line) => ({
      productSku: line.product.sku,
      quantity: line.quantity,
      selectedPriceType: line.selectedPriceType,
      customPrice: line.customPrice,
      bonus: line.bonus,
      notes: line.notes,
    })),
    additionalFees: state.additionalFees,
  };
  void db.posCartDrafts.upsert([draft]);
};

export const clearPersistedPOSState = (customerId: string) => {
  const legacyDraft = db.posCartDrafts.snapshot().find(
    (draft) => draft.id === SINGLETON_ID && draft.selectedCustomerId === customerId
  );
  void db.posCartDrafts.remove([
    draftIdForCustomer(customerId),
    ...(legacyDraft ? [SINGLETON_ID] : []),
  ]);
};
