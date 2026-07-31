import React, { useState } from 'react';
import {
  Store,
  Link2,
  Image as ImageIcon,
  Plus,
  Trash2,
  ShoppingBag,
  Phone,
  MapPin,
  CheckCircle2,
  Sparkles,
  Copy,
  QrCode
} from 'lucide-react';
import { Product, DigitalOrder, Banner } from '../../types';
import { addMutation } from '../../lib/cashSession';
import { useDialog } from '../../components/shared/DialogProvider';

interface TokoDigitalViewProps {
  storeName: string;
  ecommerceUsername: string;
  onUpdateEcommerceUsername: (username: string) => void;
  products: Product[];
  onUpdateProducts: (updatedProducts: Product[]) => void;
  digitalOrders: DigitalOrder[];
  onUpdateDigitalOrders: (updatedOrders: DigitalOrder[]) => void;
  banners: Banner[];
  onUpdateBanners: (updatedBanners: Banner[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
}

export default function TokoDigitalView({
  storeName,
  ecommerceUsername,
  onUpdateEcommerceUsername,
  products,
  onUpdateProducts,
  digitalOrders,
  onUpdateDigitalOrders,
  banners,
  onUpdateBanners,
  onAddActivity
}: TokoDigitalViewProps) {
  const dialog = useDialog();
  const [usernameInput, setUsernameInput] = useState(ecommerceUsername);
  const [selectedOrder, setSelectedOrder] = useState<DigitalOrder | null>(null);
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerUrl, setNewBannerUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const storeLink = ecommerceUsername ? `https://toko.tokku.id/${ecommerceUsername}` : '';

  const handleSaveUsername = () => {
    const clean = usernameInput.replace(/[^a-zA-Z]/g, '');
    if (!clean) {
      dialog.alert('Username e-commerce hanya boleh berisi huruf, tanpa angka atau spasi.');
      return;
    }
    onUpdateEcommerceUsername(clean);
    setUsernameInput(clean);
    onAddActivity('Toko Digital Diaktifkan', `Username katalog online diset ke "${clean}"`, 0, 'quote');
  };

  const handleCopyLink = () => {
    if (!storeLink) return;
    try {
      navigator.clipboard.writeText(storeLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      dialog.alert(storeLink);
    }
  };

  const handleAddBanner = () => {
    if (!newBannerUrl.trim()) {
      dialog.alert('Masukkan URL gambar banner terlebih dahulu.');
      return;
    }
    const banner: Banner = {
      id: `BNR-${Math.floor(1000 + Math.random() * 9000)}`,
      imageUrl: newBannerUrl.trim(),
      title: newBannerTitle.trim() || 'Promo Toko',
      active: true
    };
    onUpdateBanners([banner, ...banners]);
    onAddActivity('Banner Toko Digital Baru', banner.title, 0, 'quote');
    setNewBannerTitle('');
    setNewBannerUrl('');
  };

  const handleRemoveBanner = (id: string) => {
    const banner = banners.find(b => b.id === id);
    onUpdateBanners(banners.filter(b => b.id !== id));
    onAddActivity('Banner Toko Digital Dihapus', banner?.title || id, 0, 'overdue');
  };

  // Demo helper: simulate an incoming customer order from the digital storefront
  const handleSimulateOrder = () => {
    const inStockProducts = products.filter(p => p.stock > 0);
    if (inStockProducts.length === 0) {
      dialog.alert('Tidak ada produk dengan stok tersedia untuk disimulasikan.');
      return;
    }
    const picked = inStockProducts[Math.floor(Math.random() * inStockProducts.length)];
    const qty = Math.min(picked.stock, Math.floor(1 + Math.random() * 3));
    const order: DigitalOrder = {
      id: `ECO-${Math.floor(1000 + Math.random() * 9000)}`,
      buyerName: ['Nadia', 'Rizky Pratama', 'Siti Aminah', 'Herman'][Math.floor(Math.random() * 4)],
      phone: `08${Math.floor(1000000000 + Math.random() * 899999999)}`,
      address: 'Jl. Contoh Alamat Pelanggan No. ' + Math.floor(1 + Math.random() * 50),
      items: [{ sku: picked.sku, name: picked.name, quantity: qty, price: picked.retailPrice }],
      total: qty * picked.retailPrice,
      status: 'Baru',
      createdAt: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    onUpdateDigitalOrders([order, ...digitalOrders]);
    onAddActivity('Pesanan Toko Digital Baru', `${order.buyerName} · Rp ${order.total.toLocaleString('id-ID')}`, order.total, 'sale');
  };

  const handleProcessOrder = async (order: DigitalOrder) => {
    const ok = await dialog.confirm(`Proses pesanan dari ${order.buyerName} senilai Rp ${order.total.toLocaleString('id-ID')} sebagai transaksi COD tunai?`);
    if (!ok) return;

    // Deduct stock
    const updatedProducts = products.map((p) => {
      const item = order.items.find(i => i.sku === p.sku);
      if (!item) return p;
      const nextStock = Math.max(0, p.stock - item.quantity);
      return {
        ...p,
        stock: nextStock,
        stockStatus: (nextStock === 0 ? 'Out of Stock' : nextStock <= 15 ? 'Low Stock' : 'Healthy') as Product['stockStatus']
      };
    });
    onUpdateProducts(updatedProducts);

    // Cash impact (assume COD tunai)
    addMutation('in', 'Penjualan Tunai', order.total, `Toko Digital: ${order.id}`);

    const updatedOrders = digitalOrders.map(o => o.id === order.id ? { ...o, status: 'Selesai' as const } : o);
    onUpdateDigitalOrders(updatedOrders);
    setSelectedOrder(null);
    onAddActivity('Pesanan Toko Digital Diproses', `${order.buyerName} · ${order.id}`, order.total, 'sale');
  };

  const newOrdersCount = digitalOrders.filter(o => o.status === 'Baru').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <Store className="w-5 h-5 text-blue-600" />
          Toko Digital
        </h2>
        <p className="text-xs text-gray-500 font-medium mt-0.5">Katalog online gratis untuk menerima pesanan dari calon pelanggan.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Link Setup */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blue-600" />
            <h4 className="font-extrabold text-sm text-gray-800">Link Toko Digital</h4>
          </div>

          <div>
            <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Username E-commerce (huruf saja)</label>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value.replace(/[^a-zA-Z]/g, ''))}
              placeholder="contoh: sinarmajumaterial"
              className="w-full border border-gray-200 rounded-lg p-2.5 text-xs font-bold outline-none focus:border-blue-400"
            />
            <button
              onClick={handleSaveUsername}
              className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
            >
              Simpan Username
            </button>
          </div>

          {ecommerceUsername && (
            <div className="border border-gray-100 rounded-xl p-3 space-y-2.5">
              <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg py-4 gap-2">
                <QrCode className="w-16 h-16 text-gray-700" />
                <span className="text-[10px] font-bold text-gray-600 text-center px-2">{storeName}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-2">
                <span className="text-[10px] text-gray-600 truncate flex-1">{storeLink}</span>
                <button onClick={handleCopyLink} className="text-blue-600 hover:text-blue-700 cursor-pointer shrink-0">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              {copied && <p className="text-[9px] text-emerald-600 font-bold text-center">Link disalin!</p>}
              <p className="text-[10px] text-gray-400 leading-relaxed">Bagikan link atau barcode ini ke calon pelanggan. Stok dan harga otomatis mengikuti data Toko.</p>
            </div>
          )}
        </div>

        {/* Banner / Ads */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-blue-600" />
            <h4 className="font-extrabold text-sm text-gray-800">Banner / Ads Toko Digital</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={newBannerTitle}
              onChange={(e) => setNewBannerTitle(e.target.value)}
              placeholder="Judul promo (opsional)"
              className="border border-gray-200 rounded-lg p-2.5 text-xs outline-none"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newBannerUrl}
                onChange={(e) => setNewBannerUrl(e.target.value)}
                placeholder="URL gambar banner"
                className="flex-1 border border-gray-200 rounded-lg p-2.5 text-xs outline-none"
              />
              <button
                onClick={handleAddBanner}
                className="px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {banners.length === 0 ? (
              <p className="col-span-full text-center text-xs text-gray-400 py-6">Belum ada banner yang diunggah.</p>
            ) : (
              banners.map((b) => (
                <div key={b.id} className="relative border border-gray-100 rounded-xl overflow-hidden group">
                  <img src={b.imageUrl} alt={b.title} className="w-full h-24 object-cover bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
                  <div className="p-2">
                    <p className="text-[10px] font-bold text-gray-700 truncate">{b.title}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveBanner(b.id)}
                    className="absolute top-1.5 right-1.5 p-1 bg-white/90 rounded-md text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Incoming Orders */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-blue-600" />
            <h4 className="font-extrabold text-sm text-gray-800">Pesanan Masuk Toko Digital {newOrdersCount > 0 && <span className="ml-1 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">{newOrdersCount} baru</span>}</h4>
          </div>
          <button
            onClick={handleSimulateOrder}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Simulasikan Pesanan Pelanggan
          </button>
        </div>
        <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
          {digitalOrders.length === 0 ? (
            <p className="p-6 text-center text-xs text-gray-400">Belum ada pesanan dari toko digital.</p>
          ) : (
            digitalOrders.map((order) => (
              <div key={order.id} className="p-3.5">
                <button
                  onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                  className="w-full flex items-center justify-between text-left cursor-pointer"
                >
                  <div>
                    <p className="font-bold text-xs text-gray-800">{order.buyerName} <span className="text-[10px] font-normal text-gray-400">· {order.id}</span></p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{order.items.length} item · {order.createdAt}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xs text-gray-700">Rp {order.total.toLocaleString('id-ID')}</p>
                    <span className={`text-[9px] font-bold uppercase ${order.status === 'Baru' ? 'text-blue-600' : order.status === 'Selesai' ? 'text-emerald-600' : 'text-gray-400'}`}>{order.status}</span>
                  </div>
                </button>

                {selectedOrder?.id === order.id && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-3.5 h-3.5 shrink-0" /> {order.phone}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-3.5 h-3.5 shrink-0" /> {order.address}
                    </div>
                    <div className="border-t border-gray-200 pt-2 space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-gray-600">{item.name} x{item.quantity}</span>
                          <span className="font-bold text-gray-700">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                    {order.status !== 'Selesai' && (
                      <button
                        onClick={() => handleProcessOrder(order)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Proses Transaksi (Seperti POS)
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
