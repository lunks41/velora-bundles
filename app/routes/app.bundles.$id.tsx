import { useCallback, useEffect, useState } from "react";
import type { Prisma } from "@prisma/client";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { invalidateShopCache } from "../redis.server";
import { captureException } from "../sentry.server";
import { syncBundleToMetafields } from "../utils/metafields.server";
import { checkPlanLimit } from "../utils/billing.server";
import BundlePreview from "../components/BundlePreview";
import type {
  BundleFormData,
  BundleFormProduct,
  VolumeDiscountForm,
} from "../types";
import { EMPTY_BUNDLE_FORM } from "../types";

function bundleToFormData(bundle: {
  id: string;
  name: string;
  title: string;
  status: BundleFormData["status"];
  bundleType: BundleFormData["bundleType"];
  discountType: BundleFormData["discountType"];
  discountValue: number;
  widgetPosition: string;
  products: Array<{
    shopifyProductId: string;
    shopifyVariantId: string | null;
    productTitle: string;
    productImageUrl: string | null;
    quantity: number;
    sortOrder: number;
  }>;
  volumeDiscounts: Array<{
    minQuantity: number;
    maxQuantity: number | null;
    discountType: VolumeDiscountForm["discountType"];
    discountValue: number;
    label: string;
    isMostPopular: boolean;
    sortOrder: number;
  }>;
}): BundleFormData {
  return {
    id: bundle.id,
    name: bundle.name,
    title: bundle.title,
    status: bundle.status,
    bundleType: bundle.bundleType,
    discountType: bundle.discountType,
    discountValue: bundle.discountValue,
    widgetPosition: bundle.widgetPosition,
    products: bundle.products.map((p) => ({
      shopifyProductId: p.shopifyProductId,
      shopifyVariantId: p.shopifyVariantId ?? undefined,
      productTitle: p.productTitle,
      productImageUrl: p.productImageUrl ?? undefined,
      quantity: p.quantity,
      sortOrder: p.sortOrder,
    })),
    volumeDiscounts: bundle.volumeDiscounts.map((v) => ({
      minQuantity: v.minQuantity,
      maxQuantity: v.maxQuantity ?? undefined,
      discountType: v.discountType,
      discountValue: v.discountValue,
      label: v.label,
      isMostPopular: v.isMostPopular,
      sortOrder: v.sortOrder,
    })),
  };
}

