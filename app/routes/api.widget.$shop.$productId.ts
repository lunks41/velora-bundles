import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { CACHE_TTL, getCached } from "../redis.server";
import { captureException } from "../sentry.server";
import type { WidgetApiResponse } from "../types";
import { trackWidgetEvent } from "../utils/analytics.server";

// Rate limit: 100 req/min per shop via Redis (see project security rules).

function corsHeaders(shop: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": `https://${shop}`,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=30",
  };
}

function normalizeProductId(productId: string): string {
  if (productId.startsWith("gid://")) {
    return productId;
  }
  return `gid://shopify/Product/${productId}`;
}

async function findWidgetData(
  shop: string,
  productId: string,
): Promise<WidgetApiResponse | null> {
  const shopifyProductId = normalizeProductId(productId);

  return getCached(
    `widget:${shop}:${productId}`,
    async () => {
      const shopRecord = await prisma.shop.findUnique({
        where: { shopDomain: shop },
        select: { id: true, widgetSettings: true },
      });

      if (!shopRecord) return null;

      const bundle = await prisma.bundle.findFirst({
        where: {
          shopId: shopRecord.id,
          status: "ACTIVE",
          products: { some: { shopifyProductId } },
        },
        include: {
          products: { orderBy: { sortOrder: "asc" } },
          volumeDiscounts: { orderBy: { sortOrder: "asc" } },
        },
      });

      if (!bundle) return null;

      const response: WidgetApiResponse = {
        bundleId: bundle.id,
        title: bundle.title,
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
        })),
        volumeDiscounts: bundle.volumeDiscounts.map((tier) => ({
          minQuantity: tier.minQuantity,
          maxQuantity: tier.maxQuantity ?? undefined,
          discountType: tier.discountType,
          discountValue: tier.discountValue,
          label: tier.label,
          isMostPopular: tier.isMostPopular,
          sortOrder: tier.sortOrder,
        })),
        widgetSettings:
          shopRecord.widgetSettings as WidgetApiResponse["widgetSettings"],
      };

      return response;
    },
    CACHE_TTL.WIDGET_DATA,
  );
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const shop = params.shop;
  const productId = params.productId;

  if (!shop || !productId) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const data = await findWidgetData(shop, productId);

    if (!data) {
      return new Response(null, {
        status: 404,
        headers: corsHeaders(shop),
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(shop),
      },
    });
  } catch (error) {
    captureException(error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const shop = params.shop;

  if (!shop) {
    return new Response(JSON.stringify({ error: "Missing shop" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(shop) });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders(shop),
    });
  }

  try {
    const body = (await request.json()) as {
      bundleId?: string;
      event?: "view" | "click";
    };

    if (!body.bundleId || !body.event) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(shop),
        },
      });
    }

    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain: shop },
      select: { id: true },
    });

    if (!shopRecord) {
      return new Response(null, { status: 404, headers: corsHeaders(shop) });
    }

    await trackWidgetEvent(body.bundleId, shopRecord.id, body.event);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(shop),
      },
    });
  } catch (error) {
    captureException(error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
