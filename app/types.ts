import type {
  Bundle,
  BundleProduct,
  BundleStatus,
  BundleType,
  DiscountType,
  Plan,
  VolumeDiscount,
} from "@prisma/client";

export type { Plan, BundleStatus, BundleType, DiscountType };

export interface BundleFormProduct {
  shopifyProductId: string;
  shopifyVariantId?: string;
  productTitle: string;
  productImageUrl?: string;
  quantity: number;
  sortOrder: number;
}

export interface VolumeDiscountForm {
  minQuantity: number;
  maxQuantity?: number;
  discountType: DiscountType;
  discountValue: number;
  label: string;
  isMostPopular: boolean;
  sortOrder: number;
}

export interface BundleFormData {
  id?: string;
  name: string;
  title: string;
  status: BundleStatus;
  bundleType: BundleType;
  discountType: DiscountType;
  discountValue: number;
  widgetPosition: string;
  products: BundleFormProduct[];
  volumeDiscounts: VolumeDiscountForm[];
}

export type BundleWithRelations = Bundle & {
  products: BundleProduct[];
  volumeDiscounts: VolumeDiscount[];
};

export interface WidgetSettings {
  theme?: "light" | "dark" | "minimal" | "branded";
  primaryColor?: string;
  backgroundColor?: string;
  buttonColor?: string;
  borderRadius?: number;
  defaultPosition?: "above_atc" | "below_atc";
}

export interface MetafieldBundleConfig {
  id: string;
  productIds: string[];
  minQuantity: number;
  discountType: DiscountType;
  discountValue: number;
  volumeTiers?: Array<{
    minQuantity: number;
    discountType: DiscountType;
    discountValue: number;
  }>;
}

export interface WidgetApiResponse {
  bundleId: string;
  title: string;
  bundleType: BundleType;
  discountType: DiscountType;
  discountValue: number;
  widgetPosition: string;
  products: Array<{
    shopifyProductId: string;
    shopifyVariantId?: string;
    productTitle: string;
    productImageUrl?: string;
    quantity: number;
  }>;
  volumeDiscounts: VolumeDiscountForm[];
  widgetSettings?: WidgetSettings;
}

export interface DashboardStats {
  totalRevenue: number;
  revenueChangePercent: number;
  totalViews: number;
  totalClicks: number;
  ctr: number;
  activeBundles: number;
  topBundle: {
    id: string;
    name: string;
    revenue: number;
    conversionRate: number;
  } | null;
  chartData: Array<{ date: string; revenue: number }>;
}

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  theme: "light",
  primaryColor: "#008060",
  backgroundColor: "#ffffff",
  buttonColor: "#1a1a1a",
  borderRadius: 8,
  defaultPosition: "above_atc",
};

export const EMPTY_BUNDLE_FORM: BundleFormData = {
  name: "",
  title: "",
  status: "DRAFT",
  bundleType: "FIXED",
  discountType: "PERCENTAGE",
  discountValue: 10,
  widgetPosition: "above_atc",
  products: [],
  volumeDiscounts: [],
};
