import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import type { MetafieldBundleConfig } from "../types";
import { shopifyQuery } from "./graphql.server";

const SET_METAFIELD = `#graphql
  mutation SetBundleMetafield($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        key
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_SHOP_ID = `#graphql
  query GetShopId {
    shop {
      id
    }
  }
`;

export async function syncBundleToMetafields(
  admin: AdminApiContext,
  shopDomain: string,
): Promise<void> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  if (!shop) return;

  const bundles = await prisma.bundle.findMany({
    where: {
      shopId: shop.id,
      status: "ACTIVE",
    },
    include: {
      products: { orderBy: { sortOrder: "asc" } },
      volumeDiscounts: { orderBy: { sortOrder: "asc" } },
    },
  });

  const config: MetafieldBundleConfig[] = bundles.map((bundle) => ({
    id: bundle.id,
    productIds: bundle.products.map((p) => p.shopifyProductId),
    minQuantity: Math.max(
      2,
      bundle.products.reduce((sum, p) => sum + p.quantity, 0),
    ),
    discountType: bundle.discountType,
    discountValue: bundle.discountValue,
    volumeTiers: bundle.volumeDiscounts.map((tier) => ({
      minQuantity: tier.minQuantity,
      discountType: tier.discountType,
      discountValue: tier.discountValue,
    })),
  }));

  const shopData = await shopifyQuery<{ shop: { id: string } }>(
    admin,
    GET_SHOP_ID,
  );

  await shopifyQuery(admin, SET_METAFIELD, {
    metafields: [
      {
        ownerId: shopData.shop.id,
        namespace: "velora_bundles",
        key: "active_bundles",
        value: JSON.stringify(config),
        type: "json",
      },
    ],
  });
}
