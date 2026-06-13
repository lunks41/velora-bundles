import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { initSentry } from "./sentry.server";
import { upsertShopFromSession } from "./utils/shop.server";

initSentry();

function cleanEnv(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/^["'\s]+|["'\s]+$/g, "");
}

function cleanAppUrl(value: string | undefined): string {
  return cleanEnv(value).replace(/\/+$/, "");
}

function parseScopes(value: string | undefined): string[] | undefined {
  const scopes = cleanEnv(value)
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  return scopes.length > 0 ? scopes : undefined;
}

const shopifyApiKey = cleanEnv(process.env.SHOPIFY_API_KEY);
const shopifyApiSecret = cleanEnv(process.env.SHOPIFY_API_SECRET);
const shopifyAppUrl = cleanAppUrl(process.env.SHOPIFY_APP_URL);
const shopifyScopes = parseScopes(process.env.SCOPES);

if (process.env.NODE_ENV === "production") {
  console.log("[velora-bundles] Shopify config loaded", {
    appUrl: shopifyAppUrl,
    apiKeyPrefix: shopifyApiKey ? `${shopifyApiKey.slice(0, 8)}...` : "(missing)",
    scopeCount: shopifyScopes?.length ?? 0,
  });
}

const prismaSessionStorage = new PrismaSessionStorage(prisma, {
  connectionRetries: 10,
  connectionRetryIntervalMs: 3000,
});

void prismaSessionStorage.isReady().catch((error: unknown) => {
  console.error("[session-storage] initialization failed:", error);
});

const shopify = shopifyApp({
  apiKey: shopifyApiKey,
  apiSecretKey: shopifyApiSecret,
  apiVersion: ApiVersion.October25,
  scopes: shopifyScopes,
  appUrl: shopifyAppUrl,
  authPathPrefix: "/auth",
  sessionStorage: prismaSessionStorage,
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      if (!session.accessToken) return;
      await upsertShopFromSession(
        {
          shop: session.shop,
          accessToken: session.accessToken,
          scope: session.scope,
        },
        admin,
      );
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiKey = shopifyApiKey;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

export { PLANS, PLAN_LIMITS } from "./constants/plans";
