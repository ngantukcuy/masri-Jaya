import React, { useState, useRef } from 'react';
import { 
  Boxes, 
  AlertTriangle, 
  DollarSign, 
  Search, 
  SlidersHorizontal, 
  Download, 
  Printer, 
  Plus, 
  Info,
  Warehouse,
  ChevronRight,
  Edit3,
  Trash2,
  Upload,
  Loader2,
  ScanLine,
  RefreshCw,
  CheckCircle2,
  Truck,
  MoreVertical,
  Percent,
  Settings2,
  CalendarDays
} from 'lucide-react';
import { Product, SkuLocation, Supplier, PO, SalesInvoice } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useSupabaseTable } from '../../lib/useSupabaseTable';
import { uploadProductImage } from '../../lib/uploadProductImage';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';
import NumberInput from '../../components/shared/NumberInput';
import Pagination, { PAGE_SIZE } from '../../components/shared/Pagination';
import BarcodeScannerModal from '../../components/shared/BarcodeScannerModal';
import { generateSkuCode } from '../../lib/generateSku';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';

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
  pos?: PO[];
  onUpdatePOs: (updatedPOs: PO[]) => void;
  salesInvoices?: SalesInvoice[];
}

interface IncomingProductForm {
  productSku: string;
  quantity: number;
  price: number;
  taxIncluded: boolean;
  discounts: { type: 'percent' | 'amount'; value: number }[];
  bonus: boolean;
  locationId: string;
}

