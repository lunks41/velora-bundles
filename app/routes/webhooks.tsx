import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { captureException } from "../sentry.server";
import { authenticate } from "../shopify.server";
import {
  getShopIdForWebhook,
  handleAppUninstalled,
  handleCustomersDataRequest,
  handleCustomersRedact,
  handleOrderPaid,
  handleProductUpdate,
  handleShopRedact,
} from "../utils/webhooks.server";

const TOPIC_HANDLERS: Record<
  string,
  (shop: string, payload: unknown) => Promise<void>
> = {
  APP_UNINSTALLED: (shop) => handleAppUninstalled(shop),
  "app/uninstalled": (shop) => handleAppUninstalled(shop),
  ORDERS_PAID: (shop, payload) => handleOrderPaid(shop, payload),
  "orders/paid": (shop, payload) => handleOrderPaid(shop, payload),
  PRODUCTS_UPDATE: (shop, payload) => handleProductUpdate(shop, payload),
  "products/update": (shop, payload) => handleProductUpdate(shop, payload),
  CUSTOMERS_DATA_REQUEST: (shop, payload) =>
    handleCustomersDataRequest(shop, payload),
  "customers/data_request": (shop, payload) =>
    handleCustomersDataRequest(shop, payload),
  CUSTOMERS_REDACT: (shop, payload) => handleCustomersRedact(shop, payload),
  "customers/redact": (shop, payload) => handleCustomersRedact(shop, payload),
  SHOP_REDACT: (shop) => handleShopRedact(shop),
  "shop/redact": (shop) => handleShopRedact(shop),
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { shop, topic, payload } = await authenticate.webhook(request);
    const webhookId = request.headers.get("X-Shopify-Webhook-Id");

    if (webhookId) {
      const existing = await prisma.webhookLog.findUnique({
        where: { shopifyWebhookId: webhookId },
        select: { processed: true },
      });

      if (existing?.processed) {
        return new Response(null, { status: 200 });
      }
    }

    const shopId = await getShopIdForWebhook(shop);

    if (webhookId) {
      await prisma.webhookLog.upsert({
        where: { shopifyWebhookId: webhookId },
        create: {
          shopId,
          topic,
          shopifyWebhookId: webhookId,
          payload: payload as object,
          processed: false,
        },
        update: {},
      });
    }

    const handler = TOPIC_HANDLERS[topic];
    if (handler) {
      await handler(shop, payload);
    }

    if (webhookId) {
      await prisma.webhookLog.update({
        where: { shopifyWebhookId: webhookId },
        data: { processed: true, processedAt: new Date() },
      });
    }
  } catch (error) {
    captureException(error);
  }

  return new Response(null, { status: 200 });
};
