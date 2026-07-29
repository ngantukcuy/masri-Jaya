import { Product } from '../../../types';
import { getSupabaseCache, setSupabaseCache } from '../../../lib/supabaseCache';

export interface CartItem {
  product: Product;
  quantity: number;
  selectedPriceType: 'retail' | 'wholesale' | 'project';
  notes: string;
}

export type PersistedPOSState = {
  cart: CartItem[];
  selectedCustomerId: string | null;
  discountMode: 'percent' | 'fixed';
  discountValue: number;
  paymentMethod: 'Cash' | 'QRIS' | 'Split' | 'Deposit';
  fulfillmentMethod: 'Pickup' | 'Delivery';
  deliveryAddress: string;
};

export const POS_CART_STORAGE_KEY = 'pos_cart_state';

const emptyState = (): PersistedPOSState => ({
  cart: [],
  selectedCustomerId: null,
  discountMode: 'percent',
  discountValue: 0,
  paymentMethod: 'Cash',
  fulfillmentMethod: 'Pickup',
  deliveryAddress: ''
});

export const readPersistedPOSState = (): PersistedPOSState => {
  const parsed = getSupabaseCache<Partial<PersistedPOSState>>(POS_CART_STORAGE_KEY, emptyState());
  return {
    cart: Array.isArray(parsed.cart) ? parsed.cart : [],
    selectedCustomerId: typeof parsed.selectedCustomerId === 'string' ? parsed.selectedCustomerId : null,
    discountMode: parsed.discountMode === 'fixed' ? 'fixed' : 'percent',
    discountValue: typeof parsed.discountValue === 'number' ? parsed.discountValue : 0,
    paymentMethod: parsed.paymentMethod === 'QRIS' || parsed.paymentMethod === 'Split' || parsed.paymentMethod === 'Deposit'
      ? parsed.paymentMethod
      : 'Cash',
    fulfillmentMethod: parsed.fulfillmentMethod === 'Delivery' ? 'Delivery' : 'Pickup',
    deliveryAddress: typeof parsed.deliveryAddress === 'string' ? parsed.deliveryAddress : ''
  };
};

export const writePersistedPOSState = (state: PersistedPOSState) => {
  setSupabaseCache(POS_CART_STORAGE_KEY, state);
};

export const clearPersistedPOSState = () => {
  setSupabaseCache(POS_CART_STORAGE_KEY, emptyState());
};
