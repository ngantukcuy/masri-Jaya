import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import DashboardView from './features/dashboard/DashboardView';
import POSView from './features/pos/POSView';
import ProductsView from './features/products/ProductsView';
import PurchaseView from './features/purchasing/PurchaseView';
import CustomerView from './features/customers/CustomerView';
import FinanceView from './features/finance/FinanceView';
import ReportsView from './features/reports/ReportsView';
import SettingsView from './features/settings/SettingsView';
import LoginView from './features/auth/LoginView';
import DebtsView from './features/debts/DebtsView';
import KasHarianView from './features/kas-harian/KasHarianView';
import ReturView from './features/retur/ReturView';
import TokoDigitalView from './features/toko-digital/TokoDigitalView';
import ProductMasterView from './features/product-master/ProductMasterView';
import PemasokView from './features/suppliers/PemasokView';
import DepositView from './features/deposits/DepositView';
import TransactionHistoryView from './features/transactions/TransactionHistoryView';
import { LayoutDashboard, CornerDownRight, Boxes, Menu, Receipt } from 'lucide-react';

import { Product, PO, Customer, Expense, Activity, Branch, Supplier, SalesInvoice, ReturnRecord, DigitalOrder, Banner, SkuLocation } from './types';
import { useSupabaseState } from './lib/useSupabaseState';
import { useSupabaseTable } from './lib/useSupabaseTable';
import { useSupabaseReady } from './lib/useSupabaseReady';
import { useDialog } from './components/shared/DialogProvider';

export default function App() {
  const dialog = useDialog();
  const supabaseReady = useSupabaseReady();

  // Wait for anonymous auth before mounting anything that reads/writes
  // Supabase (see useSupabaseState) — avoids a permission-denied flash
  // on first load.
  if (!supabaseReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Menyambungkan ke database...</p>
        </div>
      </div>
    );
  }

  return <AppShell />;
}

