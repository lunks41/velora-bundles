import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from "../generated/api";
import type {
  CartLinesDiscountsGenerateRunResult,
  Input,
  ProductDiscountCandidate,
} from "../generated/api";

type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "SPECIAL_PRICE";

interface VolumeTier {
  minQuantity: number;
  discountType: DiscountType;
  discountValue: number;
}

interface BundleConfig {
  id: string;
  productIds: string[];
  minQuantity: number;
  discountType: DiscountType;
  discountValue: number;
  volumeTiers?: VolumeTier[];
}

function getBundleConfig(input: Input): BundleConfig[] {
  const raw = input.shop?.metafield?.jsonValue;
  if (!Array.isArray(raw)) return [];
  return raw as BundleConfig[];
}

function resolveDiscount(
  bundle: BundleConfig,
  totalQuantity: number,
): { discountType: DiscountType; discountValue: number } {
  if (bundle.volumeTiers && bundle.volumeTiers.length > 0) {
    const sorted = [...bundle.volumeTiers].sort(
      (a, b) => b.minQuantity - a.minQuantity,
    );
    const tier = sorted.find((t) => totalQuantity >= t.minQuantity);
    if (tier) {
      return {
        discountType: tier.discountType,
        discountValue: tier.discountValue,
      };
    }
  }

  return {
    discountType: bundle.discountType,
    discountValue: bundle.discountValue,
  };
}

function buildDiscountValue(
  discountType: DiscountType,
  discountValue: number,
  lineSubtotal: number,
): ProductDiscountCandidate["value"] {
  switch (discountType) {
    case "PERCENTAGE":
      return { percentage: { value: String(discountValue) } };
    case "FIXED_AMOUNT":
      return {
        fixedAmount: {
          amount: String(Math.min(discountValue, lineSubtotal)),
        },
      };
    case "SPECIAL_PRICE":
      return {
        fixedAmount: {
          amount: String(Math.max(0, lineSubtotal - discountValue)),
        },
      };
    default:
      return { percentage: { value: "0" } };
  }
}

export function run(input: Input): CartLinesDiscountsGenerateRunResult {
  const discountClasses = input.discount?.discountClasses ?? [];
  if (!discountClasses.includes(DiscountClass.Product)) {
    return { operations: [] };
  }

  const bundles = getBundleConfig(input);
  if (bundles.length === 0 || input.cart.lines.length === 0) {
    return { operations: [] };
  }

  const candidates: ProductDiscountCandidate[] = [];

  for (const bundle of bundles) {
    const bundleLines = input.cart.lines.filter((line) => {
      const bundleAttr = line.attribute?.value;
      if (bundleAttr === bundle.id) return true;

      if (line.merchandise.__typename !== "ProductVariant") return false;
      const productId = line.merchandise.product?.id;
      return productId ? bundle.productIds.includes(productId) : false;
    });

    if (bundleLines.length === 0) continue;

    const totalQuantity = bundleLines.reduce(
      (sum, line) => sum + line.quantity,
      0,
    );

    if (totalQuantity < bundle.minQuantity) continue;

    const { discountType, discountValue } = resolveDiscount(
      bundle,
      totalQuantity,
    );

    if (discountValue <= 0) continue;

    for (const line of bundleLines) {
      const subtotal = parseFloat(line.cost.subtotalAmount.amount);
      candidates.push({
        message: "Bundle discount",
        targets: [{ cartLine: { id: line.id } }],
        value: buildDiscountValue(discountType, discountValue, subtotal),
      });
    }
  }

  if (candidates.length === 0) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}
