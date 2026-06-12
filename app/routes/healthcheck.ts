import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { pingRedis } from "../redis.server";

const VERSION = process.env.APP_VERSION ?? "1.0.0";

export const loader = async (_args: LoaderFunctionArgs) => {
  let databaseStatus: "healthy" | "unhealthy" = "unhealthy";

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseStatus = "healthy";
  } catch {
    databaseStatus = "unhealthy";
  }

  const redisHealthy = await pingRedis();
  const isHealthy = databaseStatus === "healthy";

  const body = {
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    services: {
      database: databaseStatus,
      redis: redisHealthy ? "healthy" : "unavailable",
    },
    version: VERSION,
    environment: process.env.NODE_ENV ?? "development",
    uptime: Math.floor(process.uptime()),
  };

  return new Response(JSON.stringify(body), {
    status: isHealthy ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
};
