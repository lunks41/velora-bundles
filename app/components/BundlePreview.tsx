import type { BundleFormData, VolumeDiscountForm } from "../types";

const MOCK_UNIT_PRICE = 29.99;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function calculateTierPrice(
  tier: VolumeDiscountForm,
  quantity: number,
  basePrice: number,
): { total: number; savings: number; perUnit: number } {
  const subtotal = basePrice * quantity;

  let total = subtotal;
  if (tier.discountType === "PERCENTAGE") {
    total = subtotal * (1 - tier.discountValue / 100);
  } else if (tier.discountType === "FIXED_AMOUNT") {
    total = Math.max(0, subtotal - tier.discountValue);
  } else if (tier.discountType === "SPECIAL_PRICE") {
    total = tier.discountValue * quantity;
  }

  const savings = subtotal - total;
  return { total, savings, perUnit: total / quantity };
}

function calculateBaseBundlePrice(formData: BundleFormData): number {
  const productTotal = formData.products.reduce(
    (sum, p) => sum + MOCK_UNIT_PRICE * p.quantity,
    0,
  );
  return productTotal > 0 ? productTotal : MOCK_UNIT_PRICE * 2;
}

interface BundlePreviewProps {
  formData: BundleFormData;
  widgetSettings?: {
    primaryColor?: string;
    backgroundColor?: string;
    buttonColor?: string;
    borderRadius?: number;
  };
}

export default function BundlePreview({
  formData,
  widgetSettings,
}: BundlePreviewProps) {
  const basePrice = calculateBaseBundlePrice(formData);
  const primaryColor = widgetSettings?.primaryColor ?? "#008060";
  const backgroundColor = widgetSettings?.backgroundColor ?? "#ffffff";
  const buttonColor = widgetSettings?.buttonColor ?? "#1a1a1a";
  const borderRadius = widgetSettings?.borderRadius ?? 8;

  const tiers =
    formData.volumeDiscounts.length > 0
      ? [...formData.volumeDiscounts].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        )
      : [
          {
            minQuantity: 2,
            discountType: formData.discountType,
            discountValue: formData.discountValue,
            label: "Bundle deal",
            isMostPopular: true,
            sortOrder: 0,
          },
        ];

  const title = formData.title || "Bundle & Save";

  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
    >
      <div
        style={{
          backgroundColor,
          borderRadius: `${borderRadius}px`,
          border: "1px solid #e1e3e5",
          padding: "16px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: 600,
            marginBottom: "12px",
            color: "#202223",
          }}
        >
          {title}
        </div>

        {formData.products.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "16px",
              flexWrap: "wrap",
            }}
          >
            {formData.products.map((product) => (
              <div
                key={product.shopifyProductId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "#6d7175",
                }}
              >
                {product.productImageUrl ? (
                  <img
                    src={product.productImageUrl}
                    alt={product.productTitle}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      backgroundColor: "#f1f2f3",
                    }}
                  />
                )}
                <span>
                  {product.productTitle}
                  {product.quantity > 1 ? ` ×${product.quantity}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {tiers.map((tier, index) => {
            const quantity = tier.minQuantity;
            const { total, savings, perUnit } = calculateTierPrice(
              tier,
              quantity,
              basePrice / Math.max(tiers[0]?.minQuantity ?? 2, 1),
            );
            const savingsPercent =
              savings > 0
                ? Math.round(
                    (savings / (basePrice * (quantity / (tier.minQuantity || 1)))) *
                      100,
                  )
                : 0;

            return (
              <label
                key={`${tier.minQuantity}-${index}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  border: tier.isMostPopular
                    ? `2px solid ${primaryColor}`
                    : "1px solid #e1e3e5",
                  borderRadius: `${borderRadius}px`,
                  cursor: "pointer",
                  position: "relative",
                  backgroundColor: tier.isMostPopular
                    ? `${primaryColor}08`
                    : "transparent",
                }}
              >
                {tier.isMostPopular && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-10px",
                      right: "12px",
                      backgroundColor: primaryColor,
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Most popular
                  </span>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="radio"
                    name="bundle-tier"
                    defaultChecked={tier.isMostPopular}
                    style={{ accentColor: primaryColor }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>
                      {tier.label || `Buy ${quantity}`}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6d7175" }}>
                      {formatCurrency(perUnit)} each
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>
                    {formatCurrency(total)}
                  </div>
                  {savings > 0 && (
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: "2px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: primaryColor,
                        backgroundColor: `${primaryColor}15`,
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      Save {formatCurrency(savings)}
                      {savingsPercent > 0 ? ` (${savingsPercent}%)` : ""}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <button
          type="button"
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "12px",
            backgroundColor: buttonColor,
            color: "#fff",
            border: "none",
            borderRadius: `${borderRadius}px`,
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add bundle to cart
        </button>
      </div>
    </s-box>
  );
}
