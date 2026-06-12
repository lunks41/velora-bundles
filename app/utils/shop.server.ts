import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { encryptToken } from "./crypto.server";

const GET_SHOP_DETAILS = `#graphql
  query GetShopDetails {
    shop {
      id
      name
      email
      currencyCode
      timezoneAbbreviation
      myshopifyDomain
      contactEmail
    }
  }
`;

export async function upsertShopFromSession(
  session: { shop: string; accessToken: string; scope?: string | null },
  admin: AdminApiContext,
): Promise<{ id: string; shopDomain: string; onboardingDone: boolean }> {
  const response = await admin.graphql(GET_SHOP_DETAILS);
  const json = (await response.json()) as {
    data?: {
      shop?: {
        email?: string;
        currencyCode?: string;
        timezoneAbbreviation?: string;
      };
    };
  };

  const shopDetails = json.data?.shop;
  const encryptedToken = encryptToken(session.accessToken);

  const shop = await prisma.shop.upsert({
    where: { shopDomain: session.shop },
    update: {
      accessToken: encryptedToken,
      scope: session.scope ?? "",
      isActive: true,
      uninstalledAt: null,
      email: shopDetails?.email ?? undefined,
      currency: shopDetails?.currencyCode ?? "USD",
      timezone: shopDetails?.timezoneAbbreviation ?? "UTC",
    },
    create: {
      shopDomain: session.shop,
      accessToken: encryptedToken,
      scope: session.scope ?? "",
      email: shopDetails?.email ?? undefined,
      currency: shopDetails?.currencyCode ?? "USD",
      timezone: shopDetails?.timezoneAbbreviation ?? "UTC",
    },
    select: {
      id: true,
      shopDomain: true,
      onboardingDone: true,
    },
  });

  return shop;
}

export async function getShopByDomain(shopDomain: string) {
  return prisma.shop.findUnique({
    where: { shopDomain },
  });
}

export async function getShopIdByDomain(shopDomain: string): Promise<string | null> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });
  return shop?.id ?? null;
}
