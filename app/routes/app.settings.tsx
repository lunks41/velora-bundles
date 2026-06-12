import { useEffect, useState } from "react";
import type { Prisma } from "@prisma/client";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { invalidateShopCache } from "../redis.server";
import { captureException } from "../sentry.server";
import {
  getPlanDisplayName,
  PLAN_LIMITS,
} from "../constants/plans";
import { getCurrentPlan } from "../utils/billing.server";
import BundlePreview from "../components/BundlePreview";
import {
  DEFAULT_WIDGET_SETTINGS,
  EMPTY_BUNDLE_FORM,
  type BundleFormData,
  type WidgetSettings,
} from "../types";

const DEMO_PREVIEW: BundleFormData = {
  ...EMPTY_BUNDLE_FORM,
  title: "Bundle & Save",
  discountType: "PERCENTAGE",
  discountValue: 15,
  volumeDiscounts: [
    {
      minQuantity: 2,
      discountType: "PERCENTAGE",
      discountValue: 10,
      label: "Buy 2",
      isMostPopular: false,
      sortOrder: 0,
    },
    {
      minQuantity: 3,
      discountType: "PERCENTAGE",
      discountValue: 15,
      label: "Buy 3",
      isMostPopular: true,
      sortOrder: 1,
    },
  ],
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { widgetSettings: true },
  });

  const currentPlan = await getCurrentPlan(session.shop);
  const limits = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS];

  const widgetSettings: WidgetSettings = {
    ...DEFAULT_WIDGET_SETTINGS,
    ...((shop?.widgetSettings as WidgetSettings | null) ?? {}),
  };

  return {
    widgetSettings,
    currentPlan,
    planDisplayName: getPlanDisplayName(currentPlan),
    limits,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "save_settings") {
    return { error: "Unknown action" };
  }

  try {
    const settings: WidgetSettings = JSON.parse(
      formData.get("settings") as string,
    );

    await prisma.shop.update({
      where: { shopDomain: session.shop },
      data: { widgetSettings: settings as Prisma.InputJsonValue },
    });

    await invalidateShopCache(session.shop);
    return { success: true, widgetSettings: settings };
  } catch (error) {
    captureException(error);
    return { error: "Failed to save settings" };
  }
};

export default function SettingsPage() {
  const { widgetSettings: initial, currentPlan, planDisplayName, limits } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [settings, setSettings] = useState<WidgetSettings>(initial);

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data.widgetSettings) {
      setSettings(fetcher.data.widgetSettings);
      shopify.toast.show("Settings saved");
    }
    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const updateSetting = <K extends keyof WidgetSettings>(
    key: K,
    value: WidgetSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const payload = new FormData();
    payload.set("intent", "save_settings");
    payload.set("settings", JSON.stringify(settings));
    fetcher.submit(payload, { method: "post" });
  };

  return (
    <s-page heading="Settings">
      <s-button
        slot="primary-action"
        onClick={handleSave}
        {...(fetcher.state !== "idle" ? { loading: true } : {})}
      >
        Save settings
      </s-button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
        }}
      >
        <s-stack direction="block" gap="base">
          <s-section heading="Widget appearance">
            <s-stack direction="block" gap="base">
              <s-select
                label="Theme"
                value={settings.theme ?? "light"}
                onChange={(e) =>
                  updateSetting(
                    "theme",
                    e.currentTarget.value as WidgetSettings["theme"],
                  )
                }
              >
                <s-option value="light">Light</s-option>
                <s-option value="dark">Dark</s-option>
                <s-option value="minimal">Minimal</s-option>
                <s-option value="branded">Branded</s-option>
              </s-select>
              <s-text-field
                label="Primary color"
                value={settings.primaryColor ?? "#008060"}
                onInput={(e) =>
                  updateSetting("primaryColor", e.currentTarget.value)
                }
              />
              <s-text-field
                label="Background color"
                value={settings.backgroundColor ?? "#ffffff"}
                onInput={(e) =>
                  updateSetting("backgroundColor", e.currentTarget.value)
                }
              />
              <s-text-field
                label="Button color"
                value={settings.buttonColor ?? "#1a1a1a"}
                onInput={(e) =>
                  updateSetting("buttonColor", e.currentTarget.value)
                }
              />
              <s-number-field
                label="Border radius (px)"
                value={String(settings.borderRadius ?? 8)}
                onInput={(e) =>
                  updateSetting("borderRadius", Number(e.currentTarget.value))
                }
              />
              <s-select
                label="Default widget position"
                value={settings.defaultPosition ?? "above_atc"}
                onChange={(e) =>
                  updateSetting(
                    "defaultPosition",
                    e.currentTarget.value as WidgetSettings["defaultPosition"],
                  )
                }
              >
                <s-option value="above_atc">Above add to cart</s-option>
                <s-option value="below_atc">Below add to cart</s-option>
              </s-select>
            </s-stack>
          </s-section>

          <s-section heading="Your plan">
            <s-stack direction="block" gap="small">
              <s-stack direction="inline" gap="small">
                <s-heading>{planDisplayName}</s-heading>
                <s-badge tone="info">{currentPlan}</s-badge>
              </s-stack>
              <s-paragraph>
                {limits.bundles === Infinity
                  ? "Unlimited bundles"
                  : `Up to ${limits.bundles} bundle${limits.bundles !== 1 ? "s" : ""}`}
                {limits.abTesting ? " · A/B testing enabled" : ""}
                {limits.aiFeatures ? " · AI features enabled" : ""}
              </s-paragraph>
              <s-button href="/app/billing" variant="tertiary">
                Manage billing
              </s-button>
            </s-stack>
          </s-section>

          <s-section heading="Support">
            <s-stack direction="block" gap="small">
              <s-paragraph>
                Need help setting up bundles or customizing your widget?
              </s-paragraph>
              <s-link href="mailto:support@velorabundles.com">
                Contact support
              </s-link>
              <s-link
                href="https://shopify.dev/docs/apps"
                target="_blank"
              >
                Documentation
              </s-link>
            </s-stack>
          </s-section>
        </s-stack>

        <s-section heading="Live preview">
          <BundlePreview formData={DEMO_PREVIEW} widgetSettings={settings} />
        </s-section>
      </div>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
