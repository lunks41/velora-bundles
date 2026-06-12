import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getDashboardStats } from "../utils/analytics.server";
import AnalyticsChart from "../components/AnalyticsChart";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    return {
      stats: {
        totalRevenue: 0,
        revenueChangePercent: 0,
        totalViews: 0,
        totalClicks: 0,
        ctr: 0,
        activeBundles: 0,
        topBundle: null,
        chartData: [],
      },
    };
  }

  const stats = await getDashboardStats(shop.id, session.shop);
  return { stats };
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export default function DashboardPage() {
  const { stats } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Dashboard">
      <s-button slot="primary-action" href="/app/bundles/new">
        Create bundle
      </s-button>

      <s-section heading="Last 30 days">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-paragraph>Revenue</s-paragraph>
              <s-heading>{formatCurrency(stats.totalRevenue)}</s-heading>
              <s-badge
                tone={
                  stats.revenueChangePercent >= 0 ? "success" : "critical"
                }
              >
                {formatPercent(stats.revenueChangePercent)} vs prior period
              </s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-paragraph>Widget views</s-paragraph>
              <s-heading>{stats.totalViews.toLocaleString()}</s-heading>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-paragraph>Click-through rate</s-paragraph>
              <s-heading>{stats.ctr.toFixed(1)}%</s-heading>
              <s-paragraph>
                {stats.totalClicks.toLocaleString()} clicks
              </s-paragraph>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-paragraph>Active bundles</s-paragraph>
              <s-heading>{stats.activeBundles}</s-heading>
            </s-stack>
          </s-box>
        </div>

        <AnalyticsChart data={stats.chartData} />
      </s-section>

      <s-section heading="Top performing bundle">
        {stats.topBundle ? (
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base">
              <s-stack direction="block" gap="small">
                <s-link href={`/app/bundles/${stats.topBundle.id}`}>
                  <s-heading>{stats.topBundle.name}</s-heading>
                </s-link>
                <s-paragraph>
                  {formatCurrency(stats.topBundle.revenue)} revenue ·{" "}
                  {stats.topBundle.conversionRate.toFixed(1)}% conversion
                </s-paragraph>
              </s-stack>
              <s-button
                href={`/app/bundles/${stats.topBundle.id}`}
                variant="tertiary"
              >
                View bundle
              </s-button>
            </s-stack>
          </s-box>
        ) : (
          <s-paragraph>
            No bundle data yet.{" "}
            <s-link href="/app/bundles/new">Create your first bundle</s-link> to
            get started.
          </s-paragraph>
        )}
      </s-section>

      <s-section slot="aside" heading="Quick actions">
        <s-stack direction="block" gap="small">
          <s-button href="/app/bundles/new">Create new bundle</s-button>
          <s-button href="/app/bundles" variant="tertiary">
            Manage bundles
          </s-button>
          <s-button href="/app/settings" variant="tertiary">
            Widget settings
          </s-button>
          <s-button href="/app/billing" variant="tertiary">
            View billing
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
