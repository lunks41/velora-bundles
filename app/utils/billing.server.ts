import type { Plan } from "@prisma/client";
import type { AdminApiContext, Session } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { PLANS, PLAN_LIMITS } from "../constants/plans";
import { CACHE_TTL, getCached, invalidateShopCache } from "../redis.server";
import { shopifyQuery } from "./graphql.server";

export { PLANS, PLAN_LIMITS, getPlanDisplayName } from "../constants/plans";

type PlanFeature = keyof typeof PLAN_LIMITS.FREE;

const CREATE_SUBSCRIPTION = `#graphql
  mutation CreateSubscription(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $trialDays: Int
  ) {
    appSubscriptionCreate(
      name: $name
      lineItems: $lineItems
      returnUrl: $returnUrl
      trialDays: $trialDays
      test: true
    ) {
      appSubscription {
        id
        status
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

export async function getCurrentPlan(shopDomain: string): Promise<Plan> {
  return getCached(
    `shop:${shopDomain}:plan`,
    async () => {
      const shop = await prisma.shop.findUnique({
        where: { shopDomain },
        select: { plan: true },
      });
      return shop?.plan ?? "FREE";
    },
    CACHE_TTL.SHOP_PLAN,
  );
}

export async function checkPlanLimit(
  shopId: string,
  shopDomain: string,
  feature: PlanFeature,
): Promise<boolean> {
  const plan = await getCurrentPlan(shopDomain);
  const limits = PLAN_LIMITS[plan];

  if (feature === "bundles") {
    const count = await prisma.bundle.count({
      where: { shopId, status: { not: "ARCHIVED" } },
    });
    return count < limits.bundles;
  }

  if (feature === "abTesting") return limits.abTesting;
  if (feature === "aiFeatures") return limits.aiFeatures;

  return false;
}

export async function redirectToBilling(
  admin: AdminApiContext,
  session: Session,
  planName: Exclude<Plan, "FREE">,
): Promise<string> {
  const plan = PLANS[planName];
  const appUrl = process.env.SHOPIFY_APP_URL ?? "";
  const returnUrl = `${appUrl}/app/billing?plan=${planName}&charge_id=placeholder`;

  const data = await shopifyQuery<{
    appSubscriptionCreate: {
      confirmationUrl: string | null;
      userErrors: Array<{ message: string }>;
    };
  }>(admin, CREATE_SUBSCRIPTION, {
    name: `${plan.name} Plan`,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount: plan.amount, currencyCode: plan.currencyCode },
            interval: "interval" in plan ? plan.interval : "EVERY_30_DAYS",
          },
        },
      },
    ],
    returnUrl,
    trialDays: plan.trialDays,
  });

  if (data.appSubscriptionCreate.userErrors.length > 0) {
    throw new Error(data.appSubscriptionCreate.userErrors[0]?.message);
  }

  const confirmationUrl = data.appSubscriptionCreate.confirmationUrl;
  if (!confirmationUrl) {
    throw new Error("No confirmation URL returned from billing API");
  }

  return confirmationUrl;
}

export async function handleBillingCallback(
  shopDomain: string,
  plan: Exclude<Plan, "FREE">,
  chargeId: string,
): Promise<void> {
  await prisma.shop.update({
    where: { shopDomain },
    data: {
      plan,
      billingChargeId: chargeId,
    },
  });

  await invalidateShopCache(shopDomain);
}
