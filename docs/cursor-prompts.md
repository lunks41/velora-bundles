# Velora Bundles — Cursor Prompt Templates

Copy-paste these prompts directly into Cursor Composer (Cmd+I).
Each prompt is a complete task. Work through them in order.

---

## PHASE 1 — Project Setup

### Prompt 1.1 — Generate app skeleton
```
Run the Shopify CLI to create the Velora Bundles app.
Tech stack: React Router v7, TypeScript, Shopify Polaris.
App name: velora-bundles.
After generation, show me the complete folder structure and
explain what each generated file does.
Command to run: npm init @shopify/app@latest
```

### Prompt 1.2 — Swap SQLite to PostgreSQL
```
Update the Velora Bundles project to use PostgreSQL instead of SQLite.

Changes needed:
1. Update prisma/schema.prisma datasource to use postgresql
2. Update DATABASE_URL in .env to point to Railway PostgreSQL
3. Install any needed dependencies
4. Run prisma migrate dev --name init

Show me the complete updated schema.prisma file.
```

### Prompt 1.3 — Redis client setup
```
Create the Redis client singleton for Velora Bundles at app/redis.server.ts.

Requirements:
- Use ioredis package
- Singleton pattern (same as existing db.server.ts pattern)
- Export getCached() helper function with key, fetcher, TTL params
- Export invalidateShopCache() to clear all keys for a shop
- Export CACHE_TTL constants: ANALYTICS=300, BUNDLE_LIST=120, SHOP_PLAN=3600, WIDGET_DATA=30

Reference: check app/db.server.ts for the singleton pattern to follow.
```

---

## PHASE 2 — Prisma Schema

### Prompt 2.1 — Write complete Prisma schema
```
Write the complete Prisma schema for Velora Bundles at prisma/schema.prisma.

Models needed:
1. Session (Shopify auth - already exists, keep it)
2. Shop (shopDomain, accessToken encrypted, plan enum, billingChargeId, isActive, onboardingDone)
3. Bundle (shopId FK, name, status enum, bundleType enum, discountType enum, discountValue, title, widgetPosition)
4. BundleProduct (bundleId FK, shopifyProductId, shopifyVariantId, productTitle cached, productImageUrl cached, quantity, sortOrder)
5. VolumeDiscount (bundleId FK, minQuantity, maxQuantity, discountType, discountValue, label, isMostPopular, sortOrder)
6. BundleAnalytics (bundleId FK, shopId FK, date as Date type, views, clicks, orders, revenue, discountGiven — unique on bundleId+date)
7. WebhookLog (shopId FK, topic, shopifyWebhookId unique, payload JSON, processed bool, processedAt)

Enums: Plan (FREE/STARTER/GROWTH/PRO), BundleStatus (ACTIVE/DRAFT/ARCHIVED), BundleType (FIXED/FREQUENTLY_BOUGHT_TOGETHER/MIX_MATCH/BOGO), DiscountType (PERCENTAGE/FIXED_AMOUNT/SPECIAL_PRICE)

Add proper indexes: shopId+status on Bundle, bundleId on BundleProduct, shopId+date on BundleAnalytics, shopifyWebhookId on WebhookLog.

After writing schema, run: npx prisma migrate dev --name init
```

---

## PHASE 3 — Bundle CRUD

### Prompt 3.1 — Bundle list page
```
Create the bundle list page at app/routes/app.bundles.tsx for Velora Bundles.

Loader:
- Authenticate with Shopify
- Fetch all non-archived bundles for current shop from Prisma
- Include: products count, volume discounts count, last 30 days revenue from BundleAnalytics
- Cache with Redis for 2 minutes

UI (Shopify Polaris only):
- Page with title "Bundles" and "Create bundle" primary action button
- ResourceList showing: bundle name (bold), type badge, status badge, monthly revenue
- Skeleton loading state
- EmptyState when no bundles: "Create your first bundle" with CTA
- Each item links to /app/bundles/:id for editing
- Status toggle (active/draft) inline without page reload using useFetcher

Action:
- intent "toggle_status": update bundle status
- intent "archive_bundle": soft delete (status = ARCHIVED)

Follow the loader/action pattern from existing app/_index.tsx route.
Reference .cursorrules for Polaris patterns.
```

