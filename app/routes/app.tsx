import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate, apiKey } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (error) {
    if (error instanceof Response) {
      console.error("[velora-bundles] authenticate.admin failed", {
        status: error.status,
        statusText: error.statusText,
        reauthUrl: error.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url"),
        retryHeader: error.headers.get("X-Shopify-Retry-Invalid-Session-Request"),
        url: request.url,
        hasAuthHeader: Boolean(request.headers.get("authorization")),
      });
    } else {
      console.error("[velora-bundles] authenticate.admin error", error);
    }
    throw error;
  }

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { onboardingDone: true },
  });

  const url = new URL(request.url);
  const isOnboarding = url.pathname.startsWith("/app/onboarding");

  if (!shop?.onboardingDone && !isOnboarding) {
    throw redirect("/app/onboarding");
  }

  return { apiKey };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/bundles">Bundles</s-link>
        <s-link href="/app/settings">Settings</s-link>
        <s-link href="/app/billing">Billing</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
