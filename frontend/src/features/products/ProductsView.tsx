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
  Loader2
} from 'lucide-react';
import { Product } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useSupabaseTable } from '../../lib/useSupabaseTable';
import { uploadProductImage } from '../../lib/uploadProductImage';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';

interface ProductsViewProps {
  products: Product[];
  onUpdateProducts: (updatedProducts: Product[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote') => void;
  currentUserName?: string;
  currentUser?: CurrentUser;
}

export default function ProductsView({ products, onUpdateProducts, onAddActivity, currentUserName, currentUser }: ProductsViewProps) {
  const dialog = useDialog();
  const can = (key: string) => hasPermission(currentUser, key);
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

  const [opnameSubmissions, setOpnameSubmissions] = useSupabaseTable<any>('opname_submissions', [], (s) => s.id);

  const saveSubmissions = (subs: any[]) => {
    setOpnameSubmissions(subs);
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
        'quote'
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
    setFormName('');
    setFormSku(`SKU-${Math.floor(100000 + Math.random() * 900000)}`);
    setFormCategory('Cement & Mortar');
    setFormUnit('Sack');
    setFormRetailPrice(50000);
    setFormWholesalePrice(48000);
    setFormProjectPrice(45000);
    setFormStock(100);
    setFormLocation('Section B - Row 01');
    setFormImage('https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=150');
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

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Bahan Bangunan &amp; Inventori</h2>
          <p className="text-gray-500 text-sm">Tinjau daftar bahan bangunan, nomor SKU, pemetaan barcode, dan lokasi fisik gudang.</p>
        </div>
        <div className="flex gap-2">
          {can('manage_product_add') && (
          <button 
            onClick={openCreateProductModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk Baru</span>
          </button>
          )}
          {can('manage_product_update') && (
          <button 
            onClick={() => setShowAdjustmentModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Penyesuaian Stok Manual</span>
          </button>
          )}
        </div>
      </div>

      {/* Product Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">TOTAL JENIS SKU</p>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">{products.length} Material</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">ESTIMASI NILAI INVENTORI</p>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">Rp {totalStockValue.toLocaleString('id-ID')}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">STOK KRITIS / HABIS</p>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">{lowStockCount} SKU Perlu Restock</h4>
          </div>
        </div>
      </div>

      {/* Pending Stock Opname Approvals */}
      {opnameSubmissions.some((s) => s.status === 'Pending') && (
        <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
          <div className="bg-amber-50 px-4 py-3 flex items-center justify-between border-b border-amber-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-800">Pengajuan Stock Opname Menunggu Persetujuan</h3>
            </div>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {opnameSubmissions.filter((s) => s.status === 'Pending').length} Pending
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {opnameSubmissions.filter((s) => s.status === 'Pending').map((sub) => (
              <div key={sub.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 text-xs">
                  <p className="font-bold text-gray-800">
                    {sub.productName} <span className="text-gray-400 font-normal">({sub.productSku})</span>
                  </p>
                  <p className="text-gray-500 mt-0.5">
                    {sub.type === 'add' ? 'Tambah' : 'Kurangi'} <span className="font-bold">{sub.amount}</span> unit &middot; diajukan oleh {sub.submittedBy} &middot; {sub.date}
                  </p>
                  {sub.notes && <p className="text-gray-400 mt-0.5 italic">"{sub.notes}"</p>}
                </div>
                {can('manage_opname_approve') ? (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleRejectOpname(sub.id)}
                      className="flex-1 sm:flex-none px-3 py-2 border border-gray-200 rounded-lg text-[10px] font-bold uppercase text-gray-600 hover:bg-gray-50 cursor-pointer"
                    >
                      Tolak
                    </button>
                    <button
                      onClick={() => handleApproveOpname(sub.id)}
                      className="flex-1 sm:flex-none px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Setujui
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-400 italic shrink-0">Menunggu persetujuan Owner/Admin.</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Materials Filter and List */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Filter bars and search */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white border border-gray-200 p-3 rounded-xl shadow-xs">
            <div className="relative w-full sm:max-w-xs group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type="text"
                placeholder="Cari SKU, nama produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-lg pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-blue-600/15 outline-none text-gray-900"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
                className={`px-3 py-2 border rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-all ${
                  showFiltersDrawer ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>

              <button 
                onClick={handleExportExcel}
                className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer"
                title="Ekspor ke Excel (.xlsx)"
              >
                <Download className="w-4 h-4" />
              </button>

              <button 
                onClick={handlePrintStock}
                className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer"
                title="Cetak Laporan Stok"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Filters Drawer */}
          <AnimatePresence>
            {showFiltersDrawer && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white border border-gray-200 rounded-xl p-4 overflow-hidden grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
              >
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Pilih Kategori</label>
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-semibold text-gray-700 outline-none"
                  >
                    <option value="Semua">Semua Kategori</option>
                    {categories.filter(c => c !== 'Semua').map(cat => (
                      <option key={cat} value={cat}>{categoryTranslationMap[cat] || cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Status Persediaan</label>
                  <select 
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-semibold text-gray-700 outline-none"
                  >
                    <option value="Semua">Semua Status</option>
                    <option value="Aman">Stok Aman (Healthy)</option>
                    <option value="Kritis">Stok Rendah (Low Stock)</option>
                    <option value="Habis">Stok Habis (Out of Stock)</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Materials Table list */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[10px] text-gray-400 font-bold uppercase border-b border-gray-100">
                    <th className="py-3 px-4">Nama Material</th>
                    <th className="py-3 px-4">Kode SKU</th>
                    <th className="py-3 px-4 text-right">Harga Standard</th>
                    <th className="py-3 px-4 text-center">Stok Fisik</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 font-bold">Tidak ada bahan bangunan yang cocok dengan filter.</td>
                    </tr>
                  ) : (
                    filteredProducts.map((prod) => (
                      <tr 
                        key={prod.sku}
                        onClick={() => setSelectedProduct(prod)}
                        className={`hover:bg-gray-50/50 cursor-pointer transition-colors ${
                          selectedProduct?.sku === prod.sku ? 'bg-blue-50/40 hover:bg-blue-50/40' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={prod.image} 
                              alt={prod.name}
                              className="w-8 h-8 rounded-lg object-cover border border-gray-100"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="font-extrabold text-gray-800 line-clamp-1">{prod.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{categoryTranslationMap[prod.category] || prod.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-gray-500">{prod.sku}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-gray-950">Rp {prod.wholesalePrice.toLocaleString('id-ID')}</td>
                        <td className="py-3.5 px-4 text-center font-black text-gray-800">
                          {prod.stock} <span className="text-[10px] font-bold text-gray-400">{prod.unit}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            prod.stockStatus === 'Healthy' ? 'bg-emerald-50 text-emerald-700' :
                            prod.stockStatus === 'Low Stock' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {prod.stockStatus === 'Healthy' ? 'AMAN' : prod.stockStatus === 'Low Stock' ? 'KRITIS' : 'HABIS'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Material Detail Panel */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-5">
          {selectedProduct ? (
            <div className="space-y-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3">
                  <img 
                    src={selectedProduct.image} 
                    alt={selectedProduct.name}
                    className="w-16 h-16 rounded-xl object-cover border border-gray-200"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="font-black text-sm text-gray-900 leading-snug">{selectedProduct.name}</h4>
                    <span className="text-[10px] font-mono text-gray-400 block mt-0.5">{selectedProduct.sku}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer"
                >✕</button>
              </div>

              {/* Action and quick restocks */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <button
                  onClick={() => handleQuickRestock(selectedProduct)}
                  className={`w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${!can('manage_product_update') ? 'hidden' : ''}`}
                >
                  <Warehouse className="w-3.5 h-3.5" />
                  <span>Restock Cepat (+50)</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  {can('manage_product_update') && (
                    <button
                      onClick={() => handleOpenEditModal(selectedProduct)}
                      className="py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Produk</span>
                    </button>
                  )}
                  {can('manage_product_delete') && (
                    <button
                      onClick={() => handleDeleteProduct(selectedProduct)}
                      className="py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Price list sheets */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest block">Skema Daftar Harga Bertingkat</span>
                <div className="divide-y divide-gray-100 border border-gray-150 rounded-xl bg-gray-50/40 p-1">
                  <div className="flex justify-between p-2">
                    <span className="text-gray-500 font-medium">Harga Modal</span>
                    <span className="font-extrabold text-gray-900">Rp {selectedProduct.retailPrice.toLocaleString('id-ID')} / {selectedProduct.unit}</span>
                  </div>
                  <div className="flex justify-between p-2">
                    <span className="text-gray-500 font-medium flex items-center gap-1">Harga Standard <Info className="w-3.5 h-3.5 text-blue-500" title="Auto-aktif jika pembelian >= 10 unit" /></span>
                    <span className="font-extrabold text-gray-900">Rp {selectedProduct.wholesalePrice.toLocaleString('id-ID')} / {selectedProduct.unit}</span>
                  </div>
                  <div className="flex justify-between p-2">
                    <span className="text-gray-500 font-medium">Harga Minimum</span>
                    <span className="font-extrabold text-gray-900">Rp {selectedProduct.projectPrice.toLocaleString('id-ID')} / {selectedProduct.unit}</span>
                  </div>
                </div>
              </div>

              {/* Additional Specifications */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest block">Spesifikasi Detail Material</span>
                <div className="p-3.5 border border-gray-150 rounded-xl space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Gudang / Lokasi Rak</span>
                    <span className="font-bold text-gray-700 uppercase">{selectedProduct.warehouseLocation || (selectedProduct as any).location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Kategori Bahan</span>
                    <span className="font-bold text-gray-700">{categoryTranslationMap[selectedProduct.category] || selectedProduct.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pemasok Utama</span>
                    <span className="font-bold text-blue-600 underline cursor-pointer">BuildMaster Corp</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Stok Pengaman Minimum</span>
                    <span className="font-bold text-gray-700">15 {selectedProduct.unit}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center text-gray-400">
              <Boxes className="w-8 h-8 text-gray-300 mb-1" />
              <p className="font-bold text-xs uppercase tracking-wider text-gray-500">Detail Bahan Bangunan</p>
              <p className="text-[10px] text-gray-400 mt-1 max-w-[180px]">Pilih salah satu material dari daftar sebelah kiri untuk meninjau data harga atau stok.</p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Stock Adjustment Modal */}
      <AnimatePresence>
        {showAdjustmentModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="font-black text-xs uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4" /> PENYESUAIAN STOK MANUAL GUDANG
                </span>
                <button onClick={() => setShowAdjustmentModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleExecuteAdjustment} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Pilih Bahan Bangunan (SKU)</label>
                  <select 
                    value={adjustProductSku}
                    onChange={(e) => setAdjustProductSku(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-semibold text-gray-700 outline-none"
                  >
                    {products.map(p => (
                      <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Tipe Penyesuaian</label>
                    <select 
                      value={adjustType}
                      onChange={(e) => setAdjustType(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-semibold text-gray-700 outline-none"
                    >
                      <option value="add">Tambah Stok (+)</option>
                      <option value="remove">Kurangi Stok (-)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Jumlah Unit</label>
                    <input 
                      type="number"
                      min={0}
                      value={adjustValue}
                      onChange={(e) => setAdjustValue(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-700 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Catatan (opsional)</label>
                  <textarea
                    rows={2}
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="Contoh: sack semen rusak saat bongkar muat"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-semibold text-gray-700 outline-none"
                  />
                </div>

                <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-[10px] font-bold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adjustDirectApply}
                    onChange={(e) => setAdjustDirectApply(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Terapkan Langsung (Mode Manajer) — stok langsung berubah tanpa perlu persetujuan. Jika tidak dicentang, pengajuan akan masuk ke daftar Stock Opname untuk disetujui manajer.
                  </span>
                </label>

                <p className="text-[10px] text-gray-400 leading-relaxed bg-blue-50/40 p-3 rounded-lg border border-blue-100">
                  Operasi penyesuaian stok ini akan langsung memengaruhi saldo fisik material di gudang utama. Log aktivitas penyesuaian akan dicatat atas nama operator aktif.
                </p>

                <div className="pt-3 border-t border-gray-100 flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAdjustmentModal(false)}
                    className="w-full py-2.5 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/15 cursor-pointer"
                  >
                    Terapkan Penyesuaian
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* Create Product Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[150] p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 my-8"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="font-black text-xs uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> REGISTRASI PRODUK / MATERIAL BARU
                </span>
                <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Nama Produk / Material</label>
                    <input 
                      type="text"
                      required
                      placeholder="Contoh: Semen Gresik 50kg..."
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Kode SKU</label>
                    <input 
                      type="text"
                      required
                      placeholder="SKU-XXXXXX"
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Kategori</label>
                    <select 
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-750 outline-none focus:bg-white focus:border-blue-500"
                    >
                      <option value="Cement & Mortar">Semen & Mortar</option>
                      <option value="Steel & Reinforcement">Baja & Besi Beton</option>
                      <option value="Concrete">Beton & Aggregate</option>
                      <option value="Paint & Coatings">Cat & Pelapis</option>
                      <option value="Electrical">Kelistrikan</option>
                      <option value="Metals">Logam & Profil</option>
                      <option value="Glazing">Kaca & Kusen</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Satuan Unit</label>
                    <select 
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-750 outline-none focus:bg-white focus:border-blue-500"
                    >
                      <option value="Sack">Sack / Zak</option>
                      <option value="Piece">Piece / Batang</option>
                      <option value="Gallon">Gallon / Pail</option>
                      <option value="Sheet">Sheet / Lembar</option>
                      <option value="Ton">Ton</option>
                      <option value="Meter">Meter</option>
                      <option value="Box">Box / Dus</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Harga Modal</label>
                    <input 
                      type="number"
                      required
                      min={0}
                      value={formRetailPrice}
                      onChange={(e) => setFormRetailPrice(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Harga Standard</label>
                    <input 
                      type="number"
                      required
                      min={0}
                      value={formWholesalePrice}
                      onChange={(e) => setFormWholesalePrice(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Harga Minimum</label>
                    <input 
                      type="number"
                      required
                      min={0}
                      value={formProjectPrice}
                      onChange={(e) => setFormProjectPrice(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Stok Awal</label>
                    <input 
                      type="number"
                      required
                      min={0}
                      value={formStock}
                      onChange={(e) => setFormStock(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Lokasi Gudang / Rak</label>
                    <input 
                      type="text"
                      required
                      placeholder="Contoh: Section A - Row 02"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Foto Produk</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Tempel URL gambar produk..."
                      value={formImage}
                      onChange={(e) => setFormImage(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-semibold text-gray-700 outline-none focus:bg-white focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => imageFileInputRef.current?.click()}
                      disabled={imageUploading}
                      className="px-3 bg-gray-900 hover:bg-black text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap flex items-center gap-1 disabled:opacity-60"
                    >
                      {imageUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Upload
                    </button>
                    <input ref={imageFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelect} />
                  </div>
                  {imageUploadError && <p className="text-[9px] text-red-500 font-bold mt-1">{imageUploadError}</p>}
                  {formImage && (
                    <img src={formImage} alt="Preview produk" className="mt-2 w-14 h-14 object-cover rounded-lg border border-gray-200" />
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowCreateModal(false)}
                    className="w-full py-2.5 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/15 cursor-pointer"
                  >
                    Simpan Produk
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Product Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[150] p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 my-8"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="font-black text-xs uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4" /> EDIT INFORMASI MATERIAL / PRODUK
                </span>
                <button onClick={() => setShowEditModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Nama Produk / Material</label>
                    <input 
                      type="text"
                      required
                      placeholder="Contoh: Semen Gresik 50kg..."
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Kode SKU (Tidak Dapat Diubah)</label>
                    <input 
                      type="text"
                      disabled
                      value={formSku}
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-gray-400 outline-none cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Kategori</label>
                    <select 
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-750 outline-none focus:bg-white focus:border-blue-500"
                    >
                      <option value="Cement & Mortar">Semen & Mortar</option>
                      <option value="Steel & Reinforcement">Baja & Besi Beton</option>
                      <option value="Concrete">Beton & Aggregate</option>
                      <option value="Paint & Coatings">Cat & Pelapis</option>
                      <option value="Electrical">Kelistrikan</option>
                      <option value="Metals">Logam & Profil</option>
                      <option value="Glazing">Kaca & Kusen</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Satuan Unit</label>
                    <select 
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-750 outline-none focus:bg-white focus:border-blue-500"
                    >
                      <option value="Sack">Sack / Zak</option>
                      <option value="Piece">Piece / Batang</option>
                      <option value="Gallon">Gallon / Pail</option>
                      <option value="Sheet">Sheet / Lembar</option>
                      <option value="Ton">Ton</option>
                      <option value="Meter">Meter</option>
                      <option value="Box">Box / Dus</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Harga Modal</label>
                    <input 
                      type="number"
                      required
                      min={0}
                      value={formRetailPrice}
                      onChange={(e) => setFormRetailPrice(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Harga Standard</label>
                    <input 
                      type="number"
                      required
                      min={0}
                      value={formWholesalePrice}
                      onChange={(e) => setFormWholesalePrice(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Harga Minimum</label>
                    <input 
                      type="number"
                      required
                      min={0}
                      value={formProjectPrice}
                      onChange={(e) => setFormProjectPrice(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Stok Gudang</label>
                    <input 
                      type="number"
                      required
                      min={0}
                      value={formStock}
                      onChange={(e) => setFormStock(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Lokasi Gudang / Rak</label>
                    <input 
                      type="text"
                      required
                      placeholder="Contoh: Section A - Row 02"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Foto Produk</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Tempel URL gambar produk..."
                      value={formImage}
                      onChange={(e) => setFormImage(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-semibold text-gray-700 outline-none focus:bg-white focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => imageFileInputRef.current?.click()}
                      disabled={imageUploading}
                      className="px-3 bg-gray-900 hover:bg-black text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap flex items-center gap-1 disabled:opacity-60"
                    >
                      {imageUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Upload
                    </button>
                    <input ref={imageFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelect} />
                  </div>
                  {imageUploadError && <p className="text-[9px] text-red-500 font-bold mt-1">{imageUploadError}</p>}
                  {formImage && (
                    <img src={formImage} alt="Preview produk" className="mt-2 w-14 h-14 object-cover rounded-lg border border-gray-200" />
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowEditModal(false)}
                    className="w-full py-2.5 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-500/15 cursor-pointer"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