### Prompt 3.2 — Bundle editor with live preview
```
Create the bundle create/edit page at app/routes/app.bundles.$id.tsx for Velora Bundles.

This is the most important admin page — it has a split-screen layout:
- LEFT HALF: Form for editing bundle settings
- RIGHT HALF: Live widget preview that updates as merchant types

Loader:
- If id === "new": return empty bundle template
- Otherwise: fetch existing bundle with products and volumeDiscounts from Prisma
- Also fetch shop's plan for feature gating

Action (intent "save_bundle"):
- Validate form data (title required, discountValue > 0, at least 2 products)
- Use prisma.$transaction() to save bundle + delete old products/discounts + create new ones
- Sync bundle config to Shopify metafields (call syncBundleToMetafields util)
- Invalidate Redis cache for this shop
- Return success or validation errors

Left panel form fields (all Polaris):
1. Bundle title (TextField)
2. Bundle type (Select: Fixed Bundle / Frequently Bought Together)
3. Product picker button (opens Shopify ResourcePicker via App Bridge)
4. Selected products list (show image + name + remove button)
5. Discount type (Select: Percentage / Fixed amount / Special price)
6. Discount value (TextField with % or $ suffix)
7. Volume discount tiers section (Add tier button, each tier: minQty, discount%, label, "Most Popular" toggle)
8. Widget position (RadioGroup: above ATC / below ATC)
9. Save button + Back button

Right panel live preview:
- BundlePreview component showing exactly what customer sees
- Updates in real-time as any form field changes
- Shows widget tiers with savings badges and Most Popular pill

Create BundlePreview component at app/components/BundlePreview.tsx.
Reference the competitor widget screenshots — it should look like Kaching's widget.
```

### Prompt 3.3 — Onboarding wizard
```
Create the onboarding wizard at app/routes/app.onboarding.tsx for Velora Bundles.

This shows to new merchants on first install only.
Check shop.onboardingDone — if true, redirect to /app (dashboard).

3-step wizard with progress indicator:

Step 1 — Welcome:
- "Welcome to Velora Bundles 🎉"
- 2-sentence description of what bundles do for revenue
- Show an animated preview of the bundle widget
- "Get started" button → go to step 2

Step 2 — Create first bundle:
- Simplified bundle form (just: title, 2 product picker, discount %)
- "Create my bundle" button → saves bundle + goes to step 3

Step 3 — Go live:
- "Your bundle is ready!" message
- Instructions: go to Online Store > Themes > Customize > add Velora widget block
- "View on store" button that opens merchant's store in new tab
- "Go to dashboard" button → sets shop.onboardingDone = true → redirect to /app

Show step indicator at top: Step 1 of 3, Step 2 of 3, Step 3 of 3.
Use Polaris Card + BlockStack + InlineStack for layout.
```

---

## PHASE 4 — Shopify Function

### Prompt 4.1 — Generate and build discount Function
```
Set up the Shopify discount Function for Velora Bundles.

Step 1: Generate with CLI
Command: shopify app generate extension
Choose: Discount — product
Name: velora-discount

Step 2: Update extensions/velora-discount/src/run.graphql
The Function needs to read:
- Cart lines (id, quantity, merchandise.product.id)
- Shop metafield namespace="velora_bundles" key="active_bundles"

Step 3: Write extensions/velora-discount/src/index.ts
Logic:
1. Parse bundle configs from shop metafield JSON
2. For each bundle config: check if cart contains enough matching products
3. If bundle matched: create discount targets for all matching lines
4. Support: percentage discount, fixed amount discount
5. Support: volume discount tiers (buy 2 = 10%, buy 3 = 15%)
6. Return FunctionRunResult with all applicable discounts

Step 4: Create app/utils/metafields.server.ts
Function syncBundleToMetafields(admin, shop):
- Fetch all ACTIVE bundles for shop from Prisma
- Format as Function-readable JSON (productIds, minQuantity, discountType, discountValue)
- Write to shop metafield via GraphQL mutation
- Call this function every time a bundle is saved or status changes

Show me all files with complete code.
Key constraint: Functions cannot make HTTP calls at runtime — all data must come from metafields.
```

---

## PHASE 5 — Theme Extension

