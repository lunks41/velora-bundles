import type { Plan } from "../types";

export const PLANS = {
  FREE: { name: "Free", amount: 0, currencyCode: "USD", trialDays: 0 },
  STARTER: {
    name: "Starter",
    amount: 9.99,
    currencyCode: "USD",
    trialDays: 14,
    interval: "EVERY_30_DAYS",
  },
  GROWTH: {
    name: "Growth",
    amount: 19.99,
    currencyCode: "USD",
    trialDays: 14,
    interval: "EVERY_30_DAYS",
  },
  PRO: {
    name: "Pro",
    amount: 39.99,
    currencyCode: "USD",
    trialDays: 14,
    interval: "EVERY_30_DAYS",
  },
} as const;

export const PLAN_LIMITS = {
  FREE: { bundles: 1, abTesting: false, aiFeatures: false },
  STARTER: { bundles: 5, abTesting: false, aiFeatures: false },
  GROWTH: { bundles: Infinity, abTesting: true, aiFeatures: false },
  PRO: { bundles: Infinity, abTesting: true, aiFeatures: true },
} as const;

export function getPlanDisplayName(plan: Plan): string {
  return PLANS[plan].name;
}
