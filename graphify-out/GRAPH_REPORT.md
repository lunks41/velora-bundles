# Graph Report - d:/Proj/Work/velora-workspace/velora-bundles  (2026-06-13)

## Corpus Check
- Corpus is ~15,862 words - fits in a single context window. You may not need a graph.

## Summary
- 284 nodes · 516 edges · 23 communities (18 shown, 5 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 1% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Bundle Admin Core|Bundle Admin Core]]
- [[_COMMUNITY_Webhooks and Extensions|Webhooks and Extensions]]
- [[_COMMUNITY_Bundle Types and UI|Bundle Types and UI]]
- [[_COMMUNITY_Auth and Webhooks Server|Auth and Webhooks Server]]
- [[_COMMUNITY_Billing and Redis Cache|Billing and Redis Cache]]
- [[_COMMUNITY_Dashboard and Analytics|Dashboard and Analytics]]
- [[_COMMUNITY_Discount Function|Discount Function]]
- [[_COMMUNITY_Storefront Widget|Storefront Widget]]
- [[_COMMUNITY_Login Flow|Login Flow]]
- [[_COMMUNITY_Pre-Submit Checks|Pre-Submit Checks]]
- [[_COMMUNITY_SSR Entry Point|SSR Entry Point]]
- [[_COMMUNITY_Auth Routes|Auth Routes]]
- [[_COMMUNITY_Shop Onboarding|Shop Onboarding]]
- [[_COMMUNITY_Analytics Chart|Analytics Chart]]
- [[_COMMUNITY_Dashboard Page|Dashboard Page]]
- [[_COMMUNITY_Stream Timeout|Stream Timeout]]
- [[_COMMUNITY_Redis Health Ping|Redis Health Ping]]

## God Nodes (most connected - your core abstractions)
1. `captureException()` - 17 edges
2. `invalidateShopCache()` - 14 edges
3. `Shopify Admin Authentication` - 13 edges
4. `Prisma Client Singleton` - 10 edges
5. `getCached()` - 9 edges
6. `Sentry Exception Capture` - 9 edges
7. `Bundle Save Action` - 9 edges
8. `Cursor Prompt Templates` - 9 edges
9. `syncBundleToMetafields()` - 8 edges
10. `syncBundleToMetafields` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Shopify GraphQL Queries Reference` --cites--> `redirectToBilling`  [INFERRED]
  docs/api/graphql-queries.md → app/utils/billing.server.ts
- `Shopify GraphQL Queries Reference` --cites--> `syncBundleToMetafields`  [INFERRED]
  docs/api/graphql-queries.md → app/utils/metafields.server.ts
- `Key Development Rules` --conceptually_related_to--> `Pre-Submission Checklist Runner`  [INFERRED]
  README.md → scripts/pre-submit-check.ts
- `Shopify GraphQL Queries Reference` --references--> `velora_bundles Metafield Namespace`  [EXTRACTED]
  docs/api/graphql-queries.md → app/utils/metafields.server.ts
- `Vite Shopify Dev Server Config` --conceptually_related_to--> `Shopify Admin Authentication`  [INFERRED]
  vite.config.ts → app/shopify.server.ts

## Communities (23 total, 5 thin omitted)

### Community 0 - "Bundle Admin Core"
Cohesion: 0.07
Nodes (49): Bundle Widget Preview Component, Volume Tier Price Calculator, Track Widget View/Click Event, Widget Analytics POST Action, Widget API GET Loader, Widget Data Resolver, Shopify Product GID Normalizer, Billing Page Component (+41 more)

### Community 1 - "Webhooks and Extensions"
Cohesion: 0.07
Nodes (46): getDashboardStats, trackOrderAnalytics, trackWidgetEvent, Dashboard Loader, checkPlanLimit, getCurrentPlan, handleBillingCallback, redirectToBilling (+38 more)

### Community 2 - "Bundle Types and UI"
Cohesion: 0.08
Nodes (28): invalidateShopCache(), captureException(), BundleFormData, BundleFormProduct, BundleWithRelations, DEFAULT_WIDGET_SETTINGS, EMPTY_BUNDLE_FORM, MetafieldBundleConfig (+20 more)

### Community 3 - "Auth and Webhooks Server"
Cohesion: 0.09
Nodes (16): initSentry(), shopify, action(), TOPIC_HANDLERS, decryptToken(), encryptToken(), getEncryptionKey(), upsertShopFromSession() (+8 more)

### Community 4 - "Billing and Redis Cache"
Cohesion: 0.12
Nodes (21): CACHE_TTL, getCached(), pingRedis(), WidgetSettings, getPlanDisplayName(), PLAN_LIMITS, PLANS, action() (+13 more)

### Community 5 - "Dashboard and Analytics"
Cohesion: 0.13
Nodes (15): DashboardStats, AnalyticsChartProps, action(), corsHeaders(), findWidgetData(), loader(), normalizeProductId(), DashboardPage() (+7 more)

### Community 6 - "Discount Function"
Cohesion: 0.23
Nodes (12): CartLinesDiscountsGenerateRunResult, DiscountClass, Input, ProductDiscountCandidate, ProductDiscountSelectionStrategy, buildDiscountValue(), BundleConfig, DiscountType (+4 more)

### Community 7 - "Storefront Widget"
Cohesion: 0.5
Nodes (7): attachEvents(), escapeHtml(), formatDiscount(), getTiers(), initVeloraWidget(), renderWidget(), trackEvent()

### Community 8 - "Login Flow"
Cohesion: 0.53
Nodes (3): LoginErrorMessage, action(), loader()

### Community 9 - "Pre-Submit Checks"
Cohesion: 0.47
Nodes (5): check(), CheckResult, fetchStatus(), results, runChecks()

### Community 10 - "SSR Entry Point"
Cohesion: 0.67
Nodes (3): SSR Request Handler, React Router v8 Future Flags, Shopify Document Response Headers

### Community 11 - "Auth Routes"
Cohesion: 0.67
Nodes (3): Auth Catch-All Loader, loginErrorMessage, Auth Login Route

## Ambiguous Edges - Review These
- `Metafield Bundle Config Type` → `Sync Bundles to Shopify Metafields`  [AMBIGUOUS]
  app/utils/metafields.server.ts · relation: shares_data_with
- `Plan Feature Limits` → `Plan Limit Enforcement`  [AMBIGUOUS]
  app/utils/billing.server.ts · relation: references
- `Cursor IDE Setup Guide` → `MIT License`  [AMBIGUOUS]
  LICENSE.md · relation: conceptually_related_to

## Knowledge Gaps
- **50 isolated node(s):** `shopify`, `BundleWithRelations`, `AnalyticsChartProps`, `BundlePreviewProps`, `PAID_PLANS` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Metafield Bundle Config Type` and `Sync Bundles to Shopify Metafields`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Plan Feature Limits` and `Plan Limit Enforcement`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Cursor IDE Setup Guide` and `MIT License`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `captureException()` connect `Bundle Types and UI` to `Auth and Webhooks Server`, `Billing and Redis Cache`, `Dashboard and Analytics`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `invalidateShopCache()` connect `Bundle Types and UI` to `Auth and Webhooks Server`, `Billing and Redis Cache`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Shopify Admin Authentication` (e.g. with `Vite Shopify Dev Server Config` and `Get Current Shop Plan`) actually correct?**
  _`Shopify Admin Authentication` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `Prisma Client Singleton` (e.g. with `Widget Data Resolver` and `Widget Analytics POST Action`) actually correct?**
  _`Prisma Client Singleton` has 9 INFERRED edges - model-reasoned connections that need verification._