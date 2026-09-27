import React, { useState, useRef } from 'react';
import { 
  Boxes, 
  AlertTriangle, 
  DollarSign, 
  Search, 
  SlidersHorizontal, 
  Download, 
  Printer, 
  Info,
  Warehouse,
  ChevronRight,
  Edit3,
  Trash2,
} from 'lucide-react';
import { Product, SkuLocation, Supplier, PO, SalesInvoice } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useSupabaseTable } from '../../lib/useSupabaseTable';
import { uploadProductImage } from '../../lib/uploadProductImage';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';
import Pagination, { PAGE_SIZE } from '../../components/shared/Pagination';
import BarcodeScannerModal from '../../components/shared/BarcodeScannerModal';
import { generateSkuCode } from '../../lib/generateSku';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import TransferStokView from './views/TransferStokView';
import IncomingStockView from './views/IncomingStockView';
import StokHubView from './views/StokHubView';
import StokPemasokView from './views/StokPemasokView';
import StockOpnameModal from './views/StockOpnameModal';
import CreateProductModal from './views/CreateProductModal';
import EditProductModal from './views/EditProductModal';

interface ProductCategory {
  id: string;
  name: string;
  level: 1 | 2 | 3;
}

interface ProductUnits {
  id: string;
  name: string;
  level: 1 | 2 | 3;
}

interface ProductsViewProps {
  products: Product[];
  onUpdateProducts: (updatedProducts: Product[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
  currentUserName?: string;
  currentUser?: CurrentUser;
  skuLocations?: SkuLocation[];
  suppliers?: Supplier[];
  onUpdateSuppliers?: (updatedSuppliers: Supplier[]) => void;
  pos?: PO[];
  onUpdatePOs: (updatedPOs: PO[]) => void;
  salesInvoices?: SalesInvoice[];
}

export interface IncomingProductForm {
  productSku: string;
  quantity: number;
  price: number;
  taxIncluded: boolean;
  discounts: { type: 'percent' | 'amount'; value: number }[];
  bonus: boolean;
  locationId: string;
}

export default function ProductsView({ products, onUpdateProducts, onAddActivity, currentUserName, currentUser, skuLocations = [], suppliers = [], onUpdateSuppliers, pos = [], onUpdatePOs, salesInvoices = [] }: ProductsViewProps) {
  const dialog = useDialog();
  const can = (key: string) => hasPermission(currentUser, key);
  // Halaman Stok dibuka dengan tampilan "hub" (kartu Pengaturan Stok +
  // panel Stok Menipis/Opname/Terlaris), sama seperti referensi desain.
  // Klik salah satu kartu akan pindah ke sub-tampilan terkait; tombol
  // "Kembali" di tiap sub-tampilan mengembalikan ke hub.
  const [stokView, setStokView] = useState<'hub' | 'list' | 'pemasok' | 'transfer' | 'incoming'>('hub');
  const [rightPanelTab, setRightPanelTab] = useState<'menipis' | 'opname' | 'terlaris' | 'baru-masuk'>('menipis');
  const [incomingTab, setIncomingTab] = useState<'masuk' | 'eceran'>('masuk');
  // Bon (PO) yang sedang dipreview isinya saat baris tabel Stok Supplier diklik.
  const [previewPO, setPreviewPO] = useState<PO | null>(null);
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [returnToIncomingPage, setReturnToIncomingPage] = useState(false);
  const [incomingStep, setIncomingStep] = useState<1 | 2>(1);
  const [incomingDate, setIncomingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [incomingPoNumber, setIncomingPoNumber] = useState('');
  const [incomingSupplier, setIncomingSupplier] = useState('');
  const [incomingPaymentMethod, setIncomingPaymentMethod] = useState<'Cash' | 'Transfer' | 'Tempo'>('Cash');
  const [incomingDueDate, setIncomingDueDate] = useState('');
  const [incomingDeliveryNote, setIncomingDeliveryNote] = useState('');
  const [incomingStatus, setIncomingStatus] = useState<'Received' | 'In Transit'>('Received');
  const [incomingItems, setIncomingItems] = useState<IncomingProductForm[]>([]);
  const [incomingAdditionalCosts, setIncomingAdditionalCosts] = useState<{ name: string; amount: number }[]>([]);
  const [incomingProductSearch, setIncomingProductSearch] = useState('');
  const [activeProductSearchIndex, setActiveProductSearchIndex] = useState<number | null>(null);
  const [openItemMenu, setOpenItemMenu] = useState<number | null>(null);

  // ---- PO Management di Stok Pemasok ----
  const canApprovePO = hasPermission(currentUser, 'manage_purchase_approve');
  const [filterPOSupplier, setFilterPOSupplier] = useState<string | null>(null);
  const [filterPODirect, setFilterPODirect] = useState<'all' | 'store' | 'customer'>('all');
  const [filterPOStatus, setFilterPOStatus] = useState<string>('all');
  const [searchPOQuery, setSearchPOQuery] = useState('');
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [showEditPOModal, setShowEditPOModal] = useState(false);
  const [editingPO, setEditingPO] = useState<PO | null>(null);

  // Form states untuk create PO
  const [newPOSupplier, setNewPOSupplier] = useState('');
  const [newPOItemName, setNewPOItemName] = useState('');
  const [newPOItemQuantity, setNewPOItemQuantity] = useState(10);
  const [newPOItemPrice, setNewPOItemPrice] = useState(100000);
  const [newPOLogistics, setNewPOLogistics] = useState('');
  const [newPODirectToCustomer, setNewPODirectToCustomer] = useState(false);
  const [newPODirectCustomerName, setNewPODirectCustomerName] = useState('');

  // Form states untuk edit PO
  const [editPOSupplier, setEditPOSupplier] = useState('');
  const [editPOItemName, setEditPOItemName] = useState('');
  const [editPOItemQuantity, setEditPOItemQuantity] = useState(10);
  const [editPOItemPrice, setEditPOItemPrice] = useState(100000);
  const [editPOLogistics, setEditPOLogistics] = useState('');
  const [editPODirectToCustomer, setEditPODirectToCustomer] = useState(false);
  const [editPODirectCustomerName, setEditPODirectCustomerName] = useState('');

  // ---- Transfer Stok: pindahkan lokasi gudang sebuah SKU ----
  const [transferSku, setTransferSku] = useState('');
  const [transferTargetLocationId, setTransferTargetLocationId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [selectedStatus, setSelectedStatus] = useState<string>('Semua');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  
  // CRUD states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states (shared by Create and Edit)
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formUnit, setFormUnit] = useState('Piece');
  const [formRetailPrice, setFormRetailPrice] = useState(0);
  const [formWholesalePrice, setFormWholesalePrice] = useState(0);
  const [formProjectPrice, setFormProjectPrice] = useState(0);
  const [formStock, setFormStock] = useState(0);
  const [formLocation, setFormLocation] = useState('');
  const [formImage, setFormImage] = useState('');
  // Field tambahan supaya form Edit Produk di halaman Stok sama persis
  // dengan form Tambah Barang (Produk Induk) di halaman SKU Master.
  const [formAlias, setFormAlias] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory2, setFormCategory2] = useState('');
  const [formCategory3, setFormCategory3] = useState('');
  const [formShowLowStockAlert, setFormShowLowStockAlert] = useState(false);
  const [formMinStockQty, setFormMinStockQty] = useState(0);
  const [formShowInDeadstock, setFormShowInDeadstock] = useState(false);
  const [formDeadstockPeriodMonths, setFormDeadstockPeriodMonths] = useState(3);
  const [showEditBarcodeScanner, setShowEditBarcodeScanner] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageUploadError(null);
    setImageUploading(true);
    try {
      const url = await uploadProductImage(file);
      setFormImage(url);
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : 'Gagal mengunggah gambar.');
    } finally {
      setImageUploading(false);
    }
  };

