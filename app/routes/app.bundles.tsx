import { useEffect } from "react";
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
import { CACHE_TTL, getCached, invalidateShopCache } from "../redis.server";
import { syncBundleToMetafields } from "../utils/metafields.server";
import { captureException } from "../sentry.server";
import type { BundleStatus } from "../types";

interface BundleListItem {
  id: string;
  name: string;
  title: string;
  status: BundleStatus;
  bundleType: string;
  productCount: number;
  volumeDiscountCount: number;
  monthlyRevenue: number;
  updatedAt: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    return { bundles: [] as BundleListItem[] };
  }

  const bundles = await getCached(
    `shop:${session.shop}:bundles:list`,
    async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const rows = await prisma.bundle.findMany({
        where: { shopId: shop.id, status: { not: "ARCHIVED" } },
        include: {
          _count: { select: { products: true, volumeDiscounts: true } },
          analytics: {
            where: { date: { gte: thirtyDaysAgo } },
            select: { revenue: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      return rows.map((bundle) => ({
        id: bundle.id,
        name: bundle.name,
        title: bundle.title,
        status: bundle.status,
        bundleType: bundle.bundleType,
        productCount: bundle._count.products,
        volumeDiscountCount: bundle._count.volumeDiscounts,
        monthlyRevenue: bundle.analytics.reduce(
          (sum, row) => sum + row.revenue,
          0,
        ),
        updatedAt: bundle.updatedAt.toISOString(),
      }));
    },
    CACHE_TTL.BUNDLE_LIST,
  );

  return { bundles };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    return { error: "Shop not found" };
  }

  const bundleId = formData.get("bundleId") as string;

  try {
    if (intent === "toggle_status") {
      const bundle = await prisma.bundle.findFirst({
        where: { id: bundleId, shopId: shop.id },
      });

      if (!bundle) {
        return { error: "Bundle not found" };
      }

      const newStatus: BundleStatus =
        bundle.status === "ACTIVE" ? "DRAFT" : "ACTIVE";

      await prisma.bundle.update({
        where: { id: bundleId },
        data: { status: newStatus },
      });

      await syncBundleToMetafields(admin, session.shop);
      await invalidateShopCache(session.shop);
      return { success: true, message: `Bundle ${newStatus === "ACTIVE" ? "activated" : "deactivated"}` };
    }

    if (intent === "archive_bundle") {
      await prisma.bundle.updateMany({
        where: { id: bundleId, shopId: shop.id },
        data: { status: "ARCHIVED" },
      });

      await invalidateShopCache(session.shop);
      return { success: true, message: "Bundle archived" };
    }

    return { error: "Unknown action" };
  } catch (error) {
    captureException(error);
    return { error: "Something went wrong" };
  }
};

function statusTone(
  status: BundleStatus,
): "success" | "info" | "warning" | "critical" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "DRAFT":
      return "warning";
    default:
      return "info";
  }
}

export default function BundlesPage() {
  const { bundles } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data.message) {
      shopify.toast.show(fetcher.data.message);
    }
    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const isSubmitting = fetcher.state !== "idle";

  return (
    <s-page heading="Bundles">
      <s-button slot="primary-action" href="/app/bundles/new">
        Create bundle
      </s-button>

      {bundles.length === 0 ? (
        <s-section>
          <s-stack direction="block" gap="base">
            <s-heading>No bundles yet</s-heading>
            <s-paragraph>
              Create your first product bundle to increase average order value
              and boost sales.
            </s-paragraph>
            <s-button href="/app/bundles/new">Create your first bundle</s-button>
          </s-stack>
        </s-section>
      ) : (
        <s-section>
          <s-stack direction="block" gap="base">
            {bundles.map((bundle: BundleListItem) => (
              <s-box
                key={bundle.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-stack direction="inline" gap="base">
                  <s-stack direction="block" gap="small">
                    <s-stack direction="inline" gap="small">
                      <s-link href={`/app/bundles/${bundle.id}`}>
                        <s-heading>{bundle.name}</s-heading>
                      </s-link>
                      <s-badge tone={statusTone(bundle.status)}>
                        {bundle.status}
                      </s-badge>
                      <s-badge tone="info">{bundle.bundleType}</s-badge>
                    </s-stack>
                    <s-paragraph>{bundle.title}</s-paragraph>
                    <s-paragraph>
                      {bundle.productCount} product
                      {bundle.productCount !== 1 ? "s" : ""} ·{" "}
                      {bundle.volumeDiscountCount} volume tier
                      {bundle.volumeDiscountCount !== 1 ? "s" : ""} · $
                      {bundle.monthlyRevenue.toFixed(2)} (30d) · Updated{" "}
                      {new Date(bundle.updatedAt).toLocaleDateString()}
                    </s-paragraph>
                  </s-stack>

                  <s-stack direction="inline" gap="small">
                    <s-button href={`/app/bundles/${bundle.id}`} variant="tertiary">
                      Edit
                    </s-button>
                    <fetcher.Form method="post">
                      <input type="hidden" name="bundleId" value={bundle.id} />
                      <input
                        type="hidden"
                        name="intent"
                        value="toggle_status"
                      />
                      <s-button
                        type="submit"
                        variant="tertiary"
                        {...(isSubmitting ? { loading: true } : {})}
                      >
                        {bundle.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </s-button>
                    </fetcher.Form>
                    <fetcher.Form method="post">
                      <input type="hidden" name="bundleId" value={bundle.id} />
                      <input
                        type="hidden"
                        name="intent"
                        value="archive_bundle"
                      />
                      <s-button
                        type="submit"
                        variant="tertiary"
                        tone="critical"
                        {...(isSubmitting ? { loading: true } : {})}
                      >
                        Archive
                      </s-button>
                    </fetcher.Form>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-section>
      )}

      <s-section slot="aside" heading="Tips">
        <s-paragraph>
          Active bundles appear on product pages via the Velora widget. Draft
          bundles are saved but not shown to customers.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
