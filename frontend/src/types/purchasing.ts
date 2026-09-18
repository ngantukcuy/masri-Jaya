export interface POItem {
  name: string;
  sku: string;
  quantity: number;
  price: number;
  taxIncluded?: boolean;
  discountPerUnit?: number;
  totalDiscount?: number;
  locationId?: string;
}

export interface PO {
  poNumber: string;
  supplier: string;
  total: number;
  status: 'Draft' | 'Approved' | 'Ordered' | 'In Transit' | 'Received';
  items: POItem[];
  createdDate: string;
  logisticsNote: string;
  paymentMethod?: 'Cash' | 'Transfer' | 'Tempo';
  deliveryNoteNumber?: string;
  taxIncluded?: boolean;
  totalDiscount?: number;
  additionalCost?: number;
  additionalCostName?: string;
  receivedAt?: string;
}

export interface Supplier {
  name: string;
  rating: number;
  recentPO: string;
  debt: number;
  leadTimeStability: number;
  logoLetters: string;
  phone?: string;
  npwp?: string;
  address?: string;
  salesName?: string;
  salesPhone?: string;
  additionalSales?: { name: string; phone: string }[];
  topDays?: number;
}
