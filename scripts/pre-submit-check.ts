#!/usr/bin/env tsx
import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
}

async function fetchStatus(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow" });
    return response.status;
  } catch {
    return 0;
  }
}

async function runChecks() {
  const appUrl = process.env.SHOPIFY_APP_URL ?? "https://app.velorabundles.com";

  const healthStatus = await fetchStatus(`${appUrl}/healthcheck`);
  check(
    "App URL reachable",
    healthStatus === 200,
    healthStatus === 200
      ? "Health check returned 200"
      : `Health check returned ${healthStatus || "unreachable"}`,
  );

  const tomlPath = join(process.cwd(), "shopify.app.toml");
  if (existsSync(tomlPath)) {
    const toml = readFileSync(tomlPath, "utf8");
    check(
      "OAuth configured",
      toml.includes("redirect_urls") && toml.includes("auth"),
      "shopify.app.toml contains auth redirect URLs",
    );
    check(
      "GDPR webhooks registered",
      toml.includes("customers/data_request") &&
        toml.includes("customers/redact") &&
        toml.includes("shop/redact"),
      "All 3 GDPR compliance topics present in shopify.app.toml",
    );
    check(
      "shopify.app.toml complete",
      toml.includes("application_url") && toml.includes("scopes"),
      "Required fields present in shopify.app.toml",
    );
  } else {
    check("shopify.app.toml complete", false, "shopify.app.toml not found");
  }

  const privacyStatus = await fetchStatus("https://velorabundles.com/privacy");
  check(
    "Privacy Policy",
    privacyStatus === 200,
    privacyStatus === 200
      ? "Privacy policy URL returns 200"
      : `Privacy policy URL returns ${privacyStatus || "unreachable"}`,
  );

  const termsStatus = await fetchStatus("https://velorabundles.com/terms");
  check(
    "Terms of Service",
    termsStatus === 200,
    termsStatus === 200
      ? "Terms URL returns 200"
      : `Terms URL returns ${termsStatus || "unreachable"}`,
  );

  const iconPath = join(process.cwd(), "public", "icon.png");
  check(
    "App icon 512x512",
    existsSync(iconPath),
    existsSync(iconPath)
      ? "public/icon.png exists (verify 512x512 dimensions manually)"
      : "public/icon.png not found",
  );

  const screenshotsDir = join(process.cwd(), "public", "screenshots");
  let screenshotCount = 0;
  if (existsSync(screenshotsDir)) {
    screenshotCount = readdirSync(screenshotsDir).filter((file) =>
      /\.(png|jpg|jpeg|webp)$/i.test(file),
    ).length;
  }
  check(
    "Listing screenshots",
    screenshotCount >= 3,
    screenshotCount >= 3
      ? `${screenshotCount} screenshots found`
      : `Only ${screenshotCount} screenshots (need at least 3)`,
  );

  try {
    const grepResult = execSync(
      'rg "/admin/api/" --glob "!node_modules/**" --glob "!scripts/**" -l',
      { encoding: "utf8", cwd: process.cwd() },
    ).trim();
    check(
      "No REST API calls",
      grepResult.length === 0,
      grepResult.length === 0
        ? "No REST Admin API usage found"
        : `REST API found in: ${grepResult}`,
    );
  } catch {
    check("No REST API calls", true, "No REST Admin API usage found");
  }

  try {
    const scriptsResult = execSync(
      'rg "Shopify Scripts" --glob "!node_modules/**" --glob "!scripts/**" --glob "!docs/**" -l',
      { encoding: "utf8", cwd: process.cwd() },
    ).trim();
    check(
      "No Shopify Scripts",
      scriptsResult.length === 0,
      scriptsResult.length === 0
        ? "No deprecated Shopify Scripts references"
        : `Scripts references in: ${scriptsResult}`,
    );
  } catch {
    check("No Shopify Scripts", true, "No deprecated Shopify Scripts references");
  }

  console.log("\nVelora Bundles — Pre-Submission Checklist\n");
  console.log("=".repeat(50));

  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name} — ${result.message}`);
  }

  console.log("=".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} checks passed\n`);

  if (passed < results.length) {
    process.exit(1);
  }
}

runChecks().catch((error) => {
  console.error(error);
  process.exit(1);
});
