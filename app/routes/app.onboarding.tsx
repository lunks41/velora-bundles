import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  redirect,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { invalidateShopCache } from "../redis.server";
import { syncBundleToMetafields } from "../utils/metafields.server";
import { captureException } from "../sentry.server";
import BundlePreview from "../components/BundlePreview";
import type { BundleFormData } from "../types";

const STEPS = ["welcome", "create", "go-live"] as const;
type OnboardingStep = (typeof STEPS)[number];

function isValidStep(step: string | null): step is OnboardingStep {
  return STEPS.includes(step as OnboardingStep);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const stepParam = url.searchParams.get("step");
  const step: OnboardingStep = isValidStep(stepParam) ? stepParam : "welcome";

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { onboardingDone: true },
  });

  if (shop?.onboardingDone) {
    throw redirect("/app");
  }

  return { step };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    return { error: "Shop not found" };
  }

  try {
    if (intent === "create_bundle") {
      const name = (formData.get("name") as string) || "My first bundle";
      const title = (formData.get("title") as string) || "Bundle & Save";
      const discountValue = Number(formData.get("discountValue") || 10);

      await prisma.bundle.create({
        data: {
          shopId: shop.id,
          name,
          title,
          status: "DRAFT",
          bundleType: "FIXED",
          discountType: "PERCENTAGE",
          discountValue,
          volumeDiscounts: {
            create: [
              {
                minQuantity: 2,
                discountType: "PERCENTAGE",
                discountValue,
                label: "Buy 2",
                isMostPopular: true,
                sortOrder: 0,
              },
              {
                minQuantity: 3,
                discountType: "PERCENTAGE",
                discountValue: discountValue + 5,
                label: "Buy 3",
                isMostPopular: false,
                sortOrder: 1,
              },
            ],
          },
        },
      });

      return { success: true, nextStep: "go-live" as const };
    }

    if (intent === "complete_onboarding") {
      await prisma.bundle.updateMany({
        where: { shopId: shop.id, status: "DRAFT" },
        data: { status: "ACTIVE" },
      });

      await syncBundleToMetafields(admin, session.shop);

      await prisma.shop.update({
        where: { id: shop.id },
        data: { onboardingDone: true },
      });

      await invalidateShopCache(session.shop);
      throw redirect("/app");
    }

    return { error: "Unknown action" };
  } catch (error) {
    if (error instanceof Response) throw error;
    captureException(error);
    return { error: "Something went wrong" };
  }
};

export default function OnboardingPage() {
  const { step: loaderStep } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const step = (searchParams.get("step") as OnboardingStep) || loaderStep;

  const [bundleName, setBundleName] = useState("Summer bundle");
  const [bundleTitle, setBundleTitle] = useState("Bundle & Save");
  const [discountValue, setDiscountValue] = useState(10);

  const previewData: BundleFormData = {
    name: bundleName,
    title: bundleTitle,
    status: "DRAFT",
    bundleType: "FIXED",
    discountType: "PERCENTAGE",
    discountValue,
    widgetPosition: "above_atc",
    products: [],
    volumeDiscounts: [
      {
        minQuantity: 2,
        discountType: "PERCENTAGE",
        discountValue,
        label: "Buy 2",
        isMostPopular: true,
        sortOrder: 0,
      },
      {
        minQuantity: 3,
        discountType: "PERCENTAGE",
        discountValue: discountValue + 5,
        label: "Buy 3",
        isMostPopular: false,
        sortOrder: 1,
      },
    ],
  };

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data.nextStep) {
      setSearchParams({ step: fetcher.data.nextStep });
    }
    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, setSearchParams, shopify]);

  const goToStep = (next: OnboardingStep) => {
    setSearchParams({ step: next });
  };

  const handleCreateBundle = () => {
    const payload = new FormData();
    payload.set("intent", "create_bundle");
    payload.set("name", bundleName);
    payload.set("title", bundleTitle);
    payload.set("discountValue", String(discountValue));
    fetcher.submit(payload, { method: "post" });
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <s-page heading="Welcome to Velora Bundles">
      <s-section>
        <s-stack direction="inline" gap="base">
          {STEPS.map((s, i) => (
            <s-badge key={s} tone={i <= stepIndex ? "success" : "info"}>
              {i + 1}. {s === "go-live" ? "Go live" : s}
            </s-badge>
          ))}
        </s-stack>
      </s-section>

      {step === "welcome" && (
        <s-section heading="Increase your average order value">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Velora Bundles helps you create product bundles with volume
              discounts that appear directly on your product pages.
            </s-paragraph>
            <s-unordered-list>
              <s-list-item>Volume discount tiers with savings badges</s-list-item>
              <s-list-item>Live preview while you build</s-list-item>
              <s-list-item>Analytics to track bundle performance</s-list-item>
            </s-unordered-list>
            <s-button onClick={() => goToStep("create")}>Get started</s-button>
          </s-stack>
        </s-section>
      )}

      {step === "create" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
          }}
        >
          <s-section heading="Create your first bundle">
            <s-stack direction="block" gap="base">
              <s-text-field
                label="Bundle name"
                value={bundleName}
                onInput={(e) => setBundleName(e.currentTarget.value)}
              />
              <s-text-field
                label="Display title"
                value={bundleTitle}
                onInput={(e) => setBundleTitle(e.currentTarget.value)}
              />
              <s-number-field
                label="Discount (%)"
                value={String(discountValue)}
                onInput={(e) =>
                  setDiscountValue(Number(e.currentTarget.value))
                }
              />
              <s-stack direction="inline" gap="base">
                <s-button
                  variant="tertiary"
                  onClick={() => goToStep("welcome")}
                >
                  Back
                </s-button>
                <s-button
                  onClick={handleCreateBundle}
                  {...(fetcher.state !== "idle" ? { loading: true } : {})}
                >
                  Continue
                </s-button>
              </s-stack>
            </s-stack>
          </s-section>

          <s-section heading="Preview">
            <BundlePreview formData={previewData} />
          </s-section>
        </div>
      )}

      {step === "go-live" && (
        <s-section heading="You're ready to go live">
          <s-stack direction="block" gap="base">
            <s-banner tone="success">
              Your bundle has been created. Activate it to show the widget on
              your storefront.
            </s-banner>
            <s-paragraph>
              The Velora widget will appear on product pages based on your
              bundle configuration. You can customize appearance in Settings.
            </s-paragraph>
            <s-stack direction="inline" gap="base">
              <s-button variant="tertiary" onClick={() => goToStep("create")}>
                Back
              </s-button>
              <fetcher.Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="complete_onboarding"
                />
                <s-button
                  type="submit"
                  {...(fetcher.state !== "idle" ? { loading: true } : {})}
                >
                  Go live
                </s-button>
              </fetcher.Form>
            </s-stack>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