function validateBundleForm(data: BundleFormData): string | null {
  if (!data.name.trim()) return "Bundle name is required";
  if (!data.title.trim()) return "Display title is required";
  if (data.discountValue <= 0) return "Discount value must be greater than 0";
  if (data.status === "ACTIVE" && data.products.length === 0) {
    return "Active bundles must include at least one product";
  }
  for (const tier of data.volumeDiscounts) {
    if (tier.minQuantity < 1) return "Tier minimum quantity must be at least 1";
    if (tier.discountValue <= 0) return "Tier discount value must be greater than 0";
  }
  return null;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  if (id === "new") {
    return { formData: EMPTY_BUNDLE_FORM, isNew: true };
  }

  const bundle = await prisma.bundle.findFirst({
    where: { id, shopId: shop.id },
    include: {
      products: { orderBy: { sortOrder: "asc" } },
      volumeDiscounts: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!bundle) {
    throw new Response("Bundle not found", { status: 404 });
  }

  return { formData: bundleToFormData(bundle), isNew: false };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "save_bundle") {
    return { error: "Unknown action" };
  }

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    return { error: "Shop not found" };
  }

  let bundleData: BundleFormData;
  try {
    bundleData = JSON.parse(formData.get("bundle") as string) as BundleFormData;
  } catch {
    return { error: "Invalid bundle data" };
  }

  const validationError = validateBundleForm(bundleData);
  if (validationError) {
    return { error: validationError };
  }

  const isNew = params.id === "new" || !bundleData.id;

  try {
    if (isNew) {
      const canCreate = await checkPlanLimit(shop.id, session.shop, "bundles");
      if (!canCreate) {
        return {
          error: "Bundle limit reached for your plan. Upgrade to create more bundles.",
        };
      }
    }

    const savedBundle = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let bundleId = bundleData.id;

      if (isNew) {
        const created = await tx.bundle.create({
          data: {
            shopId: shop.id,
            name: bundleData.name,
            title: bundleData.title,
            status: bundleData.status,
            bundleType: bundleData.bundleType,
            discountType: bundleData.discountType,
            discountValue: bundleData.discountValue,
            widgetPosition: bundleData.widgetPosition,
          },
        });
        bundleId = created.id;
      } else {
        await tx.bundle.update({
          where: { id: bundleId },
          data: {
            name: bundleData.name,
            title: bundleData.title,
            status: bundleData.status,
            bundleType: bundleData.bundleType,
            discountType: bundleData.discountType,
            discountValue: bundleData.discountValue,
            widgetPosition: bundleData.widgetPosition,
          },
        });
        await tx.bundleProduct.deleteMany({ where: { bundleId } });
        await tx.volumeDiscount.deleteMany({ where: { bundleId } });
      }

      if (bundleData.products.length > 0) {
        await tx.bundleProduct.createMany({
          data: bundleData.products.map((p, index) => ({
            bundleId: bundleId!,
            shopifyProductId: p.shopifyProductId,
            shopifyVariantId: p.shopifyVariantId ?? null,
            productTitle: p.productTitle,
            productImageUrl: p.productImageUrl ?? null,
            quantity: p.quantity,
            sortOrder: p.sortOrder ?? index,
          })),
        });
      }

      if (bundleData.volumeDiscounts.length > 0) {
        await tx.volumeDiscount.createMany({
          data: bundleData.volumeDiscounts.map((v, index) => ({
            bundleId: bundleId!,
            minQuantity: v.minQuantity,
            maxQuantity: v.maxQuantity ?? null,
            discountType: v.discountType,
            discountValue: v.discountValue,
            label: v.label,
            isMostPopular: v.isMostPopular,
            sortOrder: v.sortOrder ?? index,
          })),
        });
      }

      return tx.bundle.findUnique({
        where: { id: bundleId },
        include: {
          products: { orderBy: { sortOrder: "asc" } },
          volumeDiscounts: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    await syncBundleToMetafields(admin, session.shop);
    await invalidateShopCache(session.shop);

    if (isNew && savedBundle) {
      throw redirect(`/app/bundles/${savedBundle.id}`);
    }

    return {
      success: true,
      formData: savedBundle ? bundleToFormData(savedBundle) : bundleData,
    };
  } catch (error) {
    if (error instanceof Response) throw error;
    captureException(error);
    return { error: "Failed to save bundle" };
  }
};

export default function BundleEditorPage() {
  const { formData: initialData, isNew } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [form, setForm] = useState<BundleFormData>(initialData);

  useEffect(() => {
    setForm(initialData);
  }, [initialData]);

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Bundle saved");
      if (fetcher.data.formData) {
        setForm(fetcher.data.formData);
      }
    }
    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const updateField = useCallback(
    <K extends keyof BundleFormData>(key: K, value: BundleFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const addProducts = useCallback(async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      action: "select",
    });

    if (!selected || selected.length === 0) return;

    const newProducts: BundleFormProduct[] = selected.map((product, index) => {
      const variant = product.variants?.[0];
      return {
        shopifyProductId: product.id,
        shopifyVariantId: variant?.id,
        productTitle: product.title ?? "Untitled product",
        productImageUrl: product.images?.[0]?.originalSrc,
        quantity: 1,
        sortOrder: form.products.length + index,
      };
    });

    setForm((prev) => ({
      ...prev,
      products: [...prev.products, ...newProducts],
    }));
  }, [shopify, form.products.length]);

  const removeProduct = useCallback((productId: string) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.shopifyProductId !== productId),
    }));
  }, []);

  const addTier = useCallback(() => {
    const nextQty =
      form.volumeDiscounts.length > 0
        ? Math.max(...form.volumeDiscounts.map((t) => t.minQuantity)) + 1
        : 2;

    const newTier: VolumeDiscountForm = {
      minQuantity: nextQty,
      discountType: form.discountType,
      discountValue: form.discountValue,
      label: `Buy ${nextQty}`,
      isMostPopular: form.volumeDiscounts.length === 0,
      sortOrder: form.volumeDiscounts.length,
    };

    setForm((prev) => ({
      ...prev,
      volumeDiscounts: [...prev.volumeDiscounts, newTier],
    }));
  }, [form.discountType, form.discountValue, form.volumeDiscounts]);

  const updateTier = useCallback(
    (index: number, updates: Partial<VolumeDiscountForm>) => {
      setForm((prev) => ({
        ...prev,
        volumeDiscounts: prev.volumeDiscounts.map((tier, i) =>
          i === index ? { ...tier, ...updates } : tier,
        ),
      }));
    },
    [],
  );

  const removeTier = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      volumeDiscounts: prev.volumeDiscounts.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSave = () => {
    const payload = new FormData();
    payload.set("intent", "save_bundle");
    payload.set("bundle", JSON.stringify(form));
    fetcher.submit(payload, { method: "post" });
  };

  const isSaving =
    fetcher.state === "submitting" || fetcher.state === "loading";

  return (
    <s-page heading={isNew ? "Create bundle" : "Edit bundle"}>
      <s-button
        slot="primary-action"
        onClick={handleSave}
        {...(isSaving ? { loading: true } : {})}
      >
        Save bundle
      </s-button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        <s-stack direction="block" gap="base">
          <s-section heading="Bundle details">
            <s-stack direction="block" gap="base">
              <s-text-field
                label="Internal name"
                value={form.name}
                onInput={(e) =>
                  updateField("name", e.currentTarget.value)
                }
              />
              <s-text-field
                label="Display title"
                value={form.title}
                onInput={(e) =>
                  updateField("title", e.currentTarget.value)
                }
              />
              <s-select
                label="Status"
                value={form.status}
                onChange={(e) =>
                  updateField(
                    "status",
                    e.currentTarget.value as BundleFormData["status"],
                  )
                }
              >
                <s-option value="DRAFT">Draft</s-option>
                <s-option value="ACTIVE">Active</s-option>
              </s-select>
              <s-select
                label="Bundle type"
                value={form.bundleType}
                onChange={(e) =>
                  updateField(
                    "bundleType",
                    e.currentTarget.value as BundleFormData["bundleType"],
                  )
                }
              >
                <s-option value="FIXED">Fixed bundle</s-option>
                <s-option value="FREQUENTLY_BOUGHT_TOGETHER">
                  Frequently bought together
                </s-option>
                <s-option value="MIX_MATCH">Mix & match</s-option>
                <s-option value="BOGO">Buy one get one</s-option>
              </s-select>
              <s-select
                label="Discount type"
                value={form.discountType}
                onChange={(e) =>
                  updateField(
                    "discountType",
                    e.currentTarget.value as BundleFormData["discountType"],
                  )
                }
              >
                <s-option value="PERCENTAGE">Percentage</s-option>
                <s-option value="FIXED_AMOUNT">Fixed amount</s-option>
                <s-option value="SPECIAL_PRICE">Special price</s-option>
              </s-select>
              <s-number-field
                label="Discount value"
                value={String(form.discountValue)}
                onInput={(e) =>
                  updateField("discountValue", Number(e.currentTarget.value))
                }
              />
              <s-select
                label="Widget position"
                value={form.widgetPosition}
                onChange={(e) =>
                  updateField("widgetPosition", e.currentTarget.value)
                }
              >
                <s-option value="above_atc">Above add to cart</s-option>
                <s-option value="below_atc">Below add to cart</s-option>
              </s-select>
            </s-stack>
          </s-section>

          <s-section heading="Products">
            <s-stack direction="block" gap="base">
              <s-button onClick={addProducts}>Add products</s-button>
              {form.products.length === 0 ? (
                <s-paragraph>No products added yet.</s-paragraph>
              ) : (
                form.products.map((product) => (
                  <s-box
                    key={product.shopifyProductId}
                    padding="small"
                    borderWidth="base"
                    borderRadius="base"
                  >
                    <s-stack direction="inline" gap="base">
                      <s-paragraph>{product.productTitle}</s-paragraph>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        onClick={() =>
                          removeProduct(product.shopifyProductId)
                        }
                      >
                        Remove
                      </s-button>
                    </s-stack>
                  </s-box>
                ))
              )}
            </s-stack>
          </s-section>

          <s-section heading="Volume discounts">
            <s-stack direction="block" gap="base">
              <s-button onClick={addTier}>Add tier</s-button>
              {form.volumeDiscounts.map((tier, index) => (
                <s-box
                  key={index}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <s-stack direction="block" gap="small">
                    <s-text-field
                      label="Label"
                      value={tier.label}
                      onInput={(e) =>
                        updateTier(index, { label: e.currentTarget.value })
                      }
                    />
                    <s-number-field
                      label="Min quantity"
                      value={String(tier.minQuantity)}
                      onInput={(e) =>
                        updateTier(index, {
                          minQuantity: Number(e.currentTarget.value),
                        })
                      }
                    />
                    <s-number-field
                      label="Discount value"
                      value={String(tier.discountValue)}
                      onInput={(e) =>
                        updateTier(index, {
                          discountValue: Number(e.currentTarget.value),
                        })
                      }
                    />
                    <s-select
                      label="Discount type"
                      value={tier.discountType}
                      onChange={(e) =>
                        updateTier(index, {
                          discountType: e.currentTarget
                            .value as VolumeDiscountForm["discountType"],
                        })
                      }
                    >
                      <s-option value="PERCENTAGE">Percentage</s-option>
                      <s-option value="FIXED_AMOUNT">Fixed amount</s-option>
                      <s-option value="SPECIAL_PRICE">Special price</s-option>
                    </s-select>
                    <s-stack direction="inline" gap="small">
                      <s-button
                        variant={tier.isMostPopular ? "primary" : "tertiary"}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            volumeDiscounts: prev.volumeDiscounts.map(
                              (t, i) => ({
                                ...t,
                                isMostPopular: i === index,
                              }),
                            ),
                          }));
                        }}
                      >
                        {tier.isMostPopular ? "Most popular" : "Set popular"}
                      </s-button>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        onClick={() => removeTier(index)}
                      >
                        Remove
                      </s-button>
                    </s-stack>
                  </s-stack>
                </s-box>
              ))}
            </s-stack>
          </s-section>
        </s-stack>

        <s-section heading="Live preview">
          <BundlePreview formData={form} />
        </s-section>
      </div>

      <s-button
        slot="secondary-actions"
        variant="tertiary"
        onClick={() => navigate("/app/bundles")}
      >
        Back to bundles
      </s-button>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