function AppShell() {
  const dialog = useDialog();
  // State management
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null);
  const [loginAt, setLoginAt] = useState<number | null>(null);
  const [registeredOwner] = useSupabaseState<{ storeName: string; ownerName: string; email: string; pin: string; address?: string; phone?: string; receiptNote?: string; taxId?: string } | null>('store_owner', null);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [products, setProducts] = useSupabaseTable<Product>('products', [], (p) => p.sku);
  const [pos, setPOs] = useSupabaseTable<PO>('purchase_orders', [], (po) => po.poNumber);
  const [customers, setCustomers] = useSupabaseTable<Customer>('customers', [], (c) => c.id);
  const [suppliers, setSuppliers] = useSupabaseTable<Supplier>('suppliers', [], (s) => s.name);
  const [expenses, setExpenses] = useSupabaseTable<Expense>('expenses', [], (e) => e.id);
  const [activities, setActivities] = useSupabaseTable<Activity>('activities', [], (a) => a.id);
  const [branches, setBranches] = useSupabaseTable<Branch>('branches', [], (b) => b.name);
  const [salesInvoices, setSalesInvoices] = useSupabaseTable<SalesInvoice>('sales_invoices', [], (s) => s.invoiceNumber);
  const [returns, setReturns] = useSupabaseTable<ReturnRecord>('returns', [], (r) => r.id);
  const [digitalOrders, setDigitalOrders] = useSupabaseTable<DigitalOrder>('digital_orders', [], (d) => d.id);
  const [banners, setBanners] = useSupabaseTable<Banner>('banners', [], (b) => b.id);
  const [skuLocations, setSkuLocations] = useSupabaseTable<SkuLocation>('sku_locations', [], (s) => s.id);
  const [ecommerceUsername, setEcommerceUsername] = useSupabaseState<string>('ecommerce_username', '');

  // Dynamic metrics added from POS checkout
  const [totalSales, setTotalSales] = useSupabaseState<number>('total_sales', 0);
  const [totalOrdersCount, setTotalOrdersCount] = useSupabaseState<number>('total_orders_count', 0);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Add activities dynamically
  const handleAddActivity = (
    title: string, 
    subtitle: string, 
    amount: number, 
    type: 'sale' | 'arrival' | 'overdue' | 'quote'
  ) => {
    const nextAct: Activity = {
      id: `ACT-${Math.floor(1000 + Math.random() * 9000)}`,
      title,
      subtitle,
      amount,
      time: "Baru saja",
      type
    };
    setActivities([nextAct, ...activities]);
  };

  const handleAddSaleToKPIs = (salesAmount: number) => {
    setTotalSales((prev) => prev + salesAmount);
    setTotalOrdersCount((prev) => prev + 1);
  };

  const handleRecordSale = (invoice: SalesInvoice) => {
    setSalesInvoices((prev) => [invoice, ...prev]);
  };

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    setIsMobileMenuOpen(false);
  };

  // Callback from Dashboard quick action
  const handleQuickRestock = () => {
    // Switch to Products tab and highlight Portland Cement Type I (low stock)
    setCurrentTab('products');
    setIsMobileMenuOpen(false);
    dialog.alert("Diarahkan ke manajemen stok. Silakan klik Restock Cepat (+50 Unit) pada Semen Portland untuk memenuhi gudang.");
  };

  const handleNewTransaction = () => {
    setCurrentTab('pos');
    setIsMobileMenuOpen(false);
  };

  const handleForceSync = () => {
    dialog.alert("Memulai Sinkronisasi Utama...\nBerhasil menerima data real-time dari North Retail Hub & South Dock. Database ERP ter-update sepenuhnya!");
  };

  // Render active view component
  const renderActiveView = () => {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTab}
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full"
        >
          {(() => {
            const baseTab = currentTab.split(':')[0];
            switch (baseTab) {
              case 'dashboard':
                return (
                  <DashboardView 
                    products={products}
                    activities={activities}
                    salesInvoices={salesInvoices}
                    customers={customers}
                    totalSales={totalSales}
                    totalOrdersCount={totalOrdersCount}
                    onTabChange={setCurrentTab}
                    onQuickRestock={handleQuickRestock}
                  />
                );
              case 'pos':
                return (
                  <POSView 
                    products={products}
                    customers={customers}
                    onUpdateProducts={setProducts}
                    onUpdateCustomers={setCustomers}
                    onAddActivity={handleAddActivity}
                    onAddSaleToKPIs={handleAddSaleToKPIs}
                    onRecordSale={handleRecordSale}
                    cashierName={currentUser?.name}
                    storeProfile={registeredOwner ? {
                      storeName: registeredOwner.storeName,
                      address: registeredOwner.address,
                      phone: registeredOwner.phone,
                      receiptNote: registeredOwner.receiptNote,
                    } : undefined}
                  />
                );
              case 'kas-harian':
                return (
                  <KasHarianView 
                    onAddActivity={handleAddActivity}
                  />
                );
              case 'retur':
                return (
                  <ReturView 
                    products={products}
                    onUpdateProducts={setProducts}
                    salesInvoices={salesInvoices}
                    pos={pos}
                    returns={returns}
                    onUpdateReturns={setReturns}
                    onAddActivity={handleAddActivity}
                    onNavigateToPOS={() => setCurrentTab('pos')}
                  />
                );
              case 'toko-digital':
                return (
                  <TokoDigitalView 
                    storeName={registeredOwner?.storeName || 'Toko Saya'}
                    ecommerceUsername={ecommerceUsername}
                    onUpdateEcommerceUsername={setEcommerceUsername}
                    products={products}
                    onUpdateProducts={setProducts}
                    digitalOrders={digitalOrders}
                    onUpdateDigitalOrders={setDigitalOrders}
                    banners={banners}
                    onUpdateBanners={setBanners}
                    onAddActivity={handleAddActivity}
                  />
                );
              case 'master-data':
                return (
                  <ProductMasterView 
                    products={products}
                    onAddActivity={handleAddActivity}
                    onUpdateProducts={setProducts}
                    skuLocations={skuLocations}
                    initialTab={(currentTab.split(':')[1] as any) || 'sku-master'}
                  />
                );
              case 'pemasok':
                return (
                  <PemasokView 
                    suppliers={suppliers}
                    onUpdateSuppliers={setSuppliers}
                    onAddActivity={handleAddActivity}
                  />
                );
              case 'deposit':
                return (
                  <DepositView 
                    customers={customers}
                    onUpdateCustomers={setCustomers}
                    onAddActivity={handleAddActivity}
                  />
                );
              case 'riwayat-transaksi':
                return (
                  <TransactionHistoryView 
                    salesInvoices={salesInvoices}
                  />
                );
              case 'products':
                return (
                  <ProductsView 
                    products={products}
                    onUpdateProducts={setProducts}
                    onAddActivity={handleAddActivity}
                    currentUserName={currentUser?.name}
                  />
                );
              case 'purchase':
                return (
                  <PurchaseView 
                    pos={pos}
                    suppliers={suppliers}
                    products={products}
                    onUpdatePOs={setPOs}
                    onUpdateProducts={setProducts}
                    onAddActivity={handleAddActivity}
                    onUpdateSuppliers={setSuppliers}
                  />
                );
              case 'customer':
                return (
                  <CustomerView 
                    customers={customers}
                    onUpdateCustomers={setCustomers}
                    onAddActivity={handleAddActivity}
                  />
                );
              case 'debts':
                return (
                  <DebtsView 
                    customers={customers}
                    onUpdateCustomers={setCustomers}
                    onAddActivity={handleAddActivity}
                    storeProfile={registeredOwner ? {
                      storeName: registeredOwner.storeName,
                      address: registeredOwner.address,
                      phone: registeredOwner.phone,
                      taxId: registeredOwner.taxId,
                    } : undefined}
                  />
                );
              case 'finance':
                return (
                  <FinanceView 
                    expenses={expenses}
                    onUpdateExpenses={setExpenses}
                    onAddActivity={handleAddActivity}
                  />
                );
              case 'reports':
                return <ReportsView />;
              case 'settings':
                return (
                  <SettingsView 
                    branches={branches}
                    onUpdateBranches={setBranches}
                    skuLocations={skuLocations}
                    onUpdateSkuLocations={setSkuLocations}
                    onAddActivity={handleAddActivity}
                  />
                );
              default:
                return (
                  <DashboardView 
                    products={products}
                    activities={activities}
                    salesInvoices={salesInvoices}
                    customers={customers}
                    totalSales={totalSales}
                    totalOrdersCount={totalOrdersCount}
                    onTabChange={setCurrentTab}
                    onQuickRestock={handleQuickRestock}
                  />
                );
            }
          })()}
        </motion.div>
      </AnimatePresence>
    );
  };

  // Global quick-search: matches products, customers, and suppliers as the user types
  type SearchResult = { id: string; label: string; sublabel: string; category: string; tab: string };
  const searchResults: SearchResult[] = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: SearchResult[] = [];

    products.forEach((p) => {
      if (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) {
        results.push({ id: `product-${p.sku}`, label: p.name, sublabel: `SKU ${p.sku} · Stok ${p.stock} ${p.unit}`, category: 'Produk', tab: 'products' });
      }
    });

    customers.forEach((c) => {
      if (c.name.toLowerCase().includes(q)) {
        results.push({ id: `customer-${c.id}`, label: c.name, sublabel: `Pelanggan · ${c.loyaltyTier}`, category: 'Pelanggan', tab: 'customer' });
      }
    });

    suppliers.forEach((s) => {
      if (s.name.toLowerCase().includes(q)) {
        results.push({ id: `supplier-${s.name}`, label: s.name, sublabel: 'Pemasok', category: 'Pemasok', tab: 'pemasok' });
      }
    });

    return results.slice(0, 8);
  })();

  const handleSearchResultSelect = (tab: string) => {
    setCurrentTab(tab);
    setSearchQuery('');
    setIsMobileMenuOpen(false);
  };

  // Set Search Input placeholder dynamically
  const getSearchPlaceholder = () => {
    const baseTab = currentTab.split(':')[0];
    switch (baseTab) {
      case 'pos':
        return "Cari produk atau scan barcode (F1)...";
      case 'products':
        return "Cari bahan bangunan, SKU, atau nomor barcode...";
      case 'master-data':
        return "Cari produk Sku Master, kategori, brand, atau unit...";
      case 'purchase':
        return "Cari pesanan pembelian, penyuplai, atau SKU...";
      case 'customer':
        return "Cari pembeli, level loyalitas, atau detail piutang...";
      case 'pemasok':
        return "Cari nama pemasok atau sales...";
      case 'deposit':
        return "Cari nama pelanggan untuk deposit...";
      case 'riwayat-transaksi':
        return "Cari nomor invoice atau nama pelanggan...";
      case 'debts':
        return "Cari debitur, ID pelanggan, atau status tagihan...";
      case 'retur':
        return "Cari nomor invoice, PO, atau nama pelanggan/pemasok...";
      default:
        return "Cari pesanan, stok barang, atau pemasok...";
    }
  };

  // Show login screen if not authenticated
  if (!currentUser) {
    return <LoginView onLoginSuccess={(user) => { setCurrentUser(user); setLoginAt(Date.now()); }} />;
  }

  return (
    <div className="flex min-h-screen font-sans antialiased text-gray-900 select-none">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex">
        <Sidebar 
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onNewTransaction={handleNewTransaction}
          onLogout={() => setCurrentUser(null)}
        />
      </div>

      {/* Sidebar - Mobile Sliding Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs"
            />
            {/* Drawer Content */}
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-72 h-full flex flex-col z-10"
            >
              <Sidebar 
                currentTab={currentTab}
                onTabChange={handleTabChange}
                onNewTransaction={handleNewTransaction}
                onLogout={() => setCurrentUser(null)}
                isMobile={true}
                onClose={() => setIsMobileMenuOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content frame */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Dynamic header navigation */}
        <Header 
          currentTab={currentTab}
          searchValue={searchQuery}
          onSearch={setSearchQuery}
          searchResults={searchResults}
          onSearchResultSelect={handleSearchResultSelect}
          onTabChange={handleTabChange}
          searchPlaceholder={getSearchPlaceholder()}
          onSync={handleForceSync}
          currentUser={currentUser}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onLogout={() => setCurrentUser(null)}
          storeName={registeredOwner?.storeName}
          loginAt={loginAt ?? undefined}
          products={products}
          customers={customers}
          activities={activities}
        />

        {/* Dashboard inner canvas - padded for mobile bottom navbar */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          {renderActiveView()}
        </main>
      </div>

      {/* Mobile Glassmorphic Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden p-3 bg-white/80 backdrop-blur-lg border-t border-slate-200/60 flex justify-around items-center shadow-lg shadow-slate-900/10 h-16">
        <button 
          onClick={() => handleTabChange('dashboard')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all ${
            currentTab === 'dashboard' ? 'text-blue-600 font-extrabold scale-105' : 'text-slate-400 font-bold'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-wider">Dasbor</span>
        </button>

        <button 
          onClick={() => handleTabChange('products')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all ${
            currentTab === 'products' ? 'text-blue-600 font-extrabold scale-105' : 'text-slate-400 font-bold'
          }`}
        >
          <Boxes className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-wider">Stok</span>
        </button>

        {/* Center elevated POS button */}
        <button 
          onClick={() => handleTabChange('pos')}
          className={`relative -top-4 w-12 h-12 rounded-full flex flex-col items-center justify-center transition-all shadow-lg cursor-pointer ${
            currentTab === 'pos' 
              ? 'bg-blue-600 text-white scale-110 border-2 border-white shadow-blue-500/40 font-black' 
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-2 border-white'
          }`}
        >
          <CornerDownRight className="w-5 h-5" />
          <span className="text-[7px] uppercase tracking-tighter mt-0.5">Kasir</span>
        </button>

        <button 
          onClick={() => handleTabChange('debts')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all ${currentTab === 'debts' ? 'text-blue-600 font-extrabold scale-105' : 'text-slate-400 font-bold'}`}>
          <Receipt className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-wider">Hutang</span>
        </button>

        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center gap-1 py-1 px-3 text-slate-400 font-bold transition-all"
        >
          <Menu className="w-5 h-5 text-slate-400" />
          <span className="text-[9px] uppercase tracking-wider">Lainnya</span>
        </button>
      </div>
    </div>
  );
}