### Prompt 5.1 — Generate widget structure
```
Set up the Theme App Extension for Velora Bundles storefront widget.

Step 1: Generate with CLI
Command: shopify app generate extension
Choose: Theme app extension
Name: bundle-widget

Step 2: Create extensions/bundle-widget/blocks/bundle.liquid
- Container div with data attributes: shop domain, product ID, widget position
- Link to CSS asset
- Link to JS asset (defer)
- Shopify schema with position setting (above_atc / below_atc)
- Loading skeleton shown until JS initializes

Step 3: Create extensions/bundle-widget/assets/bundle-widget.css
Mobile-first CSS:
- .velora-widget with green (#008060) border, rounded corners
- .velora-widget__tier with hover effects, selected state highlight
- .velora-widget__badge for "Most Popular" (green) and "Save X%" (light green)
- .velora-widget__price--original with line-through style
- .velora-widget__atc full-width dark button
- Mobile responsive: 375px breakpoint

Step 4: Create API route app/routes/api.widget.$shop.$productId.ts
- No auth needed (public endpoint, called from storefront)
- CORS header: Access-Control-Allow-Origin for merchant's domain
- Find active bundle for this product from Prisma
- Redis cache 30 seconds
- Return bundle config (products, volume tiers, discount settings)
- Return 404 if no active bundle (widget hides silently)
```

### Prompt 5.2 — Widget JavaScript
```
Write the complete bundle-widget.js for the Velora Bundles storefront widget.

This is vanilla JavaScript (no React, no frameworks — it runs on the merchant's store theme).

Complete requirements:
1. Auto-initialize when DOM is ready
2. Fetch bundle data from https://app.velorabundles.com/api/widget/{shop}/{productId}
3. If no bundle: remove container silently (never break store)
4. Render widget HTML with:
   - Bundle title as header
   - Radio button options for each tier (1 item, 2 items, 3 items)
   - "Most Popular" green badge on middle tier
   - "Save X%" light green badge on discounted tiers
   - Original price with line-through
   - Variant dropdowns per product (Size, Color)
   - Add to cart button
5. Track view event (fire and forget — never block render)
6. Handle tier selection: update button text with selected price
7. Handle Add to Cart:
   - Collect all bundle items with selected variants
   - Add all to cart via POST /cart/add.js
   - Show "Adding..." → "Added!" → reset button
   - Add property _velora_bundle_id to each cart line
   - Dispatch cart:updated event for theme cart drawers
8. Track click event on ATC
9. Position widget above or below ATC based on data-position attribute

XSS protection: escape all merchant-provided strings before inserting as HTML.
Error handling: any error silently hides widget — never break merchant's store.
```

---

## PHASE 6 — Billing + Webhooks + Analytics

### Prompt 6.1 — Billing API setup
```
Set up Shopify Billing API for Velora Bundles in app/shopify.server.ts.

Plans to configure:
- Free: $0, no trial (permanent free)
- Starter: $9.99/mo, 14-day trial
- Growth: $19.99/mo, 14-day trial  
- Pro: $39.99/mo, 14-day trial

Feature limits per plan:
- Free: 1 bundle max, no A/B testing, no AI features
- Starter: 5 bundles max, no A/B testing, no AI features
- Growth: unlimited bundles, A/B testing enabled, no AI features
- Pro: unlimited bundles, A/B testing enabled, AI features enabled

Create app/utils/billing.server.ts with:
1. checkPlanLimit(shopId, feature) — check if shop's current plan allows a feature
2. getCurrentPlan(shopId) — get shop plan from Redis cache or DB
3. redirectToBilling(session, planName) — create Shopify billing charge and return confirmationUrl
4. handleBillingCallback(session, chargeId) — after merchant approves, save to DB

Create app/routes/app.billing.tsx:
- Show current plan with features
- Show upgrade options (Growth and Pro plans with feature comparison)
- Handle billing callback (update shop.plan in DB)
- Show plan limit reached banner when free user tries to create 2nd bundle
```

### Prompt 6.2 — All webhook handlers
```
Create the complete webhook handler at app/routes/webhooks.tsx for Velora Bundles.

Handle these topics:

1. APP_UNINSTALLED:
   - Set shop.isActive = false in DB
   - Clear all Redis keys for this shop: redis.keys("shop:{domain}:*") then delete all
   - Do NOT delete shop data (merchant may reinstall)

2. ORDERS_PAID:
   - Parse order payload
   - Find cart lines with _velora_bundle_id property
   - For each unique bundle ID found: upsert BundleAnalytics (increment orders + revenue)
   - Use prisma upsert with bundleId_date unique constraint

3. PRODUCTS_UPDATE:
   - Find BundleProducts with matching shopifyProductId
   - Update cached productTitle and productImageUrl
   - Invalidate widget cache for affected shops

4. CUSTOMERS_DATA_REQUEST (GDPR):
   - Velora stores no customer PII
   - Return 200 with empty data response
   - Log the request

5. CUSTOMERS_REDACT (GDPR):
   - Nothing to delete (no customer data stored)
   - Return 200

6. SHOP_REDACT (GDPR):
   - Delete all data for this shop: Shop (cascade deletes Bundle, BundleProduct, etc.)
   - Return 200

All webhooks:
- Use authenticate.webhook(request) — this verifies HMAC automatically
- Check WebhookLog for duplicate (idempotency)
- Upsert WebhookLog after processing
- Log errors to Sentry but always return 200 (Shopify retries on non-200)
```

