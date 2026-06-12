# Velora Bundles — Cursor AI Setup

Complete Cursor IDE configuration for building the Velora Bundles Shopify app.

## How to use this setup

### Step 1 — Copy to your project
Copy the entire `.cursor/` folder into your `velora-bundles/` project root.
Copy `docs/` folder too for reference files.

### Step 2 — Cursor rules (auto-applied)
Files in `.cursor/rules/` are automatically loaded by Cursor:

| File | When applied | Purpose |
|------|-------------|---------|
| `project.mdc` | Always | Global rules — stack, patterns, security |
| `shopify.mdc` | Shopify files | GraphQL, Functions, webhooks, billing |
| `database.mdc` | Prisma files | Schema, queries, Redis patterns |
| `testing.mdc` | Test files | Unit tests, QA checklists |
| `polaris-ui.mdc` | Route files | Polaris components, UI patterns |

### Step 3 — Cursor agents (use in chat)
Reference agents in Cursor chat with @agent-name:

| Agent | Use for |
|-------|---------|
| `backend-agent.md` | Loaders, actions, DB, webhooks, API |
| `frontend-agent.md` | Polaris UI, React components, forms |
| `storefront-agent.md` | Widget JS, Liquid, CSS, widget API |

### Step 4 — Cursor prompts
Copy prompts from `docs/cursor-prompts.md` into Cursor Composer (Cmd+I).
Work through them in order — one prompt per task.

### Step 5 — GraphQL reference
Use `docs/api/graphql-queries.md` as reference for all Shopify API calls.
In Cursor: @docs/api/graphql-queries.md when working on API code.

## Quick start commands

```bash
# Day 1 — Create app
npm init @shopify/app@latest
# Choose: React Router, TypeScript, velora-bundles

# Copy this .cursor/ folder into generated project
cp -r velora-cursor-setup/.cursor velora-bundles/
cp -r velora-cursor-setup/docs velora-bundles/

# Day 1 — Install extras
cd velora-bundles
npm install ioredis @sentry/node resend

# Start dev
npm run dev
# Scan QR code → install on dev store → see app in Shopify Admin
```

## Version roadmap
- **V1** (Week 1–8): Core features → App Store submission
- **V2** (Week 9–14): Mix & match, BOGO, A/B testing, Built for Shopify
- **V3** (Week 15–20): AI features, post-purchase, advanced analytics

## Key rules (never break these)
1. GraphQL Admin API only — never REST
2. Shopify Functions — never Shopify Scripts
3. All DB queries include shopId — no cross-shop leaks
4. Verify HMAC on every webhook
5. Never log access tokens
6. Cache analytics in Redis (5 min TTL)
7. Every feature: test full flow on dev store before committing
