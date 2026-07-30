import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  User, 
  Trash2, 
  CreditCard, 
  QrCode, 
  Coins, 
  Plus, 
  Minus, 
  Printer as PrinterIcon, 
  UserPlus, 
  BadgePercent,
  Banknote,
  Store,
  Truck,
  FileDown,
  Sparkles,
  Barcode,
  Volume2,
  VolumeX,
  Camera,
  Play,
  X,
  Wallet,
  Package,
  SlidersHorizontal
} from 'lucide-react';
import { Product, Customer, SalesInvoice, Printer, BankAccount } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import ScannerModal from './components/ScannerModal';
import QRISModal from './components/QRISModal';
import CashPaymentModal from './components/CashPaymentModal';
import SplitPaymentModal from './components/SplitPaymentModal';
import ReceiptModal from './components/ReceiptModal';
import AddProductModal from './components/AddProductModal';
import AddCustomerModal from './components/AddCustomerModal';
import { recordSale } from '../../lib/cashSession';
import { getSupabaseTableCache } from '../../lib/supabaseCache';
import { useSupabaseTable } from '../../lib/useSupabaseTable';
import { playBeep, playPrintSound } from './lib/posAudio';
import { generateReceiptPDF } from './lib/receiptPdf';
import {
  CartItem,
  PersistedPOSState,
  readPersistedPOSState,
  writePersistedPOSState,
  clearPersistedPOSState
} from './lib/posCartStorage';
import { useDialog } from '../../components/shared/DialogProvider';
import NumberInput from '../../components/shared/NumberInput';

/** Resolves the actual unit price to charge for a cart line: the cashier's
 * edited price when present, otherwise falls back to the tier derived from
 * selectedPriceType (kept for carts/invoices persisted before per-line
 * price editing existed). */
const getCartItemPrice = (item: CartItem) => {
  if (typeof item.customPrice === 'number' && item.customPrice > 0) return item.customPrice;
  return item.selectedPriceType === 'retail' ? item.product.retailPrice :
         item.selectedPriceType === 'wholesale' ? item.product.wholesalePrice :
         item.product.projectPrice;
};

interface CheckoutPaymentDetails {
  /** Cash payments: physical amount tendered by the customer. */
  cashReceived?: number;
  /** Cash payments: change handed back (cashReceived - total). */
  changeAmount?: number;
  /** Split payments: amount paid at checkout time. */
  splitPaidAmount?: number;
  /** Split payments: remainder recorded as the customer's piutang. */
  splitRemainingDebt?: number;
}

interface StoreProfileLite {
  storeName: string;
  address?: string;
  phone?: string;
  receiptNote?: string;
  taxId?: string;
}