### Prompt 6.3 — Analytics dashboard
```
Update the dashboard at app/routes/app._index.tsx for Velora Bundles.

Loader:
- Fetch analytics from BundleAnalytics grouped by date (last 30 days)
- Calculate: total revenue, total views, total clicks, CTR = clicks/views * 100
- Find top performing bundle (highest revenue this month)
- Count active bundles
- Cache all this in Redis for 5 minutes

UI (Shopify Polaris):

Row 1 — 4 stat cards side by side:
- "Bundle revenue" — total MRR this month with +X% vs last month badge
- "Widget views" — total impressions
- "Click-through rate" — X% formatted
- "Active bundles" — count with link to /app/bundles

Row 2 — Revenue chart (last 30 days):
- Use recharts LineChart or BarChart
- X axis: dates, Y axis: revenue in $
- Wrap in Polaris Card with "Revenue from bundles" title

Row 3 — Two columns:
- Left: Top performing bundle (name, revenue, conversion rate, "Edit" button)
- Right: Quick actions (Create bundle, View all bundles, Settings)

Show SkeletonPage while loading.
Show EmptyState if no bundles exist yet (link to create first bundle).
```

---

## PHASE 7 — Widget Customization

### Prompt 7.1 — Widget settings page
```
Create the settings page at app/routes/app.settings.tsx for Velora Bundles.

Three sections:

Section 1 — Widget appearance (with live preview on right):
- Preset themes: Light (default), Dark, Minimal, Branded (4 button options with preview)
- Custom colors: primary color, background color, button color (3 color pickers)
- Border radius: Sharp → Rounded slider (0 to 20px)
- Widget position default: above ATC / below ATC (radio buttons)
- Live preview panel: show bundle-widget.js preview with current settings

Section 2 — Current plan:
- Show plan name, features, billing date
- Upgrade button (links to /app/billing)

Section 3 — Support:
- "Email us" button (mailto: support@velorabundles.com)
- "Leave a review" button (link to App Store review page)
- "Documentation" button (link to help docs)

Save action:
- Save widget settings to Shop model (new widgetSettings JSON field)
- Sync to Redis so widget API returns updated colors
- Invalidate all widget caches for this shop

Show Toast on save success.
Show Banner on save error.
```

---

## PHASE 8 — Testing and Submission

### Prompt 8.1 — Pre-submission checklist script
```
Create a pre-submission checklist script at scripts/pre-submit-check.ts for Velora Bundles.

This script checks all Shopify App Store requirements automatically:

Checks to perform:
1. App URL is reachable (fetch https://app.velorabundles.com/healthcheck)
2. OAuth redirect URL is configured correctly
3. All 3 GDPR webhooks are registered (data_request, redact, shop/redact)
4. Privacy Policy URL returns 200 (fetch https://velorabundles.com/privacy)
5. Terms of Service URL returns 200 (fetch https://velorabundles.com/terms)
6. App icon exists and is 512x512
7. At least 3 screenshots exist in listing
8. shopify.app.toml has all required fields
9. No REST API calls in codebase (grep for /admin/api/)
10. No Shopify Scripts in codebase (scripts are deprecated)

Output a formatted checklist:
✅ App URL reachable
✅ OAuth configured
❌ Privacy Policy — URL returns 404
...

Run with: npx tsx scripts/pre-submit-check.ts
```

### Prompt 8.2 — Health check endpoint
```
Create a health check endpoint at app/routes/healthcheck.ts for Velora Bundles.

GET /healthcheck should return:
- Status 200 if all systems healthy
- Status 500 if any critical service is down

Check:
1. Database: run prisma.$queryRaw`SELECT 1`
2. Redis: run redis.ping() — should return "PONG"
3. Basic app info: version, environment, uptime

Response format:
{
  "status": "healthy",
  "timestamp": "2026-06-06T12:00:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy"
  },
  "version": "1.0.0"
}

Railway uses this for health monitoring.
Sentry uses this for uptime monitoring.
No authentication required on this endpoint.
```