export default function ProductsView({ products, onUpdateProducts, onAddActivity, currentUserName, currentUser, skuLocations = [], suppliers = [], pos = [], onUpdatePOs, salesInvoices = [] }: ProductsViewProps) {
  const dialog = useDialog();
  const can = (key: string) => hasPermission(currentUser, key);
  // Halaman Stok dibuka dengan tampilan "hub" (kartu Pengaturan Stok +
  // panel Stok Menipis/Opname/Terlaris), sama seperti referensi desain.
  // Klik salah satu kartu akan pindah ke sub-tampilan terkait; tombol
  // "Kembali" di tiap sub-tampilan mengembalikan ke hub.
  const [stokView, setStokView] = useState<'hub' | 'list' | 'pemasok' | 'transfer' | 'incoming'>('hub');
  const [rightPanelTab, setRightPanelTab] = useState<'menipis' | 'opname' | 'terlaris' | 'baru-masuk'>('menipis');
  const [incomingTab, setIncomingTab] = useState<'masuk' | 'eceran'>('masuk');
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
  const [formLocation, setFormLocation] = useState('Section A - Row 01');
  const [formImage, setFormImage] = useState('');
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
  const [adjustProductSku, setAdjustProductSku] = useState(products[0]?.sku || '');
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

  // Unit names for the product unit dropdown
  const [productUnits] = useSupabaseTable<ProductUnits>('product_units', [], (unit) => unit.id);
  const unitNames = productUnits
  .slice()
  .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  .map((unit) => unit.name);

  React.useEffect(() => {
    if (!formCategory && categoryNames.length > 0) setFormCategory(categoryNames[0]);
  }, [categoryNames, formCategory]);

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

  // ---- Stok Baru Masuk: produk yang barangnya baru diterima dari
  // pemasok (via Purchasing > Konfirmasi Barang Diterima) dalam 3 hari
  // terakhir, terbaru duluan.
  const baruMasukList = sortedProducts
    .filter((p) => {
      if (!p.lastRestockQty || !p.lastRestock) return false;
      const t = new Date(p.lastRestock).getTime();
      if (Number.isNaN(t)) return false;
      return Date.now() - t <= 3 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(b.lastRestock).getTime() - new Date(a.lastRestock).getTime());

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
    setIncomingSupplier(suppliers[0]?.name || '');
    setIncomingPaymentMethod('Cash');
    setIncomingDueDate('');
    setIncomingDeliveryNote('');
    setIncomingStatus('Received');
    setIncomingItems([{ productSku: products[0]?.sku || '', quantity: 1, price: products[0]?.costPrice ?? products[0]?.retailPrice ?? 0, taxIncluded: false, discounts: [], bonus: false, locationId: products[0]?.skuLocationId || '' }]);
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

  // ---- Rekap Stok Pemasok: total nilai & item PO yang masih di pemasok
  // (belum berstatus "Received") per pemasok. ----
  const pemasokStockRecap = suppliers.map((s) => {
    const openPOs = pos.filter((po) => po.supplier === s.name && po.status !== 'Received');
    const totalValue = openPOs.reduce((acc, po) => acc + po.total, 0);
    const totalItems = openPOs.reduce((acc, po) => acc + po.items.reduce((a, i) => a + i.quantity, 0), 0);
    return { supplier: s, openPOs, totalValue, totalItems };
  }).filter((r) => r.openPOs.length > 0);

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
    setFormCategory(prod.category);
    setFormUnit(prod.unit);
    setFormRetailPrice(prod.retailPrice);
    setFormWholesalePrice(prod.wholesalePrice);
    setFormProjectPrice(prod.projectPrice);
    setFormStock(prod.stock);
    setFormLocation(prod.warehouseLocation || (prod as any).location || 'Section A - Row 01');
    setFormImage(prod.image || 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=150');
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

    let status: 'Healthy' | 'Low Stock' | 'Out of Stock' = 'Healthy';
    if (formStock === 0) status = 'Out of Stock';
    else if (formStock <= 15) status = 'Low Stock';

    const updated = products.map((p) => {
      if (p.sku === formSku) {
        const nextProd = {
          ...p,
          name: formName.trim(),
          category: formCategory,
          unit: formUnit,
          retailPrice: Number(formRetailPrice),
          wholesalePrice: Number(formWholesalePrice),
          projectPrice: Number(formProjectPrice),
          stock: Number(formStock),
          stockStatus: status,
          warehouseLocation: formLocation,
          image: formImage
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
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setStokView('hub')} className="text-muted-foreground -ml-2">
          <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Kembali ke Stok
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-foreground">Stok Supplier</h2>
            <p className="text-xs text-muted-foreground">Kelola produk masuk, harga eceran, dan stok aktual.</p>
          </div>
          {incomingTab === 'masuk' && (
            <Button onClick={() => { setReturnToIncomingPage(true); setStokView('hub'); setRightPanelTab('baru-masuk'); openIncomingModal(); }} disabled={products.length === 0}>
              <Plus className="w-4 h-4" /> Tambah Produk Masuk
            </Button>
          )}
        </div>
        <Card className="p-0 overflow-hidden">
          <Tabs value={incomingTab} onValueChange={(value) => setIncomingTab(value as typeof incomingTab)}>
            <TabsList className="px-5 pt-4 bg-transparent rounded-none h-auto">
              <TabsTrigger value="masuk">Produk Masuk</TabsTrigger>
              <TabsTrigger value="eceran">Produk Eceran</TabsTrigger>
            </TabsList>
            <TabsContent value="masuk" className="p-5 mt-0">
              <div className="overflow-x-auto border border-border rounded-lg">
                <Table className="min-w-[850px]"><TableHeader><TableRow className="bg-muted/40">
                  <TableHead>Tgl</TableHead><TableHead>Nomor PO</TableHead><TableHead className="text-right">Total Pembelian</TableHead><TableHead>Status</TableHead><TableHead>Pemasok</TableHead><TableHead>Metode Bayar</TableHead><TableHead>No. Surat Jalan</TableHead>
                </TableRow></TableHeader><TableBody>
                  {receivedPOs.length === 0 ? <TableRow><TableCell colSpan={7} className="p-8 text-center text-xs text-muted-foreground">Belum ada produk masuk.</TableCell></TableRow> : receivedPOs.map((po) => (
                    <TableRow key={po.poNumber}><TableCell className="text-xs whitespace-nowrap">{po.createdDate}</TableCell><TableCell className="font-mono font-bold text-xs">{po.poNumber}</TableCell><TableCell className="text-right font-bold text-xs">Rp {po.total.toLocaleString('id-ID')}</TableCell><TableCell><Badge variant={po.status === 'Received' ? 'success' : 'warning'}>{po.status === 'Received' ? 'Diterima' : 'Dalam Perjalanan'}</Badge></TableCell><TableCell className="text-xs font-semibold">{po.supplier}</TableCell><TableCell className="text-xs">{po.paymentMethod || '-'}</TableCell><TableCell className="text-xs">{po.deliveryNoteNumber || '-'}</TableCell></TableRow>
                  ))}
                </TableBody></Table>
              </div>
            </TabsContent>
            <TabsContent value="eceran" className="p-5 mt-0">
              <div className="overflow-x-auto border border-border rounded-lg"><Table><TableHeader><TableRow className="bg-muted/40"><TableHead>Produk</TableHead><TableHead>SKU</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Harga Eceran</TableHead><TableHead className="text-right">Stok</TableHead></TableRow></TableHeader><TableBody>
                {sortedProducts.map((product) => <TableRow key={product.sku}><TableCell className="font-bold text-xs">{product.name}</TableCell><TableCell className="font-mono text-xs">{product.sku}</TableCell><TableCell className="text-xs">{product.unit}</TableCell><TableCell className="text-right font-bold text-xs">Rp {product.retailPrice.toLocaleString('id-ID')}</TableCell><TableCell className="text-right text-xs">{product.stock}</TableCell></TableRow>)}
              </TableBody></Table></div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    );
  }

  if (stokView === 'hub') {
    return (
      <div className="space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Pengaturan Stok */}
          <div className="lg:col-span-5 space-y-5">
            <div>
              <div className="space-y-3">
                <Card
                  onClick={() => setStokView('list')}
                  className="flex-row items-center gap-4 p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <Warehouse className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-foreground">Stok Produk</p>
                    <p className="text-xs text-muted-foreground">Stok yang ada di lokasi SKU secara keseluruhan</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </Card>

                <Card
                  onClick={() => setStokView('incoming')}
                  className="flex-row items-center gap-4 p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-sm text-foreground">Stok Supplier</p>
                    <p className="text-xs text-muted-foreground">Barang yang baru dianter pemasok, 3 hari terakhir</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </Card>

                <Card
                  onClick={() => setStokView('pemasok')}
                  className="flex-row items-center gap-4 p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                    <Boxes className="w-5 h-5 text-pink-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-foreground">Stok Pemasok</p>
                    <p className="text-xs text-muted-foreground">Stok yang ada pada pemasok (PO belum diterima)</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </Card>

                <Card
                  onClick={() => can('manage_product_update') ? setShowAdjustmentModal(true) : dialog.alert('Anda tidak memiliki izin untuk mengajukan Stock Opname.')}
                  className="flex-row items-center gap-4 p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                    <SlidersHorizontal className="w-5 h-5 text-sky-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-foreground">Stok Opname ({pendingOpnameCount})</p>
                    <p className="text-xs text-muted-foreground">Stok ketersediaan yang disimpan perusahaan.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </Card>

                <Card
                  onClick={() => setStokView('transfer')}
                  className="flex-row items-center gap-4 p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
                    <ChevronRight className="w-5 h-5 text-cyan-600 rotate-45" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-foreground">Transfer Stok</p>
                    <p className="text-xs text-muted-foreground">Transfer stok dari lokasi SKU satu ke lokasi SKU lain.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </Card>
              </div>
            </div>

            {pendingOpnameCount > 0 && (
              <div>
                <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mb-3">Menunggu Persetujuan</h3>
                <Card
                  onClick={() => setStokView('list')}
                  className="flex-row items-center gap-4 p-4 cursor-pointer border-amber-200 hover:shadow-sm transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-foreground">Persetujuan Stok Opname</p>
                    <p className="text-xs text-muted-foreground">Persetujuan atas perubahan stok</p>
                  </div>
                  <Badge variant="warning" className="ml-auto shrink-0">{pendingOpnameCount} Pending</Badge>
                </Card>
              </div>
            )}
          </div>

          {/* Right: Tabs list */}
          <Card className="lg:col-span-7 p-0 overflow-hidden gap-0">
            <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as any)}>
              <TabsList className="px-4 pt-3 bg-transparent rounded-none h-auto">
                <TabsTrigger value="menipis">Stok Menipis</TabsTrigger>
                <TabsTrigger value="baru-masuk">Baru Masuk</TabsTrigger>
                <TabsTrigger value="opname">Sedang Stok Opname</TabsTrigger>
                <TabsTrigger value="terlaris">Terlaris di Bulan Ini</TabsTrigger>
              </TabsList>

              <TabsContent value="menipis" className="mt-0">
                <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
                  {lowStockList.length === 0 ? (
                    <p className="p-6 text-center text-xs text-muted-foreground">Tidak ada produk dengan stok menipis/habis.</p>
                  ) : (
                    lowStockList.map((p) => (
                      <div key={p.sku} className="flex items-center gap-3 p-4">
                        <div className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <Boxes className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Badge variant="destructive" className="mb-1">{p.stock <= 0 ? 'Stok Habis' : 'Stok Menipis'}</Badge>
                          <p className="font-extrabold text-xs text-foreground truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">Tersisa {p.stock} {p.unit} &middot; {p.warehouseLocation || '-'}</p>
                        </div>
                        <p className="font-black text-xs text-foreground shrink-0">Rp {p.retailPrice.toLocaleString('id-ID')}</p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="baru-masuk" className="mt-0">
                <Tabs value={incomingTab} onValueChange={(value) => setIncomingTab(value as typeof incomingTab)}>
                  <div className="flex items-center justify-between gap-3 px-4 pt-3">
                    <TabsList className="bg-muted/60">
                      <TabsTrigger value="masuk">Produk Masuk</TabsTrigger>
                      <TabsTrigger value="eceran">Produk Eceran</TabsTrigger>
                    </TabsList>
                    {incomingTab === 'masuk' && (
                      <Button size="sm" onClick={openIncomingModal} disabled={products.length === 0}>
                        <Plus className="w-3.5 h-3.5" /> Tambah Produk Masuk
                      </Button>
                    )}
                  </div>

                  <TabsContent value="masuk" className="mt-3 px-4 pb-4">
                    <div className="overflow-x-auto border border-border rounded-lg">
                      <Table className="min-w-[850px]">
                        <TableHeader><TableRow className="bg-muted/40">
                          <TableHead>Tgl</TableHead><TableHead>Nomor PO</TableHead><TableHead className="text-right">Total Pembelian</TableHead><TableHead>Status</TableHead><TableHead>Pemasok</TableHead><TableHead>Metode Bayar</TableHead><TableHead>No. Surat Jalan</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {receivedPOs.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="p-6 text-center text-xs text-muted-foreground">Belum ada produk masuk.</TableCell></TableRow>
                          ) : receivedPOs.map((po) => (
                            <TableRow key={po.poNumber}>
                              <TableCell className="text-xs whitespace-nowrap">{po.createdDate}</TableCell>
                              <TableCell className="font-mono font-bold text-xs">{po.poNumber}</TableCell>
                              <TableCell className="text-right font-bold text-xs">Rp {po.total.toLocaleString('id-ID')}</TableCell>
                              <TableCell><Badge variant={po.status === 'Received' ? 'success' : 'warning'}>{po.status === 'Received' ? 'Diterima' : 'Dalam Perjalanan'}</Badge></TableCell>
                              <TableCell className="text-xs font-semibold">{po.supplier}</TableCell>
                              <TableCell className="text-xs">{po.paymentMethod || '-'}</TableCell>
                              <TableCell className="text-xs">{po.deliveryNoteNumber || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="eceran" className="mt-3 px-4 pb-4">
                    <div className="overflow-x-auto border border-border rounded-lg">
                      <Table className="min-w-[650px]">
                        <TableHeader><TableRow className="bg-muted/40"><TableHead>Produk</TableHead><TableHead>SKU</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Harga Eceran</TableHead><TableHead className="text-right">Stok</TableHead></TableRow></TableHeader>
                        <TableBody>{sortedProducts.length === 0 ? <TableRow><TableCell colSpan={5} className="p-6 text-center text-xs text-muted-foreground">Belum ada produk.</TableCell></TableRow> : sortedProducts.map((product) => (
                          <TableRow key={product.sku}><TableCell className="font-bold text-xs">{product.name}</TableCell><TableCell className="font-mono text-xs">{product.sku}</TableCell><TableCell className="text-xs">{product.unit}</TableCell><TableCell className="text-right font-bold text-xs">Rp {product.retailPrice.toLocaleString('id-ID')}</TableCell><TableCell className="text-right text-xs">{product.stock}</TableCell></TableRow>
                        ))}</TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="aktual" className="mt-3 px-4 pb-4">
                    <div className="overflow-x-auto border border-border rounded-lg">
                      <Table className="min-w-[700px]">
                        <TableHeader><TableRow className="bg-muted/40"><TableHead>Produk</TableHead><TableHead>SKU</TableHead><TableHead>Lokasi SKU</TableHead><TableHead className="text-right">Stok Aktual</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                        <TableBody>{sortedProducts.length === 0 ? <TableRow><TableCell colSpan={5} className="p-6 text-center text-xs text-muted-foreground">Belum ada stok.</TableCell></TableRow> : sortedProducts.map((product) => (
                          <TableRow key={product.sku}><TableCell className="font-bold text-xs">{product.name}</TableCell><TableCell className="font-mono text-xs">{product.sku}</TableCell><TableCell className="text-xs">{product.warehouseLocation || '-'}</TableCell><TableCell className="text-right font-black text-xs">{product.stock} {product.unit}</TableCell><TableCell><Badge variant={product.stockStatus === 'Healthy' ? 'success' : product.stockStatus === 'Low Stock' ? 'warning' : 'destructive'}>{product.stockStatus === 'Healthy' ? 'Aman' : product.stockStatus === 'Low Stock' ? 'Menipis' : 'Habis'}</Badge></TableCell></TableRow>
                        ))}</TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="opname" className="mt-0">
                <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
                  {sedangOpnameList.length === 0 ? (
                    <p className="p-6 text-center text-xs text-muted-foreground">Tidak ada produk yang sedang diajukan Stock Opname.</p>
                  ) : (
                    sedangOpnameList.map((p) => (
                      <div key={p.sku} className="flex items-center gap-3 p-4">
                        <div className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <Boxes className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Badge className="mb-1 bg-sky-500">Menunggu Persetujuan</Badge>
                          <p className="font-extrabold text-xs text-foreground truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">Stok saat ini {p.stock} {p.unit} &middot; {p.warehouseLocation || '-'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="terlaris" className="mt-0">
                <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
                  {terlarisList.length === 0 ? (
                    <p className="p-6 text-center text-xs text-muted-foreground">Belum ada data penjualan bulan ini.</p>
                  ) : (
                    terlarisList.map(({ product: p, qty }) => (
                      <div key={p.sku} className="flex items-center gap-3 p-4">
                        <div className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <Boxes className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-xs text-foreground truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">Terjual {qty} {p.unit} bulan ini</p>
                        </div>
                        <p className="font-black text-xs text-foreground shrink-0">Rp {p.retailPrice.toLocaleString('id-ID')}</p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Penerimaan produk masuk: langkah pertama menyimpan header PO, langkah kedua menyimpan item dan lokasi SKU. */}
        <Dialog open={showIncomingModal} onOpenChange={(open) => {
          setShowIncomingModal(open);
          if (!open && returnToIncomingPage) {
            setReturnToIncomingPage(false);
            setStokView('incoming');
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle><Plus className="w-4 h-4" /> Tambah Produk Masuk {incomingStep === 1 ? '- Data Pembelian' : '- Detail Produk'}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveIncoming} className="space-y-4 text-xs">
              {incomingStep === 1 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>Tanggal</Label><Input type="date" value={incomingDate} onChange={(event) => setIncomingDate(event.target.value)} required /></div>
                    <div><Label>Nomor PO</Label><Input value={incomingPoNumber} onChange={(event) => setIncomingPoNumber(event.target.value)} placeholder="PO-2026-XXXX" required /></div>
                    <div><Label>Supplier</Label><Select value={incomingSupplier} onValueChange={setIncomingSupplier}><SelectTrigger><SelectValue placeholder="Pilih pemasok" /></SelectTrigger><SelectContent>{suppliers.map((supplier) => <SelectItem key={supplier.name} value={supplier.name}>{supplier.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Metode Bayar</Label><Select value={incomingPaymentMethod} onValueChange={(value) => setIncomingPaymentMethod(value as typeof incomingPaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Tunai</SelectItem><SelectItem value="Transfer">Transfer</SelectItem><SelectItem value="Tempo">Tempo</SelectItem></SelectContent></Select>{incomingPaymentMethod === 'Tempo' && <div className="mt-2"><Label htmlFor="incoming-due-date">Jatuh Tempo</Label><div className="relative"><CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input id="incoming-due-date" type="date" value={incomingDueDate} min={incomingDate} onChange={(event) => setIncomingDueDate(event.target.value)} className="pl-9" required /></div></div>}</div>
                    <div><Label>No. Surat Jalan</Label><Input value={incomingDeliveryNote} onChange={(event) => setIncomingDeliveryNote(event.target.value)} placeholder="Nomor surat jalan pemasok" /></div>
                    <div><Label>Status</Label><Select value={incomingStatus} onValueChange={(value) => setIncomingStatus(value as typeof incomingStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Received">Diterima</SelectItem><SelectItem value="In Transit">Dalam Perjalanan</SelectItem></SelectContent></Select></div>
                  </div>
                  <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 text-[10px] text-muted-foreground">Klik Lanjut untuk memasukkan detail produk, jumlah, harga, diskon, dan lokasi SKU.</div>
                  <DialogFooter><Button type="button" variant="outline" onClick={() => setShowIncomingModal(false)}>Batal</Button><Button type="button" onClick={() => { if (!incomingDate || !incomingPoNumber.trim() || !incomingSupplier || (incomingPaymentMethod === 'Tempo' && !incomingDueDate)) { dialog.alert('Lengkapi tanggal, nomor PO, pemasok, dan tanggal jatuh tempo jika memilih Tempo.'); return; } setIncomingStep(2); }}>Lanjut</Button></DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    {incomingItems.map((item, index) => {
                      const product = products.find((candidate) => candidate.sku === item.productSku);
                      const itemDiscount = getItemDiscount(item);
                      const discountedUnitPrice = Math.max(0, item.price - itemDiscount);
                      const itemTotal = item.bonus ? 0 : discountedUnitPrice * item.quantity;
                      return (
                        <div key={`${item.productSku}-${index}`} className="rounded-xl border border-border p-3 space-y-3">
                          <div className="flex items-center justify-between"><p className="font-extrabold text-xs">Produk {index + 1}</p><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" title="Tambah diskon atau biaya tambahan" onClick={() => setOpenItemMenu(openItemMenu === index ? null : index)} className="h-7 w-7"><Plus className="w-4 h-4" /></Button><Button type="button" variant="ghost" size="icon" title="Menu produk" onClick={() => setOpenItemMenu(openItemMenu === index ? null : index)} className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button>{incomingItems.length > 1 && <Button type="button" variant="ghost" size="icon" title="Hapus produk" onClick={() => setIncomingItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="h-7 w-7 text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>}</div></div>
                          {openItemMenu === index && <div className="flex flex-wrap gap-2 rounded-lg bg-muted/50 p-2"><Button type="button" size="sm" variant="outline" onClick={() => { updateIncomingItem(index, { discounts: [...item.discounts, { type: 'amount', value: 0 }] }); setOpenItemMenu(null); }}><Percent className="w-3 h-3" /> Tambah/Ubah Diskon</Button><Button type="button" size="sm" variant="outline" onClick={() => { setIncomingAdditionalCosts((costs) => [...costs, { name: '', amount: 0 }]); setOpenItemMenu(null); }}><Plus className="w-3 h-3" /> Tambah/Ubah Biaya Tambahan</Button></div>}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="relative"><Label>Nama Produk</Label><Input value={activeProductSearchIndex === index ? incomingProductSearch : product?.name || ''} placeholder="Cari nama atau SKU produk..." onFocus={() => { setActiveProductSearchIndex(index); setIncomingProductSearch(product?.name || ''); }} onChange={(event) => { setActiveProductSearchIndex(index); setIncomingProductSearch(event.target.value); }} />{activeProductSearchIndex === index && incomingProductSearch && <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-44 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">{products.filter((candidate) => `${candidate.name} ${candidate.sku}`.toLowerCase().includes(incomingProductSearch.toLowerCase())).map((productItem) => <button type="button" key={productItem.sku} className="block w-full px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => { updateIncomingItem(index, { productSku: productItem.sku, price: productItem.costPrice ?? productItem.retailPrice ?? 0 }); setIncomingProductSearch(''); setActiveProductSearchIndex(null); }}><span className="font-bold">{productItem.name}</span><span className="block text-[10px] text-muted-foreground">{productItem.sku}</span></button>)}</div>}</div>
                            <div><Label>Qty</Label><NumberInput min={1} value={item.quantity} onChange={(value) => setIncomingItems((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, quantity: value } : current))} /></div>
                            <div><Label>Harga Modal (Rp)</Label><NumberInput min={0} value={item.price} disabled={item.bonus} onChange={(value) => updateIncomingItem(index, { price: value })} /></div>
                            <div className="sm:col-span-2"><Label>Diskon Satuan</Label>{item.discounts.map((discount, discountIndex) => <div key={discountIndex} className="flex gap-2 mt-1"><Select value={discount.type} onValueChange={(value) => updateIncomingDiscount(index, discountIndex, { type: value as 'percent' | 'amount' })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">Persen (%)</SelectItem><SelectItem value="amount">Rupiah (Rp)</SelectItem></SelectContent></Select><NumberInput min={0} max={discount.type === 'percent' ? 100 : undefined} value={discount.value} onChange={(value) => updateIncomingDiscount(index, discountIndex, { value })} /><Button type="button" variant="ghost" size="icon" onClick={() => updateIncomingItem(index, { discounts: item.discounts.filter((_, currentIndex) => currentIndex !== discountIndex) })} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button></div>)}<Button type="button" variant="outline" size="sm" onClick={() => updateIncomingItem(index, { discounts: [...item.discounts, { type: 'amount', value: 0 }] })} className="mt-1"><Plus className="w-3 h-3" /> Tambah Diskon</Button></div>
                            <div><Label>Pilih Lokasi SKU</Label><Select value={item.locationId} onValueChange={(value) => updateIncomingItem(index, { locationId: value })}><SelectTrigger><SelectValue placeholder="Pilih lokasi" /></SelectTrigger><SelectContent>{skuLocations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></div>
                            <div className="flex items-end"><label className="flex items-center gap-2 h-10 cursor-pointer"><Checkbox checked={item.taxIncluded} onCheckedChange={(checked) => updateIncomingItem(index, { taxIncluded: checked === true })} /><span className="font-bold">Sudah PPN</span></label><label className="flex items-center gap-2 h-10 ml-4 cursor-pointer"><Checkbox checked={item.bonus} onCheckedChange={(checked) => updateIncomingItem(index, { bonus: checked === true })} /><span className="font-bold text-amber-700">Bonus (Rp 0)</span></label></div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border pt-2 text-[10px]"><div><span className="text-muted-foreground">Total Diskon</span><p className="font-black text-red-600">Rp {(itemDiscount * item.quantity).toLocaleString('id-ID')}</p></div><div><span className="text-muted-foreground">Harga Setelah Diskon</span><p className="font-black">Rp {item.bonus ? '0' : discountedUnitPrice.toLocaleString('id-ID')} / unit</p></div><div className="text-right"><span className="text-muted-foreground">Total Rp</span><p className="font-black text-primary">Rp {itemTotal.toLocaleString('id-ID')}</p></div></div>
                          {!product && <p className="text-[10px] text-red-500">Produk belum dipilih.</p>}
                        </div>
                      );
                    })}
                  </div>
                  <Button type="button" variant="outline" onClick={() => setIncomingItems((items) => [...items, { productSku: products[0]?.sku || '', quantity: 1, price: products[0]?.costPrice ?? products[0]?.retailPrice ?? 0, taxIncluded: false, discounts: [], bonus: false, locationId: products[0]?.skuLocationId || '' }])} className="w-full"><Plus className="w-3.5 h-3.5" /> Tambah Produk Lain</Button>
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2"><div className="flex items-center justify-between"><p className="font-extrabold text-xs">Ringkasan Biaya Tambahan</p><Button type="button" variant="outline" size="sm" onClick={() => setIncomingAdditionalCosts((costs) => [...costs, { name: '', amount: 0 }])}><Plus className="w-3 h-3" /> Tambah Biaya</Button></div>{incomingAdditionalCosts.length === 0 && <p className="text-[10px] text-muted-foreground">Belum ada biaya tambahan.</p>}{incomingAdditionalCosts.map((cost, costIndex) => <div key={costIndex} className="flex gap-2"><Input value={cost.name} onChange={(event) => setIncomingAdditionalCosts((costs) => costs.map((current, index) => index === costIndex ? { ...current, name: event.target.value } : current))} placeholder="Label biaya, contoh: Ongkir" /><NumberInput min={0} value={cost.amount} onChange={(value) => setIncomingAdditionalCosts((costs) => costs.map((current, index) => index === costIndex ? { ...current, amount: value } : current))} /><Button type="button" variant="ghost" size="icon" onClick={() => setIncomingAdditionalCosts((costs) => costs.filter((_, index) => index !== costIndex))} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button></div>)}<div className="flex justify-between border-t border-border pt-2 font-black text-[11px]"><span>Total Biaya Tambahan</span><span>Rp {incomingAdditionalCost.toLocaleString('id-ID')}</span></div></div>
                  <div className="flex justify-between rounded-lg bg-primary/5 p-3 font-black text-sm"><span>Total Pembelian</span><span className="text-primary">Rp {incomingTotal.toLocaleString('id-ID')}</span></div>
                  <DialogFooter><Button type="button" variant="outline" onClick={() => setIncomingStep(1)}>Kembali</Button><Button type="submit">Simpan Produk Masuk</Button></DialogFooter>
                </>
              )}
            </form>
          </DialogContent>
        </Dialog>

        {/* Adjustment / Stock Opname Modal (dipakai dari kartu "Stok Opname") */}
        <Dialog open={showAdjustmentModal} onOpenChange={setShowAdjustmentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <SlidersHorizontal className="w-4 h-4" /> PENYESUAIAN STOK MANUAL GUDANG
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleExecuteAdjustment} className="space-y-4 text-xs">
              <div>
                <Label>Pilih Bahan Bangunan (SKU)</Label>
                <Select value={adjustProductSku} onValueChange={setAdjustProductSku}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sortedProducts.map(p => (
                      <SelectItem key={p.sku} value={p.sku}>{p.name} ({p.sku})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipe Penyesuaian</Label>
                  <Select value={adjustType} onValueChange={(v) => setAdjustType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Tambah Stok (+)</SelectItem>
                      <SelectItem value="remove">Kurangi Stok (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Jumlah Unit</Label>
                  <NumberInput
                    min={1}
                    value={adjustValue}
                    onChange={setAdjustValue}
                    placeholder="0"
                    className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                  />
                </div>
              </div>

              <div>
                <Label>Catatan (opsional)</Label>
                <Textarea
                  rows={2}
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Contoh: sack semen rusak saat bongkar muat"
                />
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-border bg-muted p-2.5 text-[10px] font-bold text-foreground cursor-pointer">
                <Checkbox
                  checked={adjustDirectApply}
                  onCheckedChange={(v) => setAdjustDirectApply(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Terapkan Langsung (Mode Manajer) — stok langsung berubah tanpa perlu persetujuan. Jika tidak dicentang, pengajuan akan masuk ke daftar Stock Opname untuk disetujui manajer.
                </span>
              </label>

              <p className="text-[10px] text-muted-foreground leading-relaxed bg-primary/5 p-3 rounded-lg border border-primary/10">
                Operasi penyesuaian stok ini akan langsung memengaruhi saldo fisik material di gudang utama. Log aktivitas penyesuaian akan dicatat atas nama operator aktif.
              </p>

              <DialogFooter>
                <Button type="button" variant="outline" className="w-full" onClick={() => setShowAdjustmentModal(false)}>
                  Batal
                </Button>
                <Button type="submit" className="w-full">
                  Terapkan Penyesuaian
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (stokView === 'pemasok') {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setStokView('hub')} className="text-muted-foreground -ml-2">
          <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Kembali ke Stok
        </Button>
        {pemasokStockRecap.length === 0 ? (
          <Card className="p-10 text-center text-xs text-muted-foreground">
            Tidak ada purchase order yang masih berstatus belum diterima dari pemasok.
          </Card>
        ) : (
          <div className="space-y-3">
            {pemasokStockRecap.map(({ supplier: s, openPOs, totalValue, totalItems }) => (
              <Card key={s.name} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-extrabold text-sm text-foreground">{s.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">{totalItems} unit &middot; Rp {totalValue.toLocaleString('id-ID')}</p>
                </div>
                <div className="divide-y divide-border border-t border-border">
                  {openPOs.map((po) => (
                    <div key={po.poNumber} className="flex items-center justify-between py-2 text-xs">
                      <div>
                        <p className="font-bold text-foreground/80">{po.poNumber}</p>
                        <p className="text-muted-foreground">{po.status} &middot; {po.createdDate}</p>
                      </div>
                      <p className="font-bold text-foreground">Rp {po.total.toLocaleString('id-ID')}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (stokView === 'transfer') {
    const currentProd = products.find((p) => p.sku === transferSku);
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setStokView('hub')} className="text-muted-foreground -ml-2">
          <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Kembali ke Stok
        </Button>
        <Card className="p-5 max-w-md space-y-4">
          <div>
            <Label>Pilih Produk</Label>
            <Select value={transferSku} onValueChange={setTransferSku}>
              <SelectTrigger><SelectValue placeholder="Pilih produk..." /></SelectTrigger>
              <SelectContent>
                {sortedProducts.map((p) => <SelectItem key={p.sku} value={p.sku}>{p.name} ({p.sku})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {currentProd && (
            <p className="text-xs text-muted-foreground">Lokasi saat ini: <span className="font-bold text-foreground/80">{currentProd.warehouseLocation || '-'}</span> &middot; Stok: <span className="font-bold text-foreground/80">{currentProd.stock} {currentProd.unit}</span></p>
          )}
          <div>
            <Label>Lokasi Tujuan</Label>
            <Select value={transferTargetLocationId} onValueChange={setTransferTargetLocationId}>
              <SelectTrigger><SelectValue placeholder="Pilih lokasi tujuan..." /></SelectTrigger>
              <SelectContent>
                {skuLocations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {skuLocations.length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1">Belum ada data Lokasi SKU. Tambahkan dulu di menu Products &gt; Sku Master.</p>
            )}
          </div>
          <Button onClick={handleTransferStock} className="w-full" size="lg">
            Transfer Stok
          </Button>
        </Card>
      </div>
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
          <Card className="flex-row flex-col sm:flex-row gap-3 items-center justify-between p-3">
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
      <Dialog open={showAdjustmentModal} onOpenChange={setShowAdjustmentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <SlidersHorizontal className="w-4 h-4" /> PENYESUAIAN STOK MANUAL GUDANG
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleExecuteAdjustment} className="space-y-4 text-xs">
            <div>
              <Label>Pilih Bahan Bangunan (SKU)</Label>
              <Select value={adjustProductSku} onValueChange={setAdjustProductSku}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.sku} value={p.sku}>{p.name} ({p.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipe Penyesuaian</Label>
                <Select value={adjustType} onValueChange={(v) => setAdjustType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Tambah Stok (+)</SelectItem>
                    <SelectItem value="remove">Kurangi Stok (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Jumlah Unit</Label>
                <NumberInput
                  min={1}
                  value={adjustValue}
                  onChange={setAdjustValue}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
            </div>

            <div>
              <Label>Catatan (opsional)</Label>
              <Textarea
                rows={2}
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Contoh: sack semen rusak saat bongkar muat"
              />
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-border bg-muted p-2.5 text-[10px] font-bold text-foreground cursor-pointer">
              <Checkbox
                checked={adjustDirectApply}
                onCheckedChange={(v) => setAdjustDirectApply(v === true)}
                className="mt-0.5"
              />
              <span>
                Terapkan Langsung (Mode Manajer) — stok langsung berubah tanpa perlu persetujuan. Jika tidak dicentang, pengajuan akan masuk ke daftar Stock Opname untuk disetujui manajer.
              </span>
            </label>

            <p className="text-[10px] text-muted-foreground leading-relaxed bg-primary/5 p-3 rounded-lg border border-primary/10">
              Operasi penyesuaian stok ini akan langsung memengaruhi saldo fisik material di gudang utama. Log aktivitas penyesuaian akan dicatat atas nama operator aktif.
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowAdjustmentModal(false)}>
                Batal
              </Button>
              <Button type="submit" className="w-full">
                Terapkan Penyesuaian
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Product Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <Plus className="w-4 h-4" /> REGISTRASI PRODUK / MATERIAL BARU
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nama Produk / Material</Label>
                <Input
                  type="text"
                  required
                  placeholder="Contoh: Semen Gresik 50kg..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div>
                <Label>Kode SKU</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="text"
                    required
                    placeholder="SKU-XXXXXX"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="font-mono flex-1 min-w-0"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    title="Generate kode SKU acak"
                    onClick={() => setFormSku(generateSkuCode())}
                    className="bg-gray-900 hover:bg-black text-white px-2.5 shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    title="Scan kode SKU/barcode dengan kamera"
                    onClick={() => setShowSkuScanner(true)}
                    className="px-2.5 shrink-0"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategori</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoryNames.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Satuan Unit</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {unitNames.map((formUnit) => (
                      <SelectItem key={formUnit} value={formUnit}>{formUnit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Harga Modal</Label>
                <NumberInput
                  required
                  value={formRetailPrice}
                  onChange={setFormRetailPrice}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
              <div>
                <Label>Harga Standard</Label>
                <NumberInput
                  required
                  value={formWholesalePrice}
                  onChange={setFormWholesalePrice}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
              <div>
                <Label>Harga Minimum</Label>
                <NumberInput
                  required
                  max={formWholesalePrice || undefined}
                  value={formProjectPrice}
                  onChange={setFormProjectPrice}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stok Awal</Label>
                <NumberInput
                  required
                  value={formStock}
                  onChange={setFormStock}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
              <div>
                <Label>Lokasi Gudang / Rak</Label>
                <Input
                  type="text"
                  required
                  placeholder="Contoh: Section A - Row 02"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Foto Produk</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Tempel URL gambar produk..."
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => imageFileInputRef.current?.click()}
                  disabled={imageUploading}
                  className="bg-gray-900 hover:bg-black text-white whitespace-nowrap"
                >
                  {imageUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  Upload
                </Button>
                <input ref={imageFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelect} />
              </div>
              {imageUploadError && <p className="text-[9px] text-red-500 font-bold mt-1">{imageUploadError}</p>}
              {formImage && (
                <img src={formImage} alt="Preview produk" className="mt-2 w-14 h-14 object-cover rounded-lg border border-border" />
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowCreateModal(false)}>
                Batal
              </Button>
              <Button type="submit" className="w-full">
                Simpan Produk
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-amber-600">
              <Edit3 className="w-4 h-4" /> EDIT INFORMASI MATERIAL / PRODUK
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nama Produk / Material</Label>
                <Input
                  type="text"
                  required
                  placeholder="Contoh: Semen Gresik 50kg..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div>
                <Label>Kode SKU (Tidak Dapat Diubah)</Label>
                <Input type="text" disabled value={formSku} className="font-mono bg-muted text-muted-foreground cursor-not-allowed" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategori</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoryNames.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Satuan Unit</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sack">Sack / Zak</SelectItem>
                    <SelectItem value="Piece">Piece / Batang</SelectItem>
                    <SelectItem value="Gallon">Gallon / Pail</SelectItem>
                    <SelectItem value="Sheet">Sheet / Lembar</SelectItem>
                    <SelectItem value="Ton">Ton</SelectItem>
                    <SelectItem value="Meter">Meter</SelectItem>
                    <SelectItem value="Box">Box / Dus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Harga Modal</Label>
                <NumberInput
                  required
                  value={formRetailPrice}
                  onChange={setFormRetailPrice}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
              <div>
                <Label>Harga Standard</Label>
                <NumberInput
                  required
                  value={formWholesalePrice}
                  onChange={setFormWholesalePrice}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
              <div>
                <Label>Harga Minimum</Label>
                <NumberInput
                  required
                  max={formWholesalePrice || undefined}
                  value={formProjectPrice}
                  onChange={setFormProjectPrice}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stok Gudang</Label>
                <NumberInput
                  required
                  value={formStock}
                  onChange={setFormStock}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
              <div>
                <Label>Lokasi Gudang / Rak</Label>
                <Input
                  type="text"
                  required
                  placeholder="Contoh: Section A - Row 02"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Foto Produk</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Tempel URL gambar produk..."
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => imageFileInputRef.current?.click()}
                  disabled={imageUploading}
                  className="bg-gray-900 hover:bg-black text-white whitespace-nowrap"
                >
                  {imageUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  Upload
                </Button>
                <input ref={imageFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelect} />
              </div>
              {imageUploadError && <p className="text-[9px] text-red-500 font-bold mt-1">{imageUploadError}</p>}
              {formImage && (
                <img src={formImage} alt="Preview produk" className="mt-2 w-14 h-14 object-cover rounded-lg border border-border" />
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowEditModal(false)}>
                Batal
              </Button>
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700">
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