interface POSViewProps {
  products: Product[];
  customers: Customer[];
  onUpdateProducts: (updatedProducts: Product[]) => void;
  onUpdateCustomers: (updatedCustomers: Customer[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote') => void;
  onAddSaleToKPIs: (salesAmount: number) => void;
  onRecordSale?: (invoice: SalesInvoice) => void;
  cashierName?: string;
  storeProfile?: StoreProfileLite;
  onExitFullScreen?: () => void;
}

export default function POSView({ 
  products, 
  customers, 
  onUpdateProducts, 
  onUpdateCustomers, 
  onAddActivity,
  onAddSaleToKPIs,
  onRecordSale,
  cashierName,
  storeProfile,
  onExitFullScreen,
}: POSViewProps) {
  const dialog = useDialog();
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua Kategori');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(customers[0] || {
    id: 'CUST-01',
    name: 'Customer',
    loyaltyTier: 'Pelanggan Retail',
    points: 0,
    currentDebt: 0,
    totalPurchases: 0,
    debtStatus: 'Cleared',
    logoLetters: 'PU',
    lastTransactions: []
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountMode, setDiscountMode] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'Pickup' | 'Delivery'>('Pickup');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QRIS' | 'Split' | 'Deposit'>('Cash');
  const [isCartPersistenceEnabled, setIsCartPersistenceEnabled] = useState(false);
  const [showCheckoutReceipt, setShowCheckoutReceipt] = useState(false);
  const [lastOrderDetails, setLastOrderDetails] = useState<any>(null);
  const [showQRISModal, setShowQRISModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  // Store's saved bank/e-wallet/QRIS accounts (managed in Pengaturan > Daftar
  // Rekening) — read here only to pull the QRIS code image for the payment
  // modal, never written from the POS screen.
  const [bankAccounts] = useSupabaseTable<BankAccount>('bank_accounts', [], (b) => b.id);
  const qrisImageUrl = bankAccounts.find((acc) => acc.type === 'QRIS' && acc.qrisImageUrl)?.qrisImageUrl;
  const [mobileActiveSubTab, setMobileActiveSubTab] = useState<'products' | 'cart'>('products');
  
  // Audio & scanner simulation states
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scanningLineActive, setScanningLineActive] = useState(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState('');
  const [isPrintingAnim, setIsPrintingAnim] = useState(false);
  const [activePrinterName, setActivePrinterName] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('Siap memindai barcode');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // New Custom Add Customer states
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  // New Product quick add states
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Cement & Mortar');
  const [newProductUnit, setNewProductUnit] = useState('pcs');
  const [newProductRetailPrice, setNewProductRetailPrice] = useState('');
  const [newProductWholesalePrice, setNewProductWholesalePrice] = useState('');
  const [newProductProjectPrice, setNewProductProjectPrice] = useState('');
  const [newProductStock, setNewProductStock] = useState('');

  // Filter Categories — derived from the products actually in stock, same
  // approach as the Stok (ProductsView) page, so a store never sees filter
  // pills for categories it doesn't carry.
  const categories = ['Semua Kategori', ...Array.from(new Set(products.map((p) => p.category)))];

  // Map category displays to Indonesian (for visual look)
  const categoryTranslationMap: Record<string, string> = {
    'Semua Kategori': 'Semua Kategori',
    'Cement & Mortar': 'Semen & Semen Mortar',
    'Paint & Coatings': 'Cat & Pelapis',
    'Steel & Reinforcement': 'Besi & Baja Beton',
    'Electrical': 'Alat Listrik',
    'Metals': 'Logam Bangunan',
    'Concrete': 'Beton Cor',
    'Glazing': 'Kaca & Keramik'
  };

  // Filtered Products
  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory === 'Semua Kategori' || prod.category === selectedCategory;
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          prod.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddCustomer = (name: string, loyaltyTier: string) => {
    const nextId = `CUST-${Math.floor(10000 + Math.random() * 90000)}`;
    const newC: Customer = {
      id: nextId,
      name,
      loyaltyTier,
      points: 100, // default sign up points!
      currentDebt: 0,
      totalPurchases: 0,
      debtStatus: "Cleared",
      logoLetters: name.slice(0, 2).toUpperCase(),
      lastTransactions: []
    };

    onUpdateCustomers([newC, ...customers]);
    setSelectedCustomer(newC);
    setShowAddCustomerModal(false);

    onAddActivity(
      `Pendaftaran Pelanggan`,
      `Pelanggan baru "${name}" berhasil didaftarkan`,
      0,
      'quote'
    );
  };

  const handleCreateAndAddProduct = (e: React.FormEvent) => {
    e.preventDefault();

    const name = newProductName.trim();
    const sku = newProductSku.trim().toUpperCase();
    const wholesalePrice = Number(newProductWholesalePrice) || 0;
    // Harga Modal (retailPrice) is hidden from this quick-add form — mirror
    // the standard price so stock-value reports elsewhere don't read 0.
    const retailPrice = wholesalePrice;
    const projectPrice = Number(newProductProjectPrice) || 0;
    const stock = Math.max(0, Number(newProductStock) || 0);

    if (!name || !sku) {
      dialog.alert('Nama barang dan SKU wajib diisi.');
      return;
    }

    if (products.some((prod) => prod.sku.toLowerCase() === sku.toLowerCase())) {
      dialog.alert(`SKU "${sku}" sudah ada di sistem. Gunakan SKU lain.`);
      return;
    }

    const stockStatus: Product['stockStatus'] = stock === 0 ? 'Out of Stock' : stock <= 15 ? 'Low Stock' : 'Healthy';
    const newProduct: Product = {
      name,
      sku,
      category: newProductCategory,
      unit: newProductUnit,
      retailPrice,
      wholesalePrice,
      projectPrice,
      stock,
      stockStatus,
      lastRestock: new Date().toLocaleDateString('id-ID'),
      leadTime: 'Hari ini',
      warehouseLocation: 'POS-QuickAdd',
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80'
    };

    const updatedProducts = [newProduct, ...products];
    onUpdateProducts(updatedProducts);

    setCart((prev) => [...prev, {
      product: newProduct,
      quantity: 1,
      selectedPriceType: 'wholesale',
      customPrice: newProduct.wholesalePrice,
      notes: ''
    }]);
    setSelectedCategory('Semua Kategori');
    setSearchQuery('');
    setMobileActiveSubTab('cart');
    setShowAddProductModal(false);
    setNewProductName('');
    setNewProductSku('');
    setNewProductCategory('Cement & Mortar');
    setNewProductUnit('pcs');
    setNewProductRetailPrice('');
    setNewProductWholesalePrice('');
    setNewProductProjectPrice('');
    setNewProductStock('');

    onAddActivity(
      'Barang Baru ditambahkan',
      `"${name}" ditambahkan dari POS dan langsung masuk keranjang`,
      0,
      'arrival'
    );
  };

  // Add to cart
  const handleAddToCart = (prod: Product, quiet = false) => {
    if (prod.stock <= 0) {
      dialog.alert("Stok barang habis! Silakan buat pesanan PO di tab Pembelian terlebih dahulu.");
      return;
    }

    if (!quiet) {
      playBeep(soundEnabled);
    }

    const existingIdx = cart.findIndex(item => item.product.sku === prod.sku);
    if (existingIdx > -1) {
      const updated = [...cart];
      if (updated[existingIdx].quantity + 1 > prod.stock) {
        dialog.alert("Jumlah melebihi stok fisik gudang!");
        return;
      }
      updated[existingIdx].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, {
        product: prod,
        quantity: 1,
        selectedPriceType: 'wholesale',
        customPrice: prod.wholesalePrice,
        notes: ''
      }]);
    }
  };

