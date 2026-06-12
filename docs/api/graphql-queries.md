# Shopify GraphQL Queries — Velora Bundles Reference

All API calls use Shopify GraphQL Admin API only.
API Version: 2025-10 (update quarterly)

## Products

### Fetch products for bundle product picker
```graphql
query GetProductsForPicker($first: Int!, $query: String) {
  products(first: $first, query: $query) {
    edges {
      node {
        id
        title
        handle
        status
        totalInventory
        images(first: 1) {
          edges {
            node {
              url
              altText
            }
          }
        }
        variants(first: 10) {
          edges {
            node {
              id
              title
              price
              availableForSale
              selectedOptions {
                name
                value
              }
              image {
                url
              }
            }
          }
        }
        options {
          name
          values
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Fetch single product by ID
```graphql
query GetProduct($id: ID!) {
  product(id: $id) {
    id
    title
    images(first: 1) {
      edges {
        node { url altText }
      }
    }
    variants(first: 100) {
      edges {
        node {
          id
          title
          price
          sku
          availableForSale
          selectedOptions { name value }
        }
      }
    }
  }
}
```

## Metafields (for Shopify Functions)

### Write bundle config to shop metafield
```graphql
mutation SetBundleMetafield($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      namespace
      key
      value
    }
    userErrors {
      field
      message
      code
    }
  }
}
```

Variables:
```json
{
  "metafields": [{
    "ownerId": "gid://shopify/Shop/123456",
    "namespace": "velora_bundles",
    "key": "active_bundles",
    "value": "[{\"id\":\"bundle_1\",\"productIds\":[\"gid://shopify/Product/1\"],\"minQuantity\":2,\"discountPercentage\":10}]",
    "type": "json"
  }]
}
```

### Read shop metafields
```graphql
query GetShopMetafields {
  shop {
    id
    metafields(namespace: "velora_bundles", first: 10) {
      edges {
        node {
          key
          value
          type
        }
      }
    }
  }
}
```

### Delete metafield
```graphql
mutation DeleteMetafield($id: ID!) {
  metafieldDelete(input: { id: $id }) {
    deletedId
    userErrors { field message }
  }
}
```

## Orders (for analytics)

### Get order details for analytics tracking
```graphql
query GetOrder($id: ID!) {
  order(id: $id) {
    id
    totalPriceSet {
      shopMoney { amount currencyCode }
    }
    lineItems(first: 50) {
      edges {
        node {
          id
          quantity
          product { id }
          variant { id }
          customAttributes {
            key
            value
          }
        }
      }
    }
  }
}
```

## Billing

### Create subscription charge
```graphql
mutation CreateSubscription($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int) {
  appSubscriptionCreate(
    name: $name
    lineItems: $lineItems
    returnUrl: $returnUrl
    trialDays: $trialDays
    test: true
  ) {
    appSubscription {
      id
      status
    }
    confirmationUrl
    userErrors {
      field
      message
    }
  }
}
```

Variables:
```json
{
  "name": "Growth Plan",
  "lineItems": [{
    "plan": {
      "appRecurringPricingDetails": {
        "price": { "amount": 19.99, "currencyCode": "USD" },
        "interval": "EVERY_30_DAYS"
      }
    }
  }],
  "returnUrl": "https://app.velorabundles.com/billing/callback",
  "trialDays": 14
}
```

### Get current subscription
```graphql
query GetSubscription {
  appInstallation {
    activeSubscriptions {
      id
      name
      status
      currentPeriodEnd
      trialDays
      lineItems {
        plan {
          pricingDetails {
            ... on AppRecurringPricing {
              price { amount currencyCode }
              interval
            }
          }
        }
      }
    }
  }
}
```

## Discounts (created by Shopify Functions automatically)

### List active discount nodes (for debugging)
```graphql
query GetDiscountNodes {
  discountNodes(first: 10) {
    edges {
      node {
        id
        discount {
          ... on DiscountAutomaticApp {
            title
            status
            appDiscountType {
              functionId
              title
            }
          }
        }
      }
    }
  }
}
```

## Shop info

### Get shop details on install
```graphql
query GetShopDetails {
  shop {
    id
    name
    email
    primaryDomain { url }
    plan { displayName }
    currencyCode
    timezoneAbbreviation
    myshopifyDomain
    contactEmail
  }
}
```

## TypeScript helper for GraphQL calls
```typescript
// utils/graphql.server.ts
export async function shopifyQuery<T>(
  admin: AdminApiContext,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await admin.graphql(query, { variables });
  const json = await response.json();
  
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  
  return json.data as T;
}

// Usage
const { products } = await shopifyQuery<{ products: ProductConnection }>(
  admin,
  GET_PRODUCTS_QUERY,
  { first: 10 }
);
```
