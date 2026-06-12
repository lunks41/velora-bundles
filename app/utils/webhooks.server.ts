import prisma from "../db.server";
import { invalidateShopCache } from "../redis.server";
import { trackOrderAnalytics } from "./analytics.server";

interface OrderPayload {
  id?: number | string;
  total_price?: string;
  line_items?: Array<{
    price?: string;
    quantity?: number;
    properties?: Array<{ name: string; value: string }>;
  }>;
}

export async function handleAppUninstalled(shopDomain: string): Promise<void> {
  await prisma.shop.updateMany({
    where: { shopDomain },
    data: {
      isActive: false,
      uninstalledAt: new Date(),
    },
  });

  await invalidateShopCache(shopDomain);
}

export async function handleOrderPaid(
  shopDomain: string,
  payload: unknown,
): Promise<void> {
  const order = payload as OrderPayload;
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  if (!shop) return;

  const bundleIds = new Set<string>();

  for (const line of order.line_items ?? []) {
    const bundleProperty = line.properties?.find(
      (prop) => prop.name === "_velora_bundle_id",
    );
    if (bundleProperty?.value) {
      bundleIds.add(bundleProperty.value);
    }
  }

  for (const bundleId of bundleIds) {
    const lineRevenue = (order.line_items ?? [])
      .filter((line) =>
        line.properties?.some(
          (prop) =>
            prop.name === "_velora_bundle_id" && prop.value === bundleId,
        ),
      )
      .reduce(
        (sum, line) =>
          sum + parseFloat(line.price ?? "0") * (line.quantity ?? 1),
        0,
      );

    await trackOrderAnalytics(shop.id, bundleId, lineRevenue, 0);
  }
}

export async function handleProductUpdate(
  shopDomain: string,
  payload: unknown,
): Promise<void> {
  const product = payload as {
    id?: number | string;
    title?: string;
    image?: { src?: string };
    images?: Array<{ src?: string }>;
  };

  const productId = product.id?.toString();
  if (!productId) return;

  const shopifyProductId = productId.startsWith("gid://")
    ? productId
    : `gid://shopify/Product/${productId}`;

  const imageUrl = product.image?.src ?? product.images?.[0]?.src ?? null;

  await prisma.bundleProduct.updateMany({
    where: { shopifyProductId },
    data: {
      productTitle: product.title ?? undefined,
      productImageUrl: imageUrl,
    },
  });

  await invalidateShopCache(shopDomain);
}

export async function handleCustomersDataRequest(
  _shopDomain: string,
  _payload: unknown,
): Promise<void> {
  // Velora Bundles does not store customer PII — no data to export.
}

export async function handleCustomersRedact(
  _shopDomain: string,
  _payload: unknown,
): Promise<void> {
  // Velora Bundles does not store customer PII — nothing to redact.
}

export async function handleShopRedact(shopDomain: string): Promise<void> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  if (!shop) return;

  await prisma.shop.delete({
    where: { id: shop.id },
  });
}

export async function getShopIdForWebhook(shopDomain: string): Promise<string> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  if (!shop) {
    const created = await prisma.shop.create({
      data: {
        shopDomain,
        accessToken: "",
        scope: "",
      },
      select: { id: true },
    });
    return created.id;
  }

  return shop.id;
}
