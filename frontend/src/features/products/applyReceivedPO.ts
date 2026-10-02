import { PO, Product, SkuLocation } from '../../types';
import { generateSkuCode } from '../../lib/generateSku';

const normalizeProductName = (name: string) => name.trim().toLocaleLowerCase();

export function applyReceivedPOToProducts(
  products: Product[],
  po: PO,
  skuLocations: SkuLocation[] = []
): Product[] {
  const updatedProducts = [...products];
  const receivedAt = new Date().toISOString();
  const restockedQuantities = new Map<string, number>();

  po.items.forEach((item) => {
    const normalizedName = normalizeProductName(item.name);
    const exactNameMatches = normalizedName ? updatedProducts.filter(
      (product) => normalizeProductName(product.name) === normalizedName
    ) : [];
    const fuzzyNameMatches = normalizedName ? updatedProducts.filter(
      (product) => product.name.toLocaleLowerCase().includes(normalizedName)
        || normalizedName.includes(product.name.toLocaleLowerCase())
    ) : [];
    const productIndex = updatedProducts.findIndex((product) => product.sku === item.sku);
    const matchedIndex = productIndex >= 0
      ? productIndex
      : exactNameMatches.length === 1
        ? updatedProducts.findIndex((product) => product === exactNameMatches[0])
        : fuzzyNameMatches.length === 1
          ? updatedProducts.findIndex((product) => product === fuzzyNameMatches[0])
          : -1;

    const location = skuLocations.find((candidate) => candidate.id === item.locationId);
    const totalDiscountPerUnit = item.totalDiscount && item.quantity > 0
      ? item.totalDiscount / item.quantity
      : 0;
    const discountPerUnit = item.discountPerUnit && item.discountPerUnit > 0
      ? item.discountPerUnit
      : totalDiscountPerUnit;
    const latestCostPrice = item.bonus
      ? undefined
      : Math.max(0, item.price - Math.max(0, discountPerUnit));

    if (matchedIndex >= 0) {
      const product = updatedProducts[matchedIndex];
      const stock = product.stock + item.quantity;
      updatedProducts[matchedIndex] = {
        ...product,
        stock,
        stockStatus: stock <= 0
          ? 'Out of Stock'
          : stock <= (product.minStockQty && product.minStockQty > 0 ? product.minStockQty : 15)
            ? 'Low Stock'
            : 'Healthy',
        lastRestock: receivedAt,
        lastRestockQty: (restockedQuantities.get(product.sku) || 0) + item.quantity,
        ...(latestCostPrice !== undefined ? { costPrice: latestCostPrice } : {}),
        ...(location ? { warehouseLocation: location.name, skuLocationId: location.id } : {}),
      };
      restockedQuantities.set(product.sku, (restockedQuantities.get(product.sku) || 0) + item.quantity);
      return;
    }

    const stock = item.quantity;
    updatedProducts.push({
      name: item.name.trim() || item.sku,
      sku: item.sku.trim() || generateSkuCode(),
      category: 'Umum',
      unit: item.unit || 'Pcs',
      retailPrice: 0,
      wholesalePrice: 0,
      projectPrice: 0,
      stock,
      stockStatus: stock <= 0 ? 'Out of Stock' : stock <= 15 ? 'Low Stock' : 'Healthy',
      lastRestock: receivedAt,
      lastRestockQty: item.quantity,
      supplier: po.supplier,
      leadTime: '-',
      warehouseLocation: location?.name || '',
      image: '',
      costPrice: latestCostPrice ?? 0,
      skuLocationId: location?.id,
    });
    restockedQuantities.set(item.sku, item.quantity);
  });

  return updatedProducts;
}
