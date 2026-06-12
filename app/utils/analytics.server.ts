import prisma from "../db.server";
import { CACHE_TTL, getCached } from "../redis.server";
import type { DashboardStats } from "../types";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardStats(
  shopId: string,
  shopDomain: string,
): Promise<DashboardStats> {
  return getCached(
    `shop:${shopDomain}:analytics:dashboard`,
    async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const [currentPeriod, previousPeriod, activeBundles, bundles] =
        await Promise.all([
          prisma.bundleAnalytics.groupBy({
            by: ["date"],
            where: {
              shopId,
              date: { gte: startOfDay(thirtyDaysAgo) },
            },
            _sum: {
              revenue: true,
              views: true,
              clicks: true,
            },
            orderBy: { date: "asc" },
          }),
          prisma.bundleAnalytics.aggregate({
            where: {
              shopId,
              date: {
                gte: startOfDay(sixtyDaysAgo),
                lt: startOfDay(thirtyDaysAgo),
              },
            },
            _sum: { revenue: true },
          }),
          prisma.bundle.count({
            where: { shopId, status: "ACTIVE" },
          }),
          prisma.bundle.findMany({
            where: { shopId, status: { not: "ARCHIVED" } },
            include: {
              analytics: {
                where: { date: { gte: startOfDay(thirtyDaysAgo) } },
              },
            },
          }),
        ]);

      const totalRevenue = currentPeriod.reduce(
        (sum, row) => sum + (row._sum.revenue ?? 0),
        0,
      );
      const previousRevenue = previousPeriod._sum.revenue ?? 0;
      const revenueChangePercent =
        previousRevenue > 0
          ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
          : 0;

      const totalViews = currentPeriod.reduce(
        (sum, row) => sum + (row._sum.views ?? 0),
        0,
      );
      const totalClicks = currentPeriod.reduce(
        (sum, row) => sum + (row._sum.clicks ?? 0),
        0,
      );
      const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

      let topBundle: DashboardStats["topBundle"] = null;
      let topRevenue = 0;

      for (const bundle of bundles) {
        const bundleRevenue = bundle.analytics.reduce(
          (sum, row) => sum + row.revenue,
          0,
        );
        const bundleViews = bundle.analytics.reduce(
          (sum, row) => sum + row.views,
          0,
        );
        const bundleOrders = bundle.analytics.reduce(
          (sum, row) => sum + row.orders,
          0,
        );

        if (bundleRevenue > topRevenue) {
          topRevenue = bundleRevenue;
          topBundle = {
            id: bundle.id,
            name: bundle.name,
            revenue: bundleRevenue,
            conversionRate:
              bundleViews > 0 ? (bundleOrders / bundleViews) * 100 : 0,
          };
        }
      }

      return {
        totalRevenue,
        revenueChangePercent,
        totalViews,
        totalClicks,
        ctr,
        activeBundles,
        topBundle,
        chartData: currentPeriod.map((row) => ({
          date: row.date.toISOString().split("T")[0] ?? "",
          revenue: row._sum.revenue ?? 0,
        })),
      };
    },
    CACHE_TTL.ANALYTICS,
  );
}

export async function trackWidgetEvent(
  bundleId: string,
  shopId: string,
  event: "view" | "click",
): Promise<void> {
  const today = startOfDay(new Date());

  await prisma.bundleAnalytics.upsert({
    where: {
      bundleId_date: { bundleId, date: today },
    },
    update: {
      views: event === "view" ? { increment: 1 } : undefined,
      clicks: event === "click" ? { increment: 1 } : undefined,
    },
    create: {
      bundleId,
      shopId,
      date: today,
      views: event === "view" ? 1 : 0,
      clicks: event === "click" ? 1 : 0,
    },
  });
}

export async function trackOrderAnalytics(
  shopId: string,
  bundleId: string,
  revenue: number,
  discountGiven: number,
): Promise<void> {
  const today = startOfDay(new Date());

  await prisma.bundleAnalytics.upsert({
    where: {
      bundleId_date: { bundleId, date: today },
    },
    update: {
      orders: { increment: 1 },
      revenue: { increment: revenue },
      discountGiven: { increment: discountGiven },
    },
    create: {
      bundleId,
      shopId,
      date: today,
      orders: 1,
      revenue,
      discountGiven,
    },
  });
}
