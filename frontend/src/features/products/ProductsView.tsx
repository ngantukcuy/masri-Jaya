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
  CheckCircle2
} from 'lucide-react';
import { Product, SkuLocation, Supplier, PO, SalesInvoice } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useSupabaseTable } from '../../lib/useSupabaseTable';
import { uploadProductImage } from '../../lib/uploadProductImage';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';
import NumberInput from '../../components/shared/NumberInput';
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

interface ProductsViewProps {
  products: Product[];
  onUpdateProducts: (updatedProducts: Product[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
  currentUserName?: string;
  currentUser?: CurrentUser;
  skuLocations?: SkuLocation[];
  suppliers?: Supplier[];
  pos?: PO[];
  salesInvoices?: SalesInvoice[];
}

export default function ProductsView({ products, onUpdateProducts, onAddActivity, currentUserName, currentUser, skuLocations = [], suppliers = [], pos = [], salesInvoices = [] }: ProductsViewProps) {
  const dialog = useDialog();
  const can = (key: string) => hasPermission(currentUser, key);
  // Halaman Stok dibuka dengan tampilan "hub" (kartu Pengaturan Stok +
  // panel Stok Menipis/Opname/Terlaris), sama seperti referensi desain.
  // Klik salah satu kartu akan pindah ke sub-tampilan terkait; tombol
  // "Kembali" di tiap sub-tampilan mengembalikan ke hub.
  const [stokView, setStokView] = useState<'hub' | 'list' | 'pemasok' | 'transfer'>('hub');
  const [rightPanelTab, setRightPanelTab] = useState<'menipis' | 'opname' | 'terlaris'>('menipis');
  // ---- Transfer Stok: pindahkan lokasi gudang sebuah SKU ----
  const [transferSku, setTransferSku] = useState('');
  const [transferTargetLocationId, setTransferTargetLocationId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [selectedStatus, setSelectedStatus] = useState<string>('Semua');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  
  // CRUD states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states (shared by Create and Edit)
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategory, setFormCategory] = useState('Concrete');
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

  const saveSubmissions = (subs: any[]) => {
    setOpnameSubmissions(subs);
  };

  // ---- Data turunan buat hub Stok ----
  const lowStockList = products.filter((p) => p.stockStatus === 'Low Stock' || p.stockStatus === 'Out of Stock' || p.stock < 0);
  const pendingOpnameSkus = new Set(opnameSubmissions.filter((s) => s.status === 'Pending').map((s) => s.productSku));
  const sedangOpnameList = products.filter((p) => pendingOpnameSkus.has(p.sku));
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

  // Map category displays to Indonesian
  const categoryTranslationMap: Record<string, string> = {
    'All': 'Semua Kategori',
    'Cement & Mortar': 'Semen & Mortar',
    'Paint & Coatings': 'Cat & Pelapis',
    'Steel & Reinforcement': 'Besi & Baja Beton',
    'Electrical': 'Alat Listrik',
    'Metals': 'Logam Bangunan',
    'Concrete': 'Beton Cor',
    'Glazing': 'Kaca & Keramik'
  };

  // Available unique categories in local language
  const categories = ['Semua', ...Array.from(new Set(products.map(p => p.category)))];

  // Filters logic
  const filteredProducts = products.filter((prod) => {
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
      'Kategori': categoryTranslationMap[p.category] || p.category,
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
        <td>${categoryTranslationMap[p.category] || p.category}</td>
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
    setFormCategory('Cement & Mortar');
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

  if (stokView === 'hub') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Stok</h2>
          <p className="text-muted-foreground text-sm">Kelola lokasi stok, opname, transfer, dan pantau stok yang perlu perhatian.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Pengaturan Stok */}
          <div className="lg:col-span-5 space-y-5">
            <div>
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mb-3">Pengaturan Stok</h3>
              <div className="space-y-3">
                <Card
                  onClick={() => setStokView('list')}
                  className="flex-row items-center gap-4 p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <Warehouse className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-foreground">Stok Lokasi SKU</p>
                    <p className="text-xs text-muted-foreground">Stok yang ada di lokasi SKU secara keseluruhan</p>
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
      </div>
    );
  }

  if (stokView === 'pemasok') {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setStokView('hub')} className="text-muted-foreground -ml-2">
          <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Kembali ke Stok
        </Button>
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Stok Pemasok</h2>
          <p className="text-muted-foreground text-sm">Barang yang sudah dipesan (PO) tapi belum diterima ke gudang &mdash; masih tercatat sebagai stok di pemasok.</p>
        </div>
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
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Transfer Stok</h2>
          <p className="text-muted-foreground text-sm">Pindahkan produk dari satu lokasi SKU ke lokasi SKU lainnya.</p>
        </div>
        <Card className="p-5 max-w-md space-y-4">
          <div>
            <Label>Pilih Produk</Label>
            <Select value={transferSku} onValueChange={setTransferSku}>
              <SelectTrigger><SelectValue placeholder="Pilih produk..." /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.sku} value={p.sku}>{p.name} ({p.sku})</SelectItem>)}
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
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Bahan Bangunan &amp; Inventori</h2>
          <p className="text-muted-foreground text-sm">Tinjau daftar bahan bangunan, nomor SKU, pemetaan barcode, dan lokasi fisik gudang.</p>
        </div>
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

            <div className="flex items-center gap-2 w-full sm:w-auto">
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
                <Download className="w-4 h-4" />
              </Button>

              <Button variant="outline" size="icon" onClick={handlePrintStock} title="Cetak Laporan Stok">
                <Printer className="w-4 h-4" />
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
                          <SelectItem key={cat} value={cat}>{categoryTranslationMap[cat] || cat}</SelectItem>
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
                  filteredProducts.map((prod) => (
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
                            <p className="text-[10px] text-muted-foreground mt-0.5">{categoryTranslationMap[prod.category] || prod.category}</p>
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
                    <span className="font-bold text-foreground/80">{categoryTranslationMap[selectedProduct.category] || selectedProduct.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pemasok Utama</span>
                    <span className="font-bold text-primary underline cursor-pointer">BuildMaster Corp</span>
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
                    <SelectItem value="Cement & Mortar">Semen & Mortar</SelectItem>
                    <SelectItem value="Steel & Reinforcement">Baja & Besi Beton</SelectItem>
                    <SelectItem value="Concrete">Beton & Aggregate</SelectItem>
                    <SelectItem value="Paint & Coatings">Cat & Pelapis</SelectItem>
                    <SelectItem value="Electrical">Kelistrikan</SelectItem>
                    <SelectItem value="Metals">Logam & Profil</SelectItem>
                    <SelectItem value="Glazing">Kaca & Kusen</SelectItem>
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
                    <SelectItem value="Cement & Mortar">Semen & Mortar</SelectItem>
                    <SelectItem value="Steel & Reinforcement">Baja & Besi Beton</SelectItem>
                    <SelectItem value="Concrete">Beton & Aggregate</SelectItem>
                    <SelectItem value="Paint & Coatings">Cat & Pelapis</SelectItem>
                    <SelectItem value="Electrical">Kelistrikan</SelectItem>
                    <SelectItem value="Metals">Logam & Profil</SelectItem>
                    <SelectItem value="Glazing">Kaca & Kusen</SelectItem>
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