  // Adjustment states
  const [adjustProductSku, setAdjustProductSku] = useState('');
  const [adjustValue, setAdjustValue] = useState(10);
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustDirectApply, setAdjustDirectApply] = useState(false);

  // Scan kamera untuk isi field Kode SKU langsung (dipakai form Tambah Produk).
  const [showSkuScanner, setShowSkuScanner] = useState(false);

  const [opnameSubmissions, setOpnameSubmissions] = useSupabaseTable<any>('opname_submissions', [], (s) => s.id);
  const [productCategories] = useSupabaseTable<ProductCategory>('product_categories', [], (category) => category.id);
  const categoryNames = productCategories
    .slice()
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    .map((category) => category.name);
  const kategori1List = productCategories.filter((c) => c.level === 1);
  const kategori2List = productCategories.filter((c) => c.level === 2);
  const kategori3List = productCategories.filter((c) => c.level === 3);

  // Sama seperti brand di SKU Master (tabel 'product_brands' yang sama).
  const [productBrands] = useSupabaseTable<{ id: string; name: string }>('product_brands', [], (b) => b.id);

  // Unit names for the product unit dropdown
  const [productUnits] = useSupabaseTable<ProductUnits>('product_units', [], (unit) => unit.id);
  const unitNames = productUnits
  .slice()
  .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  .map((unit) => unit.name);

  const saveSubmissions = (subs: any[]) => {
    setOpnameSubmissions(subs);
  };

  const sortedProducts = [...products].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' })
  );

  // ---- Data turunan buat hub Stok ----
  const lowStockList = sortedProducts.filter((p) => p.stockStatus === 'Low Stock' || p.stockStatus === 'Out of Stock' || p.stock < 0);
  const pendingOpnameSkus = new Set(opnameSubmissions.filter((s) => s.status === 'Pending').map((s) => s.productSku));
  const sedangOpnameList = sortedProducts.filter((p) => pendingOpnameSkus.has(p.sku));
  const terlarisList = (() => {
    const now = new Date();
    const qtyBySku = new Map<string, number>();
    salesInvoices.forEach((inv) => {
      const t = inv.createdAt ? new Date(inv.createdAt) : null;
      if (!t || t.getMonth() !== now.getMonth() || t.getFullYear() !== now.getFullYear()) return;
      inv.items.forEach((item) => {
        qtyBySku.set(item.sku, (qtyBySku.get(item.sku) || 0) + item.quantity);
      });
    });
    return Array.from(qtyBySku.entries())
      .map(([sku, qty]) => ({ product: products.find((p) => p.sku === sku), qty }))
      .filter((x) => !!x.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 15) as { product: Product; qty: number }[];
  })();

  const receivedPOs = pos
    .filter((po) => po.status === 'Received' || po.status === 'In Transit' || po.receivedAt)
    .sort((a, b) => (b.receivedAt || b.createdDate).localeCompare(a.receivedAt || a.createdDate));
  const getItemDiscount = (item: IncomingProductForm) => {
    let currentPrice = Math.max(0, item.price);
    let totalDiscount = 0;
    item.discounts.forEach((discount) => {
      const discountAmount = discount.type === 'percent'
        ? currentPrice * Math.min(100, discount.value) / 100
        : discount.value;
      const appliedDiscount = Math.min(currentPrice, Math.max(0, discountAmount));
      totalDiscount += appliedDiscount;
      currentPrice -= appliedDiscount;
    });
    return totalDiscount;
  };
  const incomingTotalDiscount = incomingItems.reduce((sum, item) => sum + getItemDiscount(item) * item.quantity, 0);
  const incomingSubtotal = incomingItems.reduce((sum, item) => sum + (item.bonus ? 0 : Math.max(0, item.price - getItemDiscount(item)) * item.quantity), 0);
  const incomingAdditionalCost = incomingAdditionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const incomingTotal = Math.max(0, incomingSubtotal + incomingAdditionalCost);

  const openIncomingModal = () => {
    setIncomingDate(new Date().toISOString().slice(0, 10));
    setIncomingPoNumber(`PO-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setIncomingSupplier('');
    setIncomingPaymentMethod('Cash');
    setIncomingDueDate('');
    setIncomingDeliveryNote('');
    setIncomingStatus('Received');
    setIncomingItems([{ productSku: '', quantity: 1, price: 0, taxIncluded: false, discounts: [], bonus: false, locationId: '' }]);
    setIncomingAdditionalCosts([]);
    setIncomingProductSearch('');
    setActiveProductSearchIndex(null);
    setOpenItemMenu(null);
    setIncomingStep(1);
    setShowIncomingModal(true);
  };

  const updateIncomingItem = (index: number, changes: Partial<IncomingProductForm>) => {
    setIncomingItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  };

  const updateIncomingDiscount = (itemIndex: number, discountIndex: number, changes: Partial<IncomingProductForm['discounts'][number]>) => {
    setIncomingItems((items) => items.map((item, index) => index === itemIndex
      ? { ...item, discounts: item.discounts.map((discount, index) => index === discountIndex ? { ...discount, ...changes } : discount) }
      : item));
  };

  const handleSaveIncoming = (event: React.FormEvent) => {
    event.preventDefault();
    if (!incomingDate || !incomingPoNumber.trim() || !incomingSupplier || incomingItems.length === 0 || incomingItems.some((item) => !item.productSku || item.quantity <= 0)) {
      dialog.alert('Lengkapi tanggal, nomor PO, pemasok, dan minimal satu produk masuk.');
      return;
    }

    const poItems = incomingItems.map((item) => {
      const product = products.find((candidate) => candidate.sku === item.productSku);
      return {
        sku: item.productSku,
        name: product?.name || item.productSku,
        quantity: item.quantity,
        price: item.price,
        discountPerUnit: getItemDiscount(item),
        totalDiscount: getItemDiscount(item) * item.quantity,
        taxIncluded: item.taxIncluded,
        bonus: item.bonus,
        locationId: item.locationId,
      };
    });
    const newPO: PO = {
      poNumber: incomingPoNumber.trim(),
      supplier: incomingSupplier,
      items: poItems,
      total: incomingTotal,
      status: incomingStatus,
      createdDate: incomingDate,
      logisticsNote: incomingDeliveryNote || 'Penerimaan barang langsung dari pemasok',
      paymentMethod: incomingPaymentMethod,
      deliveryNoteNumber: incomingDeliveryNote,
      taxIncluded: incomingItems.some((item) => item.taxIncluded),
      totalDiscount: incomingTotalDiscount,
      additionalCost: incomingAdditionalCost,
      additionalCostName: incomingAdditionalCosts.map((cost) => cost.name).filter(Boolean).join(', '),
      dueDate: incomingPaymentMethod === 'Tempo' ? incomingDueDate : undefined,
      receivedAt: incomingStatus === 'Received' ? new Date().toISOString() : undefined,
    };

    onUpdatePOs([newPO, ...pos.filter((po) => po.poNumber !== newPO.poNumber)]);
    if (incomingStatus === 'Received') {
      const updatedProducts = products.map((product) => {
        const productItems = incomingItems.filter((item) => item.productSku === product.sku);
        if (productItems.length === 0) return product;
        const addedQuantity = productItems.reduce((sum, item) => sum + item.quantity, 0);
        const selectedLocation = productItems.map((item) => skuLocations.find((location) => location.id === item.locationId)?.name).find(Boolean);
        const nextStock = product.stock + addedQuantity;
        return {
          ...product,
          stock: nextStock,
          stockStatus: nextStock > 15 ? 'Healthy' as const : 'Low Stock' as const,
          lastRestock: new Date().toISOString(),
          lastRestockQty: addedQuantity,
          ...(selectedLocation ? { warehouseLocation: selectedLocation } : {}),
        };
      });
      onUpdateProducts(updatedProducts);
    }
    onAddActivity(`Produk Masuk: ${newPO.poNumber}`, `${poItems.length} jenis produk dari ${incomingSupplier}`, incomingTotal, 'arrival');
    setShowIncomingModal(false);
    if (returnToIncomingPage) {
      setReturnToIncomingPage(false);
      setStokView('incoming');
    }
    dialog.alert(`Produk masuk ${newPO.poNumber} berhasil disimpan.`);
  };

  // ---- Handlers untuk PO di Stok Pemasok ----
  const handleApprovePO = (po: PO) => {
    if (po.status !== 'Draft') return;
    if (!canApprovePO) {
      dialog.alert('Anda tidak memiliki izin untuk menyetujui pesanan pembelian ini. Hubungi Owner atau Admin.');
      return;
    }
    const updated = pos.map((p) => (p.poNumber === po.poNumber ? { ...p, status: 'Ordered' as const } : p));
    onUpdatePOs(updated);
    onAddActivity(
      `PO Disetujui: ${po.poNumber}`,
      `Disetujui oleh ${currentUser?.name || 'staf'} — supplier ${po.supplier}`,
      po.total,
      'quote'
    );
    dialog.alert(`Nomor PO ${po.poNumber} disetujui! Status diperbarui ke Dipesan.`);
  };

  const handleReceiveGoodsPO = async (po: PO) => {
    if (po.status !== 'Ordered' && po.status !== 'In Transit') return;

    const confirmMsg = po.directToCustomer
      ? `Konfirmasi penerimaan PO ${po.poNumber}?\n\n🚚 PERHATIAN: Pesanan ini dikirim LANGSUNG KE CUSTOMER${po.directToCustomerName ? ` (${po.directToCustomerName})` : ''}.\nBarang TIDAK AKAN ditambahkan ke stok gudang toko. Tagihan supplier sebesar Rp ${po.total.toLocaleString('id-ID')} akan dicatat.`
      : `Konfirmasi penerimaan barang untuk PO ${po.poNumber}?\nMaterial akan ditambahkan ke stok gudang toko dan tagihan supplier akan dicatat.`;

    const ok = await dialog.confirm(confirmMsg);
    if (!ok) return;

    // Transition status to Received
    const updatedPOs = pos.map((p) => {
      if (p.poNumber === po.poNumber) {
        return { 
          ...p, 
          status: 'Received' as const,
          receivedAt: new Date().toISOString()
        };
      }
      return p;
    });
    onUpdatePOs(updatedPOs);

    // If direct to customer: SKIP stock update, only update supplier debt!
    if (po.directToCustomer) {
      if (onUpdateSuppliers && suppliers) {
        const updatedSuppliers = suppliers.map((s) =>
          s.name === po.supplier
            ? { ...s, debt: s.debt + po.total, recentPO: po.poNumber }
            : s
        );
        onUpdateSuppliers(updatedSuppliers);
      }

      onAddActivity(
        `PO Selesai (Langsung ke Customer): ${po.poNumber}`,
        `Material dari ${po.supplier} langsung dikirim ke customer ${po.directToCustomerName ? `(${po.directToCustomerName})` : ''} tanpa singgah di toko. Tagihan Rp ${po.total.toLocaleString('id-ID')} dicatat.`,
        po.total,
        'arrival'
      );

      dialog.alert(`Penerimaan PO ${po.poNumber} berhasil! Barang langsung diantar ke customer. Stok toko tidak bertambah, tagihan supplier telah dicatat.`);
    } else {
      // Normal PO: Update product stock and supplier debt
      const updatedProducts = [...products];
      po.items.forEach((item) => {
        const match = updatedProducts.find(
          (p) => p.name.toLowerCase().includes(item.name.toLowerCase()) || 
                 item.name.toLowerCase().includes(p.name.toLowerCase())
        );
        if (match) {
          match.stock += item.quantity;
          match.stockStatus = match.stock > 15 ? 'Healthy' : 'Low Stock';
          match.lastRestock = new Date().toISOString();
          match.lastRestockQty = item.quantity;
        }
      });
      onUpdateProducts(updatedProducts);

      if (onUpdateSuppliers && suppliers) {
        const updatedSuppliers = suppliers.map((s) =>
          s.name === po.supplier
            ? { ...s, debt: s.debt + po.total, recentPO: po.poNumber }
            : s
        );
        onUpdateSuppliers(updatedSuppliers);
      }

      onAddActivity(
        `Penerimaan Barang PO: ${po.poNumber}`,
        `Menambah ${po.items.reduce((acc, i) => acc + i.quantity, 0)} unit bahan bangunan dari ${po.supplier} ke stok gudang`,
        0,
        'arrival'
      );

      dialog.alert(`Barang untuk nomor PO ${po.poNumber} berhasil diterima! Stok fisik di gudang telah bertambah.`);
    }
  };

  const handleDeletePO = async (po: PO) => {
    const ok = await dialog.confirm(`Apakah Anda yakin ingin membatalkan & menghapus Pesanan Pembelian ${po.poNumber}?`);
    if (!ok) return;

    const updated = pos.filter((p) => p.poNumber !== po.poNumber);
    onUpdatePOs(updated);

    onAddActivity(
      `PO Dibatalkan: ${po.poNumber}`,
      `Membatalkan nomor transaksi PO ${po.poNumber}`,
      0,
      'overdue'
    );

    dialog.alert(`Pesanan Pembelian ${po.poNumber} berhasil dihapus.`);
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPOItemName.trim()) {
      dialog.alert('Silakan masukkan nama material pesanan!');
      return;
    }
    if (!newPOSupplier) {
      dialog.alert('Silakan pilih supplier terlebih dahulu!');
      return;
    }

    const nextPoNum = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPO: PO = {
      poNumber: nextPoNum,
      supplier: newPOSupplier,
      items: [{
        sku: `SKU-PO-${Math.floor(100 + Math.random() * 900)}`,
        name: newPOItemName.trim(),
        quantity: Number(newPOItemQuantity),
        price: Number(newPOItemPrice)
      }],
      total: Number(newPOItemQuantity) * Number(newPOItemPrice),
      status: 'Draft',
      createdDate: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
      logisticsNote: newPOLogistics || (newPODirectToCustomer ? `Langsung ke Customer: ${newPODirectCustomerName || '-'}` : 'Pengiriman armada toko'),
      directToCustomer: newPODirectToCustomer,
      directToCustomerName: newPODirectToCustomer ? newPODirectCustomerName.trim() : undefined,
    };

    onUpdatePOs([newPO, ...pos]);
    setShowCreatePOModal(false);

    onAddActivity(
      `Draft PO Dibuat: ${nextPoNum}`,
      `Supplier ${newPOSupplier} ${newPODirectToCustomer ? '(Langsung ke Customer)' : ''} — Total Rp ${newPO.total.toLocaleString('id-ID')}`,
      newPO.total,
      'quote',
      'approvers'
    );

    // Reset
    setNewPOSupplier('');
    setNewPOItemName('');
    setNewPOItemQuantity(10);
    setNewPOItemPrice(100000);
    setNewPOLogistics('');
    setNewPODirectToCustomer(false);
    setNewPODirectCustomerName('');

    dialog.alert(`Draft PO ${nextPoNum} berhasil dibuat! Silakan setujui pesanan agar dapat diproses ke supplier.`);
  };

  const handleOpenEditPOModal = (po: PO) => {
    setEditingPO(po);
    setEditPOSupplier(po.supplier);
    setEditPOItemName(po.items[0]?.name || '');
    setEditPOItemQuantity(po.items[0]?.quantity || 1);
    setEditPOItemPrice(po.items[0]?.price || 100000);
    setEditPOLogistics(po.logisticsNote || '');
    setEditPODirectToCustomer(!!po.directToCustomer);
    setEditPODirectCustomerName(po.directToCustomerName || '');
    setShowEditPOModal(true);
  };

  const handleEditPOSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPO) return;
    if (!editPOItemName.trim()) {
      dialog.alert('Silakan masukkan nama material pesanan!');
      return;
    }

    const updated = pos.map((p) => {
      if (p.poNumber === editingPO.poNumber) {
        const updatedItems = [{
          sku: p.items[0]?.sku || `SKU-PO-${Math.floor(100 + Math.random() * 900)}`,
          name: editPOItemName.trim(),
          quantity: Number(editPOItemQuantity),
          price: Number(editPOItemPrice)
        }];
        const nextPO: PO = {
          ...p,
          supplier: editPOSupplier,
          items: updatedItems,
          total: Number(editPOItemQuantity) * Number(editPOItemPrice),
          logisticsNote: editPOLogistics,
          directToCustomer: editPODirectToCustomer,
          directToCustomerName: editPODirectToCustomer ? editPODirectCustomerName.trim() : undefined,
        };
        return nextPO;
      }
      return p;
    });

    onUpdatePOs(updated);
    setShowEditPOModal(false);
    setEditingPO(null);

    onAddActivity(
      `Pembaruan PO: ${editingPO.poNumber}`,
      `Rincian pengadaan supplier ${editPOSupplier} diperbarui`,
      Number(editPOItemQuantity) * Number(editPOItemPrice),
      'quote'
    );

    dialog.alert(`Pesanan Pembelian ${editingPO.poNumber} berhasil diperbarui!`);
  };

  const handleTransferStock = () => {
    const prod = products.find((p) => p.sku === transferSku);
    const targetLoc = skuLocations.find((l) => l.id === transferTargetLocationId);
    if (!prod || !targetLoc) {
      dialog.alert('Pilih produk dan lokasi tujuan terlebih dahulu.');
      return;
    }
    if (prod.skuLocationId === targetLoc.id) {
      dialog.alert('Produk ini sudah berada di lokasi tersebut.');
      return;
    }
    const fromName = prod.warehouseLocation || '-';
    const updated = products.map((p) =>
      p.sku === transferSku ? { ...p, warehouseLocation: targetLoc.name, skuLocationId: targetLoc.id } : p
    );
    onUpdateProducts(updated);
    onAddActivity(
      'Transfer Stok Lokasi SKU',
      `${prod.name} (${prod.sku}) dipindah dari ${fromName} ke ${targetLoc.name}`,
      0,
      'arrival'
    );
    dialog.alert(`Berhasil memindahkan "${prod.name}" ke lokasi ${targetLoc.name}.`);
    setTransferSku('');
    setTransferTargetLocationId('');
  };

  const categories = ['Semua', ...categoryNames];

  // Filters logic
  const filteredProducts = sortedProducts.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          prod.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    // category filter
    const matchesCategory = selectedCategory === 'Semua' || prod.category === selectedCategory;
    
    // status filter
    let matchesStatus = true;
    if (selectedStatus !== 'Semua') {
      const statusEng = selectedStatus === 'Aman' ? 'Healthy' : selectedStatus === 'Kritis' ? 'Low Stock' : 'Out of Stock';
      matchesStatus = prod.stockStatus === statusEng;
    }
    
    return matchesSearch && matchesCategory && matchesStatus;
  });
  const pageCount = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const safePage = Math.min(currentPage, Math.max(1, pageCount));
  const paginatedProducts = filteredProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Calculate stock metrics
  const totalStockValue = products.reduce((acc, p) => acc + (p.stock * p.retailPrice), 0);
  const lowStockCount = products.filter(p => p.stockStatus === 'Low Stock' || p.stock === 0).length;

  // Export the currently filtered stock list to a real .xlsx file the
  // browser downloads directly — no server round-trip needed.
  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');

    const statusLabel = (s: Product['stockStatus']) =>
      s === 'Healthy' ? 'Stok Aman' : s === 'Low Stock' ? 'Stok Rendah' : 'Stok Habis';

    const rows = filteredProducts.map((p) => ({
      'Nama Material': p.name,
      'Kode SKU': p.sku,
      'Kategori': p.category,
      'Unit': p.unit,
      'Harga Eceran': p.retailPrice,
      'Harga Grosir': p.wholesalePrice,
      'Harga Proyek': p.projectPrice,
      'Stok Fisik': p.stock,
      'Status': statusLabel(p.stockStatus),
      'Lokasi': (p as any).location || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 8 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stok');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Laporan_Stok_${dateStr}.xlsx`);
  };

  // Open a clean, print-only view of the current stock list in a new tab
  // and trigger the browser's native print dialog.
  const handlePrintStock = () => {
    const statusLabel = (s: Product['stockStatus']) =>
      s === 'Healthy' ? 'Stok Aman' : s === 'Low Stock' ? 'Stok Rendah' : 'Stok Habis';

    const rowsHtml = filteredProducts.map((p) => `
      <tr>
        <td>${p.name}</td>
        <td>${p.sku}</td>
        <td>${p.category}</td>
        <td style="text-align:right">Rp ${p.retailPrice.toLocaleString('id-ID')}</td>
        <td style="text-align:center">${p.stock} ${p.unit}</td>
        <td style="text-align:center">${statusLabel(p.stockStatus)}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      dialog.alert('Popup diblokir oleh browser. Izinkan popup untuk mencetak laporan stok.');
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>Laporan Stok - ${new Date().toLocaleDateString('id-ID')}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111827; }
            h1 { font-size: 18px; margin-bottom: 2px; }
            p.meta { font-size: 11px; color: #6b7280; margin-top: 0; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; }
            th { background: #f3f4f6; text-align: left; text-transform: uppercase; font-size: 10px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Laporan Stok Barang</h1>
          <p class="meta">Dicetak pada ${new Date().toLocaleString('id-ID')} &middot; ${filteredProducts.length} item</p>
          <table>
            <thead>
              <tr>
                <th>Nama Material</th>
                <th>Kode SKU</th>
                <th>Kategori</th>
                <th style="text-align:right">Harga</th>
                <th style="text-align:center">Stok</th>
                <th style="text-align:center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="6" style="text-align:center">Tidak ada data</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
    };
    // Fallback in case onload doesn't fire (already-loaded blank doc in some browsers)
    setTimeout(() => {
      try { printWindow.print(); } catch { /* ignore */ }
    }, 400);
  };

  const handleExecuteAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.sku === adjustProductSku);
    if (!prod) return;

    if (adjustDirectApply) {
      // Direct Apply (Manager role bypass)
      const diff = adjustType === 'add' ? adjustValue : -adjustValue;
      const nextStock = Math.max(0, prod.stock + diff);

      const updated = products.map((p) => {
        if (p.sku === adjustProductSku) {
          let nextStatus: 'Healthy' | 'Low Stock' | 'Out of Stock' = 'Healthy';
          if (nextStock === 0) nextStatus = 'Out of Stock';
          else if (nextStock <= 15) nextStatus = 'Low Stock';
          
          return {
            ...p,
            stock: nextStock,
            stockStatus: nextStatus
          };
        }
        return p;
      });

      onUpdateProducts(updated);
      setShowAdjustmentModal(false);
      setAdjustNotes('');
      setAdjustDirectApply(false);

      // Update details side view if active
      if (selectedProduct?.sku === adjustProductSku) {
        const match = updated.find(p => p.sku === adjustProductSku);
        if (match) setSelectedProduct(match);
      }

      onAddActivity(
        `Penyesuaian Stok Gudang`,
        `SKU ${prod.sku} disesuaikan ${diff > 0 ? '+' : ''}${diff} unit (${prod.unit})`,
        0,
        'arrival'
      );

      dialog.alert(`Berhasil menyelesaikan penyesuaian stok langsung untuk SKU ${prod.sku}. Stok baru: ${nextStock} ${prod.unit}`);
    } else {
      // Submit for Approval (Standard Staff workflow)
      const nextId = `OPN-${Math.floor(1000 + Math.random() * 9000)}`;
      const newSubmission = {
        id: nextId,
        productSku: prod.sku,
        productName: prod.name,
        type: adjustType,
        amount: adjustValue,
        notes: adjustNotes || "Pemeriksaan stok berkala",
        submittedBy: currentUserName || "Staff Aktif",
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        status: 'Pending' as const
      };

      const updatedSubmissions = [newSubmission, ...opnameSubmissions];
      saveSubmissions(updatedSubmissions);
      setShowAdjustmentModal(false);
      setAdjustNotes('');

      onAddActivity(
        `Pengajuan Opname Baru`,
        `SKU ${prod.sku} diajukan ${adjustType === 'add' ? '+' : '-'}${adjustValue} unit oleh Staff`,
        0,
        'quote',
        'approvers'
      );

      dialog.alert(`Pengajuan Stock Opname "${prod.name}" berhasil dikirim ke manajer! Status: MENUNGGU PERSETUJUAN (ID: ${nextId})`);
    }
  };

  const handleApproveOpname = (subId: string) => {
    if (!can('manage_opname_approve')) {
      dialog.alert("Anda tidak memiliki izin untuk menyetujui Stock Opname. Hubungi Owner/Admin.");
      return;
    }
    const sub = opnameSubmissions.find(s => s.id === subId);
    if (!sub) return;

    const prod = products.find(p => p.sku === sub.productSku);
    if (!prod) {
      dialog.alert("Produk tidak ditemukan atau sudah dihapus!");
      return;
    }

    const diff = sub.type === 'add' ? sub.amount : -sub.amount;
    const nextStock = Math.max(0, prod.stock + diff);

    const updated = products.map((p) => {
      if (p.sku === sub.productSku) {
        let nextStatus: 'Healthy' | 'Low Stock' | 'Out of Stock' = 'Healthy';
        if (nextStock === 0) nextStatus = 'Out of Stock';
        else if (nextStock <= 15) nextStatus = 'Low Stock';
        
        return {
          ...p,
          stock: nextStock,
          stockStatus: nextStatus
        };
      }
      return p;
    });

    onUpdateProducts(updated);

    // Update submission status
    const updatedSubs = opnameSubmissions.map((s) => {
      if (s.id === subId) {
        return { ...s, status: 'Approved' as const };
      }
      return s;
    });
    saveSubmissions(updatedSubs);

    // Update active details view
    if (selectedProduct?.sku === sub.productSku) {
      const match = updated.find(p => p.sku === sub.productSku);
      if (match) setSelectedProduct(match);
    }

    onAddActivity(
      `Persetujuan Opname Berhasil`,
      `Opname SKU ${sub.productSku} disetujui: ${diff > 0 ? '+' : ''}${diff} unit`,
      0,
      'arrival'
    );

    dialog.alert(`Pengajuan opname ${subId} disetujui! Stok material "${prod.name}" berhasil disesuaikan.`);
  };

  const handleRejectOpname = (subId: string) => {
    if (!can('manage_opname_approve')) {
      dialog.alert("Anda tidak memiliki izin untuk menolak Stock Opname. Hubungi Owner/Admin.");
      return;
    }
    const updatedSubs = opnameSubmissions.map((s) => {
      if (s.id === subId) {
        return { ...s, status: 'Rejected' as const };
      }
      return s;
    });
    saveSubmissions(updatedSubs);

    onAddActivity(
      `Permintaan Opname Ditolak`,
      `Pengajuan penyesuaian stock opname ${subId} ditolak oleh Manajer`,
      0,
      'overdue'
    );

    dialog.alert(`Pengajuan opname ${subId} berhasil ditolak. Saldo stok aman tidak berubah.`);
  };

  const handleQuickRestock = (prod: Product) => {
    const updated = products.map((p) => {
      if (p.sku === prod.sku) {
        return { ...p, stock: p.stock + 50, stockStatus: 'Healthy' as const };
      }
      return p;
    });
    onUpdateProducts(updated);
    
    // Update active details
    const match = updated.find(p => p.sku === prod.sku);
    if (match) setSelectedProduct(match);

    onAddActivity(
      `Restock Cepat Berhasil`,
      `Menambah 50 unit ke ${prod.name}`,
      0,
      'arrival'
    );

    dialog.alert(`Berhasil menambah 50 unit untuk ${prod.name}. Status stok diperbarui ke Aman.`);
  };

  const openCreateProductModal = () => {
    // Sebelumnya field-field di sini diisi data CONTOH (harga Rp50.000,
    // stok 100, lokasi "Section B - Row 01", foto placeholder) — kelihatan
    // kaya form udah keisi otomatis padahal itu cuma angka bawaan demo,
    // bukan data produk yang mau ditambahkan. Kalau admin nggak sadar dan
    // nggak ganti semua field, produk baru malah kesimpen dengan harga/
    // stok/lokasi ngasal. Sekarang beneran kosong/nol, cuma Kode SKU yang
    // di-generate otomatis (karena itu memang harus unik per produk).
    setFormName('');
    setFormSku(generateSkuCode());
    setFormCategory(categoryNames[0] || '');
    setFormUnit('Sack');
    setFormRetailPrice(0);
    setFormWholesalePrice(0);
    setFormProjectPrice(0);
    setFormStock(0);
    setFormLocation('');
    setFormImage('');
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    setFormName(prod.name);
    setFormSku(prod.sku);
    setFormCategory(prod.category1 || prod.category);
    setFormCategory2(prod.category2 || '');
    setFormCategory3(prod.category3 || '');
    setFormUnit(prod.unit);
    setFormRetailPrice(prod.retailPrice);
    setFormWholesalePrice(prod.wholesalePrice);
    setFormProjectPrice(prod.projectPrice);
    setFormStock(prod.stock);
    setFormLocation(prod.warehouseLocation || (prod as any).location || '');
    setFormImage(prod.image || '');
    // Field yang sebelumnya tidak ikut dimuat saat Edit Produk — jadi kalau
    // produk ini punya data ini (mis. dibuat dari SKU Master), tidak hilang
    // begitu form dibuka, dan sekarang juga bisa diubah dari sini.
    setFormAlias(prod.alias || '');
    setFormSupplier(prod.supplier || '');
    setFormBrand(prod.brand || '');
    setFormBarcode(prod.barcode || '');
    setFormShowLowStockAlert(!!prod.showLowStockAlert);
    setFormMinStockQty(prod.minStockQty || 0);
    setFormShowInDeadstock(!!prod.showInDeadstock);
    setFormDeadstockPeriodMonths(prod.deadstockPeriodMonths || 3);
    setShowEditModal(true);
  };

  const handleDeleteProduct = async (prod: Product) => {
    const ok = await dialog.confirm(`Apakah Anda yakin ingin menghapus produk "${prod.name}" (${prod.sku})?`);
    if (!ok) return;

    const updated = products.filter(p => p.sku !== prod.sku);
    onUpdateProducts(updated);
    setSelectedProduct(null);

    onAddActivity(
      `Produk Dihapus`,
      `Menghapus SKU ${prod.sku} - ${prod.name} dari sistem`,
      0,
      'overdue'
    );

    dialog.alert(`Produk "${prod.name}" berhasil dihapus.`);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSku.trim()) {
      dialog.alert("Nama dan SKU produk wajib diisi!");
      return;
    }
    if (!formCategory) {
      dialog.alert("Kategori produk wajib dipilih!");
      return;
    }

    // Check duplicate SKU
    if (products.some(p => p.sku.toLowerCase() === formSku.trim().toLowerCase())) {
      dialog.alert(`Error: Kode SKU "${formSku}" sudah digunakan oleh produk lain!`);
      return;
    }

    let status: 'Healthy' | 'Low Stock' | 'Out of Stock' = 'Healthy';
    if (formStock === 0) status = 'Out of Stock';
    else if (formStock <= 15) status = 'Low Stock';

    const newProd: Product = {
      name: formName.trim(),
      sku: formSku.trim(),
      supplier: formSupplier.trim(),
      category: formCategory,
      unit: formUnit,
      retailPrice: Number(formRetailPrice),
      wholesalePrice: Number(formWholesalePrice),
      projectPrice: Number(formProjectPrice),
      stock: Number(formStock),
      stockStatus: status,
      lastRestock: new Date().toISOString().split('T')[0],
      leadTime: '3-5 Days',
      warehouseLocation: formLocation,
      image: formImage
    };

    onUpdateProducts([newProd, ...products]);
    setShowCreateModal(false);

    onAddActivity(
      `Pendaftaran Produk Baru`,
      `SKU ${newProd.sku} - ${newProd.name} berhasil didaftarkan`,
      0,
      'arrival'
    );

    dialog.alert(`Produk baru "${newProd.name}" berhasil ditambahkan!`);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      dialog.alert("Nama produk wajib diisi!");
      return;
    }
    if (!formCategory) {
      dialog.alert("Kategori produk wajib dipilih!");
      return;
    }

    let status: 'Healthy' | 'Low Stock' | 'Out of Stock' = 'Healthy';
    if (formStock === 0) status = 'Out of Stock';
    else if (formStock <= 15) status = 'Low Stock';

    const updated = products.map((p) => {
      if (p.sku === formSku) {
        const nextProd = {
          ...p,
          name: formName.trim(),
          category: formCategory,
          category1: formCategory,
          category2: formCategory2,
          category3: formCategory3,
          unit: formUnit,
          // "Harga Modal/Standard/Minimum" di sini sama seperti "Harga Modal /
          // Jual Standard / Jual Minimum" di SKU Master — ditulis ke kedua
          // nama field (lama & baru) supaya perhitungan untung di tempat lain
          // yang membaca costPrice/standardSellPrice/minSellPrice tetap akurat.
          retailPrice: Number(formRetailPrice),
          wholesalePrice: Number(formWholesalePrice),
          projectPrice: Number(formProjectPrice),
          costPrice: Number(formRetailPrice),
          standardSellPrice: Number(formWholesalePrice),
          minSellPrice: Number(formProjectPrice),
          stock: Number(formStock),
          stockStatus: status,
          warehouseLocation: formLocation,
          image: formImage,
          alias: formAlias.trim(),
          supplier: formSupplier.trim(),
          brand: formBrand,
          barcode: formBarcode,
          showLowStockAlert: formShowLowStockAlert,
          minStockQty: Number(formMinStockQty),
          showInDeadstock: formShowInDeadstock,
          deadstockPeriodMonths: Number(formDeadstockPeriodMonths),
        };
        // Also update selectedProduct
        setSelectedProduct(nextProd);
        return nextProd;
      }
      return p;
    });

    onUpdateProducts(updated);
    setShowEditModal(false);

    onAddActivity(
      `Pembaruan Informasi Produk`,
      `Informasi material SKU ${formSku} berhasil diperbarui`,
      0,
      'quote'
    );

    dialog.alert(`Informasi produk "${formName}" berhasil diperbarui!`);
  };

  const pendingOpnameCount = opnameSubmissions.filter((s) => s.status === 'Pending').length;

  if (stokView === 'incoming') {
    return (
      <IncomingStockView
        products={products}
        sortedProducts={sortedProducts}
        receivedPOs={receivedPOs}
        incomingTab={incomingTab}
        setIncomingTab={setIncomingTab}
        previewPO={previewPO}
        setPreviewPO={setPreviewPO}
        onBack={() => setStokView('hub')}
        onTambahProdukMasuk={() => { setReturnToIncomingPage(true); setStokView('hub'); setRightPanelTab('baru-masuk'); openIncomingModal(); }}
      />
    );
  }

  if (stokView === 'hub') {
    return (
      <StokHubView
        setStokView={setStokView}
        can={can}
        dialog={dialog}
        pos={pos}
        pendingOpnameCount={pendingOpnameCount}
        rightPanelTab={rightPanelTab}
        setRightPanelTab={setRightPanelTab}
        lowStockList={lowStockList}
        sedangOpnameList={sedangOpnameList}
        terlarisList={terlarisList}
        incomingTab={incomingTab}
        setIncomingTab={setIncomingTab}
        openIncomingModal={openIncomingModal}
        products={products}
        sortedProducts={sortedProducts}
        receivedPOs={receivedPOs}
        previewPO={previewPO}
        setPreviewPO={setPreviewPO}
        showAdjustmentModal={showAdjustmentModal}
        setShowAdjustmentModal={setShowAdjustmentModal}
        showIncomingModal={showIncomingModal}
        onIncomingOpenChange={(open) => {
          setShowIncomingModal(open);
          if (!open && returnToIncomingPage) {
            setReturnToIncomingPage(false);
            setStokView('incoming');
          }
        }}
        suppliers={suppliers}
        skuLocations={skuLocations}
        incomingStep={incomingStep}
        setIncomingStep={setIncomingStep}
        handleSaveIncoming={handleSaveIncoming}
        incomingDate={incomingDate}
        setIncomingDate={setIncomingDate}
        incomingPoNumber={incomingPoNumber}
        setIncomingPoNumber={setIncomingPoNumber}
        incomingSupplier={incomingSupplier}
        setIncomingSupplier={setIncomingSupplier}
        incomingPaymentMethod={incomingPaymentMethod}
        setIncomingPaymentMethod={setIncomingPaymentMethod}
        incomingDueDate={incomingDueDate}
        setIncomingDueDate={setIncomingDueDate}
        incomingDeliveryNote={incomingDeliveryNote}
        setIncomingDeliveryNote={setIncomingDeliveryNote}
        incomingStatus={incomingStatus}
        setIncomingStatus={setIncomingStatus}
        incomingItems={incomingItems}
        setIncomingItems={setIncomingItems}
        getItemDiscount={getItemDiscount}
        updateIncomingItem={updateIncomingItem}
        updateIncomingDiscount={updateIncomingDiscount}
        openItemMenu={openItemMenu}
        setOpenItemMenu={setOpenItemMenu}
        activeProductSearchIndex={activeProductSearchIndex}
        setActiveProductSearchIndex={setActiveProductSearchIndex}
        incomingProductSearch={incomingProductSearch}
        setIncomingProductSearch={setIncomingProductSearch}
        incomingAdditionalCosts={incomingAdditionalCosts}
        setIncomingAdditionalCosts={setIncomingAdditionalCosts}
        incomingAdditionalCost={incomingAdditionalCost}
        incomingTotal={incomingTotal}
        adjustProductSku={adjustProductSku}
        setAdjustProductSku={setAdjustProductSku}
        adjustType={adjustType}
        setAdjustType={setAdjustType}
        adjustValue={adjustValue}
        setAdjustValue={setAdjustValue}
        adjustNotes={adjustNotes}
        setAdjustNotes={setAdjustNotes}
        adjustDirectApply={adjustDirectApply}
        setAdjustDirectApply={setAdjustDirectApply}
        handleExecuteAdjustment={handleExecuteAdjustment}
      />
    );
  }

  if (stokView === 'pemasok') {
    return (
      <StokPemasokView
        pos={pos}
        products={products}
        suppliers={suppliers}
        previewPO={previewPO}
        setPreviewPO={setPreviewPO}
        onBack={() => setStokView('hub')}
        filterPOSupplier={filterPOSupplier}
        setFilterPOSupplier={setFilterPOSupplier}
        filterPODirect={filterPODirect}
        setFilterPODirect={setFilterPODirect}
        filterPOStatus={filterPOStatus}
        setFilterPOStatus={setFilterPOStatus}
        searchPOQuery={searchPOQuery}
        setSearchPOQuery={setSearchPOQuery}
        showCreatePOModal={showCreatePOModal}
        setShowCreatePOModal={setShowCreatePOModal}
        showEditPOModal={showEditPOModal}
        setShowEditPOModal={setShowEditPOModal}
        editingPO={editingPO}
        newPOSupplier={newPOSupplier}
        setNewPOSupplier={setNewPOSupplier}
        newPOItemName={newPOItemName}
        setNewPOItemName={setNewPOItemName}
        newPOItemQuantity={newPOItemQuantity}
        setNewPOItemQuantity={setNewPOItemQuantity}
        newPOItemPrice={newPOItemPrice}
        setNewPOItemPrice={setNewPOItemPrice}
        newPOLogistics={newPOLogistics}
        setNewPOLogistics={setNewPOLogistics}
        newPODirectToCustomer={newPODirectToCustomer}
        setNewPODirectToCustomer={setNewPODirectToCustomer}
        newPODirectCustomerName={newPODirectCustomerName}
        setNewPODirectCustomerName={setNewPODirectCustomerName}
        editPOSupplier={editPOSupplier}
        setEditPOSupplier={setEditPOSupplier}
        editPOItemName={editPOItemName}
        setEditPOItemName={setEditPOItemName}
        editPOItemQuantity={editPOItemQuantity}
        setEditPOItemQuantity={setEditPOItemQuantity}
        editPOItemPrice={editPOItemPrice}
        setEditPOItemPrice={setEditPOItemPrice}
        editPOLogistics={editPOLogistics}
        setEditPOLogistics={setEditPOLogistics}
        editPODirectToCustomer={editPODirectToCustomer}
        setEditPODirectToCustomer={setEditPODirectToCustomer}
        editPODirectCustomerName={editPODirectCustomerName}
        setEditPODirectCustomerName={setEditPODirectCustomerName}
        handleApprovePO={handleApprovePO}
        handleReceiveGoodsPO={handleReceiveGoodsPO}
        handleDeletePO={handleDeletePO}
        handleCreatePO={handleCreatePO}
        handleOpenEditPOModal={handleOpenEditPOModal}
        handleEditPOSubmit={handleEditPOSubmit}
      />
    );
  }

  if (stokView === 'transfer') {
    return (
      <TransferStokView
        products={products}
        sortedProducts={sortedProducts}
        skuLocations={skuLocations}
        transferSku={transferSku}
        setTransferSku={setTransferSku}
        transferTargetLocationId={transferTargetLocationId}
        setTransferTargetLocationId={setTransferTargetLocationId}
        handleTransferStock={handleTransferStock}
        onBack={() => setStokView('hub')}
      />
    );
  }


  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => setStokView('hub')} className="text-muted-foreground -ml-2">
        <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Kembali ke Stok
      </Button>
      {/* Title Header
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
       
        <div className="flex gap-2">
          {can('manage_product_add') && (
          <Button onClick={openCreateProductModal} size="lg">
            <Plus className="w-4 h-4" />
            <span>Tambah Produk Baru</span>
          </Button>
          )}
          {can('manage_product_update') && (
          <Button onClick={() => setShowAdjustmentModal(true)} size="lg" className="bg-gray-900 hover:bg-gray-800">
            <Plus className="w-3.5 h-3.5" />
            <span>Penyesuaian Stok Manual</span>
          </Button>
          )}
        </div>
      </div>
       */}

      {/* Product Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="p-4 flex-row items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase">TOTAL JENIS SKU</p>
            <h4 className="text-lg font-black text-foreground mt-0.5">{products.length} Material</h4>
          </div>
        </Card>

        <Card className="p-4 flex-row items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase">ESTIMASI NILAI INVENTORI</p>
            <h4 className="text-lg font-black text-foreground mt-0.5">Rp {totalStockValue.toLocaleString('id-ID')}</h4>
          </div>
        </Card>

        <Card className="p-4 flex-row items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase">STOK KRITIS / HABIS</p>
            <h4 className="text-lg font-black text-foreground mt-0.5">{lowStockCount} SKU Perlu Restock</h4>
          </div>
        </Card>
      </div>

      {/* Pending Stock Opname Approvals */}
      {opnameSubmissions.some((s) => s.status === 'Pending') && (
        <Card className="border-amber-200 p-0 gap-0 overflow-hidden">
          <div className="bg-amber-50 px-4 py-3 flex items-center justify-between border-b border-amber-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-800">Pengajuan Stock Opname Menunggu Persetujuan</h3>
            </div>
            <Badge variant="warning">{opnameSubmissions.filter((s) => s.status === 'Pending').length} Pending</Badge>
          </div>
          <div className="divide-y divide-border">
            {opnameSubmissions.filter((s) => s.status === 'Pending').map((sub) => (
              <div key={sub.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 text-xs">
                  <p className="font-bold text-foreground/80">
                    {sub.productName} <span className="text-muted-foreground font-normal">({sub.productSku})</span>
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {sub.type === 'add' ? 'Tambah' : 'Kurangi'} <span className="font-bold">{sub.amount}</span> unit &middot; diajukan oleh {sub.submittedBy} &middot; {sub.date}
                  </p>
                  {sub.notes && <p className="text-muted-foreground mt-0.5 italic">"{sub.notes}"</p>}
                </div>
                {can('manage_opname_approve') ? (
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleRejectOpname(sub.id)} className="flex-1 sm:flex-none uppercase">
                      Tolak
                    </Button>
                    <Button size="sm" onClick={() => handleApproveOpname(sub.id)} className="flex-1 sm:flex-none uppercase bg-emerald-600 hover:bg-emerald-700">
                      Setujui
                    </Button>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic shrink-0">Menunggu persetujuan Owner/Admin.</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Materials Filter and List */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Filter bars and search */}
          <Card className="flex flex-col sm:flex-row gap-3 items-center justify-between p-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari SKU, nama produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 border-none bg-muted"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto top-20" > 
              <Button
                variant={showFiltersDrawer ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
                className={showFiltersDrawer ? 'bg-primary/10 text-primary hover:bg-primary/15 shadow-none' : ''}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filter</span>
              </Button>

              <Button variant="outline" size="icon" onClick={handleExportExcel} title="Ekspor ke Excel (.xlsx)">
                <Download className="w-4 h-4 top-5" />
              </Button>

              <Button variant="outline" size="icon" onClick={handlePrintStock} title="Cetak Laporan Stok">
                <Printer className="w-4 h-4 top-5" />
              </Button>
            </div>
          </Card>

          {/* Quick Filters Drawer */}
          <AnimatePresence>
            {showFiltersDrawer && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <Label>Pilih Kategori</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Semua">Semua Kategori</SelectItem>
                        {categories.filter(c => c !== 'Semua').map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Status Persediaan</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Semua">Semua Status</SelectItem>
                        <SelectItem value="Aman">Stok Aman (Healthy)</SelectItem>
                        <SelectItem value="Kritis">Stok Rendah (Low Stock)</SelectItem>
                        <SelectItem value="Habis">Stok Habis (Out of Stock)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Materials Table list */}
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nama Material</TableHead>
                  <TableHead>Kode SKU</TableHead>
                  <TableHead className="text-right">Harga Standard</TableHead>
                  <TableHead className="text-center">Stok Fisik</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground font-bold">Tidak ada bahan bangunan yang cocok dengan filter.</TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((prod) => (
                    <TableRow
                      key={prod.sku}
                      onClick={() => setSelectedProduct(prod)}
                      className={`cursor-pointer ${selectedProduct?.sku === prod.sku ? 'bg-primary/5 hover:bg-primary/5' : ''}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img 
                            src={prod.image} 
                            alt={prod.name}
                            className="w-8 h-8 rounded-lg object-cover border border-border"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <p className="font-extrabold text-foreground/80 line-clamp-1">{prod.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{prod.category}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-medium text-muted-foreground">{prod.sku}</TableCell>
                      <TableCell className="text-right font-bold text-foreground">Rp {prod.wholesalePrice.toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-center font-black text-foreground/80">
                        {prod.stock} <span className="text-[10px] font-bold text-muted-foreground">{prod.unit}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={prod.stockStatus === 'Healthy' ? 'success' : prod.stockStatus === 'Low Stock' ? 'warning' : 'destructive'}>
                          {prod.stockStatus === 'Healthy' ? 'AMAN' : prod.stockStatus === 'Low Stock' ? 'KRITIS' : 'HABIS'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination page={safePage} pageCount={pageCount} onPageChange={setCurrentPage} />
          </Card>
        </div>

        {/* Right Side: Material Detail Panel */}
        <Card className="lg:col-span-4 p-5 space-y-5">
          {selectedProduct ? (
            <div className="space-y-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3">
                  <img 
                    src={selectedProduct.image} 
                    alt={selectedProduct.name}
                    className="w-16 h-16 rounded-xl object-cover border border-border"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="font-black text-sm text-foreground leading-snug">{selectedProduct.name}</h4>
                    <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">{selectedProduct.sku}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedProduct(null)} className="h-7 w-7 rounded-full">✕</Button>
              </div>

              {/* Action and quick restocks */}
              <div className="pt-2 border-t border-border space-y-2">
                {can('manage_product_update') && (
                  <Button
                    variant="secondary"
                    onClick={() => handleQuickRestock(selectedProduct)}
                    className="w-full bg-primary/10 hover:bg-primary/15 text-primary uppercase"
                  >
                    <Warehouse className="w-3.5 h-3.5" />
                    <span>Restock Cepat (+50)</span>
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {can('manage_product_update') && (
                    <Button
                      variant="secondary"
                      onClick={() => handleOpenEditModal(selectedProduct)}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-700 uppercase"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Produk</span>
                    </Button>
                  )}
                  {can('manage_product_delete') && (
                    <Button
                      variant="secondary"
                      onClick={() => handleDeleteProduct(selectedProduct)}
                      className="bg-red-50 hover:bg-red-100 text-red-700 uppercase"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Price list sheets */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest block">Skema Daftar Harga Bertingkat</span>
                <div className="divide-y divide-border border border-border rounded-xl bg-muted/40 p-1">
                  <div className="flex justify-between p-2">
                    <span className="text-muted-foreground font-medium">Harga Modal</span>
                    <span className="font-extrabold text-foreground">Rp {selectedProduct.retailPrice.toLocaleString('id-ID')} / {selectedProduct.unit}</span>
                  </div>
                  <div className="flex justify-between p-2">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">Harga Standard <Info className="w-3.5 h-3.5 text-primary" /></span>
                    <span className="font-extrabold text-foreground">Rp {selectedProduct.wholesalePrice.toLocaleString('id-ID')} / {selectedProduct.unit}</span>
                  </div>
                  <div className="flex justify-between p-2">
                    <span className="text-muted-foreground font-medium">Harga Minimum</span>
                    <span className="font-extrabold text-foreground">Rp {selectedProduct.projectPrice.toLocaleString('id-ID')} / {selectedProduct.unit}</span>
                  </div>
                </div>
              </div>

              {/* Additional Specifications */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest block">Spesifikasi Detail Material</span>
                <div className="p-3.5 border border-border rounded-xl space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gudang / Lokasi Rak</span>
                    <span className="font-bold text-foreground/80 uppercase">{selectedProduct.warehouseLocation || (selectedProduct as any).location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kategori Bahan</span>
                    <span className="font-bold text-foreground/80">{selectedProduct.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pemasok Utama</span>
                    <span className="font-bold text-primary underline cursor-pointer">{selectedProduct.supplier || 'Tidak tersedia'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stok Pengaman Minimum</span>
                    <span className="font-bold text-foreground/80">15 {selectedProduct.unit}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Boxes className="w-8 h-8 text-muted-foreground/60 mb-1" />
              <p className="font-bold text-xs uppercase tracking-wider text-foreground/70">Detail Bahan Bangunan</p>
              <p className="text-[10px] text-muted-foreground mt-1 max-w-[180px]">Pilih salah satu material dari daftar sebelah kiri untuk meninjau data harga atau stok.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Manual Stock Adjustment Modal */}
      <StockOpnameModal
        showAdjustmentModal={showAdjustmentModal}
        setShowAdjustmentModal={setShowAdjustmentModal}
        sortedProducts={products}
        handleExecuteAdjustment={handleExecuteAdjustment}
        adjustProductSku={adjustProductSku}
        setAdjustProductSku={setAdjustProductSku}
        adjustType={adjustType}
        setAdjustType={setAdjustType}
        adjustValue={adjustValue}
        setAdjustValue={setAdjustValue}
        adjustNotes={adjustNotes}
        setAdjustNotes={setAdjustNotes}
        adjustDirectApply={adjustDirectApply}
        setAdjustDirectApply={setAdjustDirectApply}
      />

      <CreateProductModal
        showCreateModal={showCreateModal}
        setShowCreateModal={setShowCreateModal}
        handleCreateSubmit={handleCreateSubmit}
        generateSkuCode={generateSkuCode}
        setShowSkuScanner={setShowSkuScanner}
        categoryNames={categoryNames}
        unitNames={unitNames}
        formName={formName}
        setFormName={setFormName}
        formSku={formSku}
        setFormSku={setFormSku}
        formCategory={formCategory}
        setFormCategory={setFormCategory}
        formUnit={formUnit}
        setFormUnit={setFormUnit}
        formRetailPrice={formRetailPrice}
        setFormRetailPrice={setFormRetailPrice}
        formWholesalePrice={formWholesalePrice}
        setFormWholesalePrice={setFormWholesalePrice}
        formProjectPrice={formProjectPrice}
        setFormProjectPrice={setFormProjectPrice}
        formStock={formStock}
        setFormStock={setFormStock}
        formLocation={formLocation}
        setFormLocation={setFormLocation}
        formImage={formImage}
        setFormImage={setFormImage}
        imageUploading={imageUploading}
        imageUploadError={imageUploadError}
        imageFileInputRef={imageFileInputRef}
        handleImageFileSelect={handleImageFileSelect}
      />

      <EditProductModal
        showEditModal={showEditModal}
        setShowEditModal={setShowEditModal}
        handleEditSubmit={handleEditSubmit}
        suppliers={suppliers}
        productBrands={productBrands}
        unitNames={unitNames}
        kategori1List={kategori1List}
        kategori2List={kategori2List}
        kategori3List={kategori3List}
        skuLocations={skuLocations}
        formAlias={formAlias}
        setFormAlias={setFormAlias}
        formSku={formSku}
        formName={formName}
        setFormName={setFormName}
        formSupplier={formSupplier}
        setFormSupplier={setFormSupplier}
        formBrand={formBrand}
        setFormBrand={setFormBrand}
        formUnit={formUnit}
        setFormUnit={setFormUnit}
        formShowLowStockAlert={formShowLowStockAlert}
        setFormShowLowStockAlert={setFormShowLowStockAlert}
        formMinStockQty={formMinStockQty}
        setFormMinStockQty={setFormMinStockQty}
        formShowInDeadstock={formShowInDeadstock}
        setFormShowInDeadstock={setFormShowInDeadstock}
        formDeadstockPeriodMonths={formDeadstockPeriodMonths}
        setFormDeadstockPeriodMonths={setFormDeadstockPeriodMonths}
        formCategory={formCategory}
        setFormCategory={setFormCategory}
        formCategory2={formCategory2}
        setFormCategory2={setFormCategory2}
        formCategory3={formCategory3}
        setFormCategory3={setFormCategory3}
        formRetailPrice={formRetailPrice}
        setFormRetailPrice={setFormRetailPrice}
        formWholesalePrice={formWholesalePrice}
        setFormWholesalePrice={setFormWholesalePrice}
        formProjectPrice={formProjectPrice}
        setFormProjectPrice={setFormProjectPrice}
        formStock={formStock}
        setFormStock={setFormStock}
        formLocation={formLocation}
        setFormLocation={setFormLocation}
        formImage={formImage}
        setFormImage={setFormImage}
        imageUploading={imageUploading}
        imageUploadError={imageUploadError}
        imageFileInputRef={imageFileInputRef}
        handleImageFileSelect={handleImageFileSelect}
      />

      {showEditBarcodeScanner && (
        <BarcodeScannerModal
          title="Scan Barcode"
          onClose={() => setShowEditBarcodeScanner(false)}
          onDetected={(code) => {
            setFormBarcode(code);
            setShowEditBarcodeScanner(false);
          }}
        />
      )}

      {showSkuScanner && (
        <BarcodeScannerModal
          title="Scan Kode SKU"
          onClose={() => setShowSkuScanner(false)}
          onDetected={(code) => {
            setFormSku(code);
            setShowSkuScanner(false);
          }}
        />
      )}
    </div>
  );
}
