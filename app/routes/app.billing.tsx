import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useFetcher, useLoaderData } from "react-router";
import type { Plan } from "../types";
import { getPlanDisplayName, PLANS, PLAN_LIMITS } from "../constants/plans";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  getCurrentPlan,
  handleBillingCallback,
  redirectToBilling,
} from "../utils/billing.server";
import { captureException } from "../sentry.server";

const PAID_PLANS = ["STARTER", "GROWTH", "PRO"] as const;
type PaidPlan = (typeof PAID_PLANS)[number];

function isPaidPlan(plan: string | null): plan is PaidPlan {
  return PAID_PLANS.includes(plan as PaidPlan);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const chargeId = url.searchParams.get("charge_id");
  const planParam = url.searchParams.get("plan");

  if (chargeId && isPaidPlan(planParam) && chargeId !== "placeholder") {
    try {
      await handleBillingCallback(session.shop, planParam, chargeId);
      throw redirect("/app/billing?upgraded=true");
    } catch (error) {
      if (error instanceof Response) throw error;
      captureException(error);
    }
  }

  const currentPlan = await getCurrentPlan(session.shop);
  const upgraded = url.searchParams.get("upgraded") === "true";

  return { currentPlan, upgraded, plans: PLANS, limits: PLAN_LIMITS };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "upgrade") {
    return { error: "Unknown action" };
  }

  const plan = formData.get("plan") as string;
  if (!isPaidPlan(plan)) {
    return { error: "Invalid plan selected" };
  }

  try {
    const confirmationUrl = await redirectToBilling(admin, session, plan);
    throw redirect(confirmationUrl);
  } catch (error) {
    if (error instanceof Response) throw error;
    captureException(error);
    return { error: "Failed to start billing" };
  }
};

function formatPrice(amount: number): string {
  return amount === 0 ? "Free" : `$${amount.toFixed(2)}/mo`;
}

export default function BillingPage() {
  const { currentPlan, upgraded, plans, limits } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (upgraded) {
      shopify.toast.show("Plan upgraded successfully!");
    }
    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [upgraded, fetcher.data, shopify]);

  const planEntries = Object.entries(plans) as Array<
    [Plan, (typeof plans)[Plan]]
  >;

  return (
    <s-page heading="Billing">
      <s-section heading={`Current plan: ${getPlanDisplayName(currentPlan)}`}>
        {upgraded && (
          <s-banner tone="success">
            Your subscription has been activated. Enjoy your new features!
          </s-banner>
        )}
      </s-section>

      <s-section heading="Choose a plan">
        <s-stack direction="block" gap="base">
          {planEntries.map(([planKey, plan]) => {
            const planLimit = limits[planKey as keyof typeof limits];
            const isCurrent = currentPlan === planKey;
            const isPaid = planKey !== "FREE";

            return (
              <s-box
                key={planKey}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background={isCurrent ? "subdued" : undefined}
              >
                <s-stack direction="inline" gap="base">
                  <s-stack direction="block" gap="small">
                    <s-stack direction="inline" gap="small">
                      <s-heading>{plan.name}</s-heading>
                      {isCurrent && <s-badge tone="success">Current</s-badge>}
                    </s-stack>
                    <s-paragraph>
                      {formatPrice(plan.amount)} ·{" "}
                      {planLimit.bundles === Infinity
                        ? "Unlimited bundles"
                        : `Up to ${planLimit.bundles} bundle${planLimit.bundles !== 1 ? "s" : ""}`}
                      {planLimit.abTesting ? " · A/B testing" : ""}
                      {planLimit.aiFeatures ? " · AI features" : ""}
                    </s-paragraph>
                    {"trialDays" in plan && plan.trialDays > 0 && (
                      <s-paragraph>
                        {plan.trialDays}-day free trial
                      </s-paragraph>
                    )}
                  </s-stack>

                  {isPaid && !isCurrent && (
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="upgrade" />
                      <input type="hidden" name="plan" value={planKey} />
                      <s-button
                        type="submit"
                        {...(fetcher.state !== "idle" ? { loading: true } : {})}
                      >
                        Upgrade to {plan.name}
                      </s-button>
                    </fetcher.Form>
                  )}
                </s-stack>
              </s-box>
            );
          })}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Billing FAQ">
        <s-paragraph>
          Plans are billed through Shopify. You can cancel or change your plan
          at any time from your Shopify admin.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