  const stopCameraPreview = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setScanningLineActive(false);
  }, []);

  const startCameraPreview = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Browser ini belum mendukung akses kamera.');
      setScannerStatus('Kamera tidak tersedia');
      return;
    }

    try {
      setCameraError(null);
      setScannerStatus('Mengakses kamera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setScanningLineActive(true);
      setScannerStatus('Arahkan kamera ke barcode');
    } catch (error) {
      console.error('Kamera tidak bisa dibuka:', error);
      setCameraError('Izin kamera ditolak atau kamera tidak tersedia.');
      setScannerStatus('Kamera tidak tersedia');
      setScanningLineActive(false);
    }
  }, []);

  const handleBarcodeScan = useCallback((barcodeSku: string) => {
    const matchedProduct = products.find((p) => p.sku === barcodeSku);
    if (matchedProduct) {
      playBeep(soundEnabled);
      handleAddToCart(matchedProduct, true);
      setScanSuccessMessage(`BERHASIL DISCAN: ${matchedProduct.name}`);
      setShowScannerModal(false);
      stopCameraPreview();
      setTimeout(() => setScanSuccessMessage(''), 2200);
    } else {
      setScannerStatus(`Barcode "${barcodeSku}" tidak ditemukan`);
      dialog.alert(`Barcode SKU "${barcodeSku}" tidak ditemukan.`);
    }
  }, [products, playBeep, stopCameraPreview]);

  // Adjust cart item quantity
  const handleUpdateQty = (sku: string, delta: number) => {
    const updated = cart.map((item) => {
      if (item.product.sku === sku) {
        const targetQty = item.quantity + delta;
        if (targetQty <= 0) return null;
        if (targetQty > item.product.stock) {
          dialog.alert("Jumlah tidak boleh melebihi stok fisik di gudang!");
          return item;
        }

        return { ...item, quantity: targetQty };
      }
      return item;
    }).filter(Boolean) as CartItem[];

    setCart(updated);
  };

  // Delete from cart
  const handleDeleteCartItem = (sku: string) => {
    setCart(cart.filter(item => item.product.sku !== sku));
  };

  const handleToggleCartPersistence = () => {
    const nextState = !isCartPersistenceEnabled;

    if (nextState) {
      const persistedState = readPersistedPOSState();
      if (persistedState.cart.length > 0 || persistedState.selectedCustomerId || persistedState.discountValue > 0 || persistedState.paymentMethod !== 'Cash') {
        setCart(persistedState.cart);
        const restoredCustomer = persistedState.selectedCustomerId
          ? customers.find((customer) => customer.id === persistedState.selectedCustomerId)
          : null;
        if (restoredCustomer) {
          setSelectedCustomer(restoredCustomer);
        }
        setDiscountMode(persistedState.discountMode);
        setDiscountValue(persistedState.discountValue);
        setPaymentMethod(persistedState.paymentMethod);
        setFulfillmentMethod(persistedState.fulfillmentMethod);
        setDeliveryAddress(persistedState.deliveryAddress);
      }
    } else {
      clearPersistedPOSState();
    }

    setIsCartPersistenceEnabled(nextState);
  };

  // Cart Calculations
  const getCartSubtotal = () => {
    return cart.reduce((acc, item) => acc + (getCartItemPrice(item) * item.quantity), 0);
  };

  const subtotal = getCartSubtotal();
  // PPN 11% dinonaktifkan sementara atas permintaan toko — tinggal aktifkan
  // lagi dengan menambahkan baris `subtotal * 0.11` ke totalAmount kalau
  // suatu saat dibutuhkan lagi.
  const discountAmount = discountMode === 'fixed'
    ? Math.min(discountValue, subtotal)
    : subtotal * (Math.min(100, Math.max(0, discountValue)) / 100);
  const totalAmount = subtotal - discountAmount;

  // Checkout Execution
  const handleCheckout = () => {
    if (cart.length === 0) {
      dialog.alert("Keranjang belanja kosong.");
      return;
    }

    if (paymentMethod === 'Deposit') {
      const depositBal = selectedCustomer.depositBalance || 0;
      if (depositBal < totalAmount) {
        dialog.alert(`Saldo deposit tidak mencukupi!\nSaldo saat ini: Rp ${depositBal.toLocaleString('id-ID')}\nTotal belanja: Rp ${totalAmount.toLocaleString('id-ID')}`);
        return;
      }
    }

    if (paymentMethod === 'QRIS') {
      setShowQRISModal(true);
      return;
    }

    if (paymentMethod === 'Cash') {
      setShowCashModal(true);
      return;
    }

    if (paymentMethod === 'Split') {
      setShowSplitModal(true);
      return;
    }

    executeFinalCheckout();
  };

  // Called after the cashier confirms the amount of physical cash received
  // in CashPaymentModal. Change is derived (never negative — the modal
  // already blocks confirming an insufficient amount).
  const handleConfirmCashPayment = (cashReceived: number) => {
    setShowCashModal(false);
    executeFinalCheckout({ cashReceived, changeAmount: cashReceived - totalAmount });
  };

  // Called after the cashier confirms a partial ("DP") payment in
  // SplitPaymentModal. The unpaid remainder is added to the customer's
  // piutang (currentDebt) inside executeFinalCheckout.
  const handleConfirmSplitPayment = (paidNow: number) => {
    setShowSplitModal(false);
    executeFinalCheckout({ splitPaidAmount: paidNow, splitRemainingDebt: totalAmount - paidNow });
  };

  const executeFinalCheckout = (paymentDetails?: CheckoutPaymentDetails) => {
    // Generate Invoice ID
    const invNumber = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    // Deduct physical stocks
    const updatedProducts = products.map((prod) => {
      const cartItem = cart.find(item => item.product.sku === prod.sku);
      if (cartItem) {
        const nextStock = Math.max(0, prod.stock - cartItem.quantity);
        let nextStatus: 'Healthy' | 'Low Stock' | 'Out of Stock' = 'Healthy';
        if (nextStock === 0) nextStatus = 'Out of Stock';
        else if (nextStock <= 15) nextStatus = 'Low Stock';

        return {
          ...prod,
          stock: nextStock,
          stockStatus: nextStatus
        };
      }
      return prod;
    });
    onUpdateProducts(updatedProducts);

    // Increment customer loyalty points (1 point per Rp 10.000 spent)
    const pointsEarned = Math.floor(totalAmount / 10000);
    const splitRemainingDebt = paymentMethod === 'Split' ? Math.max(0, paymentDetails?.splitRemainingDebt || 0) : 0;
    const updatedCustomers = customers.map((cust) => {
      if (cust.id === selectedCustomer.id) {
        const currentDeposit = cust.depositBalance || 0;
        const nextDeposit = paymentMethod === 'Deposit' ? Math.max(0, currentDeposit - totalAmount) : currentDeposit;
        const nextDebt = (cust.currentDebt || 0) + splitRemainingDebt;

        // Auto-schedule the piutang due date from this customer's tempo
        // terms (defaults to 30 hari when unset). If they already have an
        // earlier outstanding due date, keep that one — a new split
        // shouldn't push an older, more urgent debt's deadline back.
        let nextDueDate = cust.nextDueDate;
        if (splitRemainingDebt > 0) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (cust.tempoDays || 30));
          const computedDueDate = dueDate.toISOString().split('T')[0];
          nextDueDate = cust.nextDueDate && cust.nextDueDate < computedDueDate ? cust.nextDueDate : computedDueDate;
        }

        return {
          ...cust,
          points: cust.points + pointsEarned,
          totalPurchases: cust.totalPurchases + totalAmount,
          depositBalance: nextDeposit,
          currentDebt: nextDebt,
          debtStatus: splitRemainingDebt > 0 ? 'Pending' : cust.debtStatus,
          nextDueDate
        };
      }
      return cust;
    });
    onUpdateCustomers(updatedCustomers);

    // Also link to Kas Harian session — only the physical cash actually
    // received moves the drawer: the full total for a Cash sale, or just
    // the amount paid now for a Split/DP sale (the remainder is piutang,
    // not cash in hand).
    const stockQtySold = cart.reduce((acc, i) => acc + i.quantity, 0);
    const cashDrawerAmount = paymentMethod === 'Cash'
      ? totalAmount
      : paymentMethod === 'Split'
        ? (paymentDetails?.splitPaidAmount || 0)
        : 0;
    recordSale(paymentMethod === 'Cash' || (paymentMethod === 'Split' && cashDrawerAmount > 0), cashDrawerAmount, stockQtySold, invNumber);

    // Register this invoice so it can be looked up later from the Retur module
    if (onRecordSale) {
      onRecordSale({
        invoiceNumber: invNumber,
        customerName: selectedCustomer.name,
        customerId: selectedCustomer.id,
        date: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
        createdAt: new Date().toISOString(),
        items: cart.map((item) => ({
          sku: item.product.sku,
          name: item.product.name,
          quantity: item.quantity,
          price: getCartItemPrice(item),
          unit: item.product.unit
        })),
        total: totalAmount,
        paymentMethod,
        subtotal,
        discountAmount,
        discountType: discountMode,
        discountValue,
        fulfillmentMethod,
        deliveryAddress: fulfillmentMethod === 'Delivery' ? deliveryAddress : undefined,
        cashReceived: paymentMethod === 'Cash' ? paymentDetails?.cashReceived : undefined,
        changeAmount: paymentMethod === 'Cash' ? paymentDetails?.changeAmount : undefined,
        splitPaidAmount: paymentMethod === 'Split' ? paymentDetails?.splitPaidAmount : undefined,
        splitRemainingDebt: paymentMethod === 'Split' ? splitRemainingDebt : undefined
      });
    }

    // Save logs
    const orderDetails = {
      invoice: invNumber,
      customerName: selectedCustomer.name,
      items: [...cart],
      subtotal,
      discount: discountAmount,
      discountType: discountMode,
      discountValue,
      fulfillmentMethod,
      deliveryAddress,
      total: totalAmount,
      pointsEarned,
      paymentMethod,
      cashReceived: paymentMethod === 'Cash' ? paymentDetails?.cashReceived : undefined,
      changeAmount: paymentMethod === 'Cash' ? paymentDetails?.changeAmount : undefined,
      splitPaidAmount: paymentMethod === 'Split' ? paymentDetails?.splitPaidAmount : undefined,
      splitRemainingDebt: paymentMethod === 'Split' ? splitRemainingDebt : undefined,
      date: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    setLastOrderDetails(orderDetails);
    setShowCheckoutReceipt(true);
    onAddSaleToKPIs(totalAmount);

    // Add activity stream event
    onAddActivity(
      `Penjualan POS: ${invNumber}`,
      `Selesai untuk ${selectedCustomer.name} • ${cart.reduce((acc, i) => acc + i.quantity, 0)} barang`,
      totalAmount,
      'sale'
    );

    // Clear cart
    setCart([]);
    setDiscountMode('percent');
    setDiscountValue(0);
    setFulfillmentMethod('Pickup');
    setDeliveryAddress('');
    setShowQRISModal(false);
    setMobileActiveSubTab('products');
  };

  // Trigger simulated receipt feed
  const handlePrintReceiptSim = () => {
    // Printers are registered in Supabase (shared across devices); whether
    // one is actually connected right now is local to whichever browser
    // paired it in Pengaturan > Printer, so this only checks that at least
    // one printer is registered — not live connection state.
    const registeredPrinters = getSupabaseTableCache<Printer>('printers');
    const hasRegisteredPrinter = registeredPrinters.length > 0;
    const connectedPrinterName = registeredPrinters[0]?.name || "Printer Kasir";

    if (!hasRegisteredPrinter) {
      dialog.alert("PENCETAKAN GAGAL:\nBelum ada printer yang terdaftar! Silakan masuk ke tab 'Pengaturan' -> 'Printer' untuk menambahkan dan menyambungkan printer kasir.");
      return;
    }

    setIsPrintingAnim(true);
    setActivePrinterName(connectedPrinterName);
    playPrintSound(soundEnabled);
    
    setTimeout(() => {
      setIsPrintingAnim(false);
      // Trigger native print dialog for compliant design
      window.print();
    }, 1800);
  };

  // Generates and downloads an actual PDF file of the receipt — separate
  // from handlePrintReceiptSim, which opens the browser print dialog aimed
  // at a physical thermal printer.
  const handlePrintPDF = () => {
    if (!lastOrderDetails) return;
    setIsGeneratingPDF(true);
    try {
      generateReceiptPDF(lastOrderDetails, storeProfile, cashierName);
    } catch (err) {
      dialog.alert('Gagal membuat PDF struk. Silakan coba lagi.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Keyboard listeners for POS shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        const inp = document.getElementById('barcode-search-input');
        if (inp) inp.focus();
      }
      if (e.key === 'F12') {
        e.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, paymentMethod, totalAmount, selectedCustomer]);

  useEffect(() => {
    if (!showScannerModal) {
      stopCameraPreview();
      return;
    }

    void startCameraPreview();

    return () => {
      stopCameraPreview();
    };
  }, [showScannerModal, startCameraPreview, stopCameraPreview]);

  useEffect(() => {
    if (!showScannerModal || !cameraReady || !videoRef.current || typeof window === 'undefined') {
      return;
    }

    if (!(window as any).BarcodeDetector) {
      setScannerStatus('Browser ini belum mendukung deteksi barcode dari kamera');
      return;
    }

    const detector = new (window as any).BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e']
    });
    let cancelled = false;

    const scanLoop = async () => {
      if (cancelled || !videoRef.current || !cameraReady) return;

      try {
        const barcodes = await detector.detect(videoRef.current);
        if (!cancelled && barcodes.length > 0) {
          const detectedCode = barcodes[0]?.rawValue;
          if (detectedCode) {
            handleBarcodeScan(detectedCode);
            return;
          }
        }
      } catch (error) {
        console.error('Deteksi barcode gagal:', error);
      }

      if (!cancelled) {
        window.setTimeout(scanLoop, 500);
      }
    };

    void scanLoop();

    return () => {
      cancelled = true;
    };
  }, [cameraReady, handleBarcodeScan, showScannerModal]);

  useEffect(() => {
    if (!isCartPersistenceEnabled) return;

    const payload: PersistedPOSState = {
      cart,
      selectedCustomerId: selectedCustomer.id,
      discountMode,
      discountValue,
      paymentMethod,
      fulfillmentMethod,
      deliveryAddress
    };

    writePersistedPOSState(payload);
  }, [cart, discountMode, discountValue, isCartPersistenceEnabled, paymentMethod, fulfillmentMethod, deliveryAddress, selectedCustomer.id]);

  return (
    <div className="flex flex-col gap-4 h-screen p-4 md:p-6 relative">
      {/* Slim top bar replacing the app header/sidebar while in full-screen POS mode */}
      {onExitFullScreen && (
        <div className="flex items-center justify-between shrink-0">
          <button
            onClick={onExitFullScreen}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Kembali</span>
          </button>
          <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
            {storeProfile?.storeName && <span className="text-gray-800">{storeProfile.storeName}</span>}
            {cashierName && <span className="text-gray-400">Kasir: {cashierName}</span>}
          </div>
        </div>
      )}

      {/* Mobile Tab Swapper (Header) */}
      <div className="flex md:hidden bg-slate-100 p-1 rounded-xl border border-slate-200/50 w-full shrink-0">
        <button
          onClick={() => setMobileActiveSubTab('products')}
          className={`flex-1 py-2.5 text-center rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            mobileActiveSubTab === 'products' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/30 font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Daftar Barang
        </button>
        <button
          onClick={() => setMobileActiveSubTab('cart')}
          className={`flex-1 py-2.5 text-center rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileActiveSubTab === 'cart' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/30 font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Keranjang Belanja</span>
          {cart.length > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
              {cart.reduce((acc, item) => acc + item.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Panel: Categories & Product Grid */}
        <div className={`lg:col-span-8 flex flex-col justify-between space-y-4 min-h-0 h-full ${mobileActiveSubTab === 'products' ? 'flex' : 'hidden lg:flex'}`}>
        
        {/* Search and Shortcuts Headers with Barcode scanner option */}
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-xs">
          
          {/* Scan barcode input */}
          <div className="relative w-full xl:max-w-md flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 group">
              <Barcode className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                id="barcode-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama bahan bangunan atau scan (F1)..."
                className="w-full bg-gray-50 border-none rounded-lg pl-10 pr-12 py-2 text-xs focus:ring-2 focus:ring-blue-600/15 outline-none text-gray-900"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] bg-gray-200 text-gray-500 px-1 py-0.5 rounded font-black font-mono">F1</span>
            </div>

            <div className="flex gap-2">
              {/* Quick add product button */}
              <button
                onClick={() => setShowAddProductModal(true)}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer"
                title="Tambah Barang Baru Langsung dari POS"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Barang</span>
              </button>

              {/* Simulated hardware scanning button */}
              <button
                onClick={() => {
                  setShowScannerModal(true);
                  setScanningLineActive(true);
                }}
                className="flex-1 sm:flex-none px-3.5 py-2 nm-btn text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer"
                title="Simulator Pemindai Barcode"
              >
                <Camera className="w-4 h-4 animate-pulse" />
                <span>Pindai Barcode</span>
              </button>
            </div>
          </div>

          {/* Sound enable switch & Customer Selection Quick View */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowCategoryFilter(!showCategoryFilter)}
              className={`px-3 py-2 border rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-all whitespace-nowrap ${
                showCategoryFilter ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter</span>
              {selectedCategory !== 'Semua Kategori' && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              )}
            </button>

            <button
              onClick={handleToggleCartPersistence}
              className={`px-3 py-2 rounded-lg border text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isCartPersistenceEnabled
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {isCartPersistenceEnabled ? 'Simpan Keranjang Aktif' : 'Aktifkan Simpan Keranjang'}
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 nm-btn text-gray-500 hover:text-gray-800 rounded-lg cursor-pointer shrink-0"
              title={soundEnabled ? "Matikan Suara Beep" : "Aktifkan Suara Beep"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-red-500" />}
            </button>

            <div className="flex items-center gap-2 bg-blue-100/40 text-blue-800 px-3.5 py-1.5 rounded-lg border border-blue-200 text-xs font-bold whitespace-nowrap">
              <User className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-[160px]">Pembeli: {selectedCustomer.name}</span>
            </div>
          </div>
        </div>

        {/* Scan successful banner feedback */}
        <AnimatePresence>
          {scanSuccessMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-500 text-white py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-2">
                <span className="animate-ping w-2.5 h-2.5 bg-white rounded-full"></span>
                <span>{scanSuccessMessage}</span>
              </div>
              <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded font-mono font-bold uppercase">BEEP!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter Drawer — Pilih Kategori only (no status filter on POS) */}
        <AnimatePresence>
          {showCategoryFilter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white border border-gray-200 rounded-xl p-4 overflow-hidden text-xs"
            >
              <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Pilih Kategori</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:max-w-xs bg-gray-50 border border-gray-200 rounded-lg p-2 font-semibold text-gray-700 outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{categoryTranslationMap[cat] || cat}</option>
                ))}
              </select>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Products Grid Canvas */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 auto-rows-max gap-4 pr-1 content-start">
          {filteredProducts.map((prod) => (
            <motion.div 
              whileTap={{ scale: 0.98 }}
              onClick={() => handleAddToCart(prod)}
              key={prod.sku}
              className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col justify-between shadow-xs hover:border-blue-600 cursor-pointer group transition-all"
            >
              {/* Product Thumbnail */}
              <div className="w-full h-28 rounded-lg overflow-hidden bg-gray-50 relative border border-gray-100 mb-3">
                {/* Fallback icon shown when the image fails to load (broken/expired URL) */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-300" />
                </div>
                <img 
                  src={prod.image} 
                  alt={prod.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 relative"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                  onLoad={(e) => { e.currentTarget.style.visibility = 'visible'; }}
                />
                <span className={`absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                  prod.stockStatus === 'Healthy' ? 'bg-emerald-100 text-emerald-800' : 
                  prod.stockStatus === 'Low Stock' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }`}>
                  STOK: {prod.stock}
                </span>
              </div>

              {/* Descriptions */}
              <div>
                <p className="text-xs font-black text-gray-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{prod.name}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">{prod.sku}</p>
              </div>

              {/* Price Details — shows Harga Standard, not Harga Modal/Minimum */}
              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-black text-gray-950">Rp {prod.wholesalePrice.toLocaleString('id-ID')}</span>
                <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded uppercase">
                  {prod.unit}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right Panel: POS Shopping Cart */}
      <div className={`lg:col-span-4 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden min-h-0 self-start max-h-[calc(100vh-140px)] ${mobileActiveSubTab === 'cart' ? 'flex' : 'hidden lg:flex'}`}>
        
        {/* Customer select box */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">PILIH PELANGGAN</label>
              <select 
                value={selectedCustomer.id}
                onChange={(e) => {
                  const match = customers.find(c => c.id === e.target.value);
                  if (match) setSelectedCustomer(match);
                }}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 font-bold text-xs text-gray-800 outline-none focus:ring-2 focus:ring-blue-600/15"
              >
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button 
              onClick={() => setShowAddCustomerModal(true)}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer mt-4"
              title="Tambah Pelanggan Baru"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
          {selectedCustomer && (
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-extrabold bg-white/60 border border-gray-100/40 rounded-lg p-1.5 px-2">
              <span className="flex items-center gap-1">⭐ {selectedCustomer.points || 0} Poin</span>
              <span className="flex items-center gap-1 text-emerald-600">💰 Rp {(selectedCustomer.depositBalance || 0).toLocaleString('id-ID')}</span>
              {selectedCustomer.currentDebt > 0 && (
                <span className="text-red-500 font-bold">⚠️ Utang: Rp {selectedCustomer.currentDebt.toLocaleString('id-ID')}</span>
              )}
            </div>
          )}
        </div>

        {/* Shopping Cart List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
              <span className="text-3xl mb-1">🛒</span>
              <p className="font-bold text-xs uppercase tracking-wider">Keranjang Kosong</p>
              <p className="text-[10px] text-gray-400 mt-1 max-w-[180px]">Pilih barang bangunan dari daftar kiri atau scan barcode.</p>
            </div>
          ) : (
            cart.map((item) => {
              const price = getCartItemPrice(item);
              const lineTotal = price * item.quantity;
              const minPrice = item.product.projectPrice;
              const maxPrice = item.product.wholesalePrice;

              return (
                <div key={item.product.sku} className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-2 relative group">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-xs text-gray-950 truncate pr-6">{item.product.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{item.product.sku}</p>
                    </div>
                    {/* Delete action */}
                    <button 
                      onClick={() => handleDeleteCartItem(item.product.sku)}
                      className="text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Pricing: shows Harga Minimum as a reference, price itself is editable
                      and clamped to [Harga Minimum, Harga Standard] */}
                  <div className="bg-white p-2 rounded-lg border border-gray-100 text-xs space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] font-bold uppercase text-gray-400">
                      <span>Harga Minimum: Rp {minPrice.toLocaleString('id-ID')}</span>
                      <span className="font-black text-blue-600 text-xs normal-case">Rp {lineTotal.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 font-bold">Rp</span>
                      <NumberInput
                        value={price}
                        min={minPrice}
                        max={maxPrice}
                        onChange={(v) => {
                          const updated = cart.map(it => it.product.sku === item.product.sku ? { ...it, customPrice: v } : it);
                          setCart(updated);
                        }}
                        className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 font-extrabold text-gray-800 outline-none focus:ring-2 focus:ring-blue-600/15"
                      />
                      <span className="text-gray-400 shrink-0">/ {item.product.unit}</span>
                    </div>
                  </div>

                  {/* Quantity control */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 border border-gray-200 bg-white rounded-lg p-1">
                      <button 
                        onClick={() => handleUpdateQty(item.product.sku, -1)}
                        className="w-6 h-6 hover:bg-gray-100 rounded flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      <span className="w-8 text-center text-xs font-black text-gray-800">{item.quantity}</span>
                      <button 
                        onClick={() => handleUpdateQty(item.product.sku, 1)}
                        className="w-6 h-6 hover:bg-gray-100 rounded flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Calculations / Actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-4">
          
          {/* Quick calculations */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span className="font-bold">Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center text-gray-500">
              <span className="flex items-center gap-1">
                {discountMode === 'percent' ? <BadgePercent className="w-4 h-4 text-blue-600" /> : <Banknote className="w-4 h-4 text-blue-600" />}
                Diskon Promo
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDiscountMode('percent')}
                  title="Diskon persen (%)"
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black border cursor-pointer transition-colors ${
                    discountMode === 'percent' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountMode('fixed')}
                  title="Potongan harga langsung (Rp)"
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black border cursor-pointer transition-colors ${
                    discountMode === 'fixed' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  Rp
                </button>
                <NumberInput
                  value={discountValue}
                  max={discountMode === 'percent' ? 100 : undefined}
                  onChange={(v) => setDiscountValue(v)}
                  className="w-16 bg-white border border-gray-200 rounded p-1 text-right font-bold text-xs"
                />
              </div>
            </div>
            <div className="flex justify-between text-blue-600 font-black text-sm pt-2.5 border-t border-gray-200">
              <span>Total Akhir</span>
              <span>Rp {totalAmount.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Fulfillment Method: pickup vs delivery, chosen before checkout */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pengambilan Barang</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setFulfillmentMethod('Pickup')}
                className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                  fulfillmentMethod === 'Pickup' ? 'bg-blue-50 border-blue-600 text-blue-600 font-black' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Ambil Sendiri</span>
              </button>
              <button
                onClick={() => setFulfillmentMethod('Delivery')}
                className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                  fulfillmentMethod === 'Delivery' ? 'bg-blue-50 border-blue-600 text-blue-600 font-black' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Diantar</span>
              </button>
            </div>
            {fulfillmentMethod === 'Delivery' && (
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Alamat pengiriman (opsional)"
                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-[11px]"
              />
            )}
          </div>

          {/* Payment Toggle methods */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => setPaymentMethod('Cash')}
              className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1.5 ${
                paymentMethod === 'Cash' ? 'bg-blue-50 border-blue-600 text-blue-600 font-black' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Tunai</span>
            </button>

            <button
              onClick={() => setPaymentMethod('QRIS')}
              className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1.5 ${
                paymentMethod === 'QRIS' ? 'bg-blue-50 border-blue-600 text-blue-600 font-black' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QRIS</span>
            </button>

            <button
              onClick={() => setPaymentMethod('Split')}
              className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1.5 ${
                paymentMethod === 'Split' ? 'bg-blue-50 border-blue-600 text-blue-600 font-black' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Bayar Sebagian</span>
            </button>

            <button
              onClick={() => setPaymentMethod('Deposit')}
              className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1.5 ${
                paymentMethod === 'Deposit' ? 'bg-blue-50 border-blue-600 text-blue-600 font-black' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
              title={`Saldo Deposit: Rp ${(selectedCustomer?.depositBalance || 0).toLocaleString('id-ID')}`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Deposit</span>
            </button>
          </div>

          {/* Checkout Button CTA */}
          <button 
            onClick={handleCheckout}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/15 cursor-pointer transition-colors"
          >
            Bayar &amp; Cetak Struk (F12)
          </button>
        </div>
      </div>
    </div>

      {/* Floating Bottom Cart Bar for mobile - ONLY shown when on 'products' tab and cart has items */}
      {cart.length > 0 && mobileActiveSubTab === 'products' && (
        <div className="fixed bottom-[74px] left-4 right-4 z-[90] md:hidden bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-xl shadow-blue-900/30 border border-blue-500/30 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex flex-col">
            <span className="text-[9px] text-blue-100 font-extrabold uppercase tracking-widest">
              {cart.reduce((acc, item) => acc + item.quantity, 0)} Barang di Keranjang
            </span>
            <span className="text-sm font-black">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
          </div>
          <button
            onClick={() => setMobileActiveSubTab('cart')}
            className="bg-white hover:bg-slate-50 text-blue-600 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer transition-transform active:scale-95 flex items-center gap-1.5"
          >
            <span>Buka Keranjang</span>
            <span className="text-sm font-bold">→</span>
          </button>
        </div>
      )}


      {/* Modals */}
      <AnimatePresence>
        {showScannerModal && (
          <ScannerModal
            onClose={() => { setShowScannerModal(false); stopCameraPreview(); }}
            cameraReady={cameraReady}
            cameraError={cameraError}
            scanningLineActive={scanningLineActive}
            scannerStatus={scannerStatus}
            videoRef={videoRef}
            products={products}
            onSelectProduct={handleBarcodeScan}
            onStartCamera={() => void startCameraPreview()}
            onStopCamera={() => { stopCameraPreview(); setScannerStatus('Kamera dihentikan'); }}
          />
        )}

        {showQRISModal && (
          <QRISModal
            onClose={() => setShowQRISModal(false)}
            onConfirm={executeFinalCheckout}
            totalAmount={totalAmount}
            qrisImageUrl={qrisImageUrl}
          />
        )}

        {showCashModal && (
          <CashPaymentModal
            onClose={() => setShowCashModal(false)}
            onConfirm={handleConfirmCashPayment}
            totalAmount={totalAmount}
          />
        )}

        {showSplitModal && (
          <SplitPaymentModal
            onClose={() => setShowSplitModal(false)}
            onConfirm={handleConfirmSplitPayment}
            totalAmount={totalAmount}
            customer={selectedCustomer}
          />
        )}

        {showCheckoutReceipt && lastOrderDetails && (
          <ReceiptModal
            onClose={() => setShowCheckoutReceipt(false)}
            onPrint={handlePrintReceiptSim}
            onPrintPDF={handlePrintPDF}
            isPrintingAnim={isPrintingAnim}
            isGeneratingPDF={isGeneratingPDF}
            activePrinterName={activePrinterName}
            lastOrderDetails={lastOrderDetails}
            cashierName={cashierName}
            storeProfile={storeProfile}
          />
        )}

        {showAddProductModal && (
          <AddProductModal
            onClose={() => setShowAddProductModal(false)}
            onSubmit={handleCreateAndAddProduct}
            categories={categories}
            name={newProductName} onNameChange={setNewProductName}
            sku={newProductSku} onSkuChange={setNewProductSku}
            category={newProductCategory} onCategoryChange={setNewProductCategory}
            unit={newProductUnit} onUnitChange={setNewProductUnit}
            retailPrice={newProductRetailPrice} onRetailPriceChange={setNewProductRetailPrice}
            wholesalePrice={newProductWholesalePrice} onWholesalePriceChange={setNewProductWholesalePrice}
            projectPrice={newProductProjectPrice} onProjectPriceChange={setNewProductProjectPrice}
            stock={newProductStock} onStockChange={setNewProductStock}
          />
        )}

        {showAddCustomerModal && (
          <AddCustomerModal
            onClose={() => setShowAddCustomerModal(false)}
            onSubmit={handleAddCustomer}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
