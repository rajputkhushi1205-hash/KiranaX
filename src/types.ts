export type StoreRecord = {
  id: string;
  name: string;
  createdAt: string;
};

export type CustomerRecord = {
  id: string;
  storeId: string;
  fullName: string;
  phone: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  lastOrderAt: string | null;
};

export type ProductRecord = {
  id: string;
  storeId: string;
  name: string;
  normalizedName: string;
  category: string | null;
  brand: string | null;
  unit: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryRecord = {
  id: string;
  storeId: string;
  productId: string;
  stockQuantity: number;
  lowStockThreshold: number;
  sellingPrice: number;
  updatedAt: string;
};
