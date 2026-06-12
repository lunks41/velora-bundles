export enum DiscountClass {
  Product = "PRODUCT",
  Order = "ORDER",
  Shipping = "SHIPPING",
}

export enum ProductDiscountSelectionStrategy {
  All = "ALL",
  First = "FIRST",
  Maximum = "MAXIMUM",
}

export interface Input {
  cart: {
    lines: Array<{
      id: string;
      quantity: number;
      attribute?: { value?: string | null } | null;
      cost: {
        subtotalAmount: {
          amount: string;
        };
      };
      merchandise: {
        __typename?: string;
        product?: {
          id: string;
        };
      };
    }>;
  };
  shop?: {
    metafield?: {
      jsonValue?: unknown;
      value?: string | null;
    } | null;
  };
  discount?: {
    discountClasses?: DiscountClass[];
  };
}

export interface ProductDiscountCandidate {
  message?: string;
  targets: Array<{ cartLine: { id: string } }>;
  value:
    | { percentage: { value: string } }
    | { fixedAmount: { amount: string } };
}

export interface CartLinesDiscountsGenerateRunResult {
  operations: Array<{
    productDiscountsAdd?: {
      candidates: ProductDiscountCandidate[];
      selectionStrategy: ProductDiscountSelectionStrategy;
    };
  }>;
}
