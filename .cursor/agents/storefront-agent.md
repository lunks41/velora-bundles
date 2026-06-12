---
description: Storefront agent — use for Theme App Extension, widget JS/CSS, Liquid templates, storefront-facing code
---

# Storefront Agent — Velora Bundles Widget

You are building the customer-facing bundle widget that appears on Shopify product pages.

## Architecture
- Theme App Extension (NOT React — vanilla JS only)
- Liquid block: bundle.liquid (renders container + passes data attributes)
- JavaScript: bundle-widget.js (fetches data, renders widget, handles ATC)
- CSS: bundle-widget.css (widget styles, mobile responsive)

## Widget fetch pattern
```javascript
// bundle-widget.js
(function() {
  'use strict';
  
  async function initVeloraWidget() {
    const container = document.getElementById('velora-bundle-widget');
    if (!container) return;
    
    const shopDomain = container.dataset.shopDomain;
    const productId = container.dataset.productId;
    const position = container.dataset.position || 'above_atc';
    
    try {
      // Fetch bundle data from our API
      const response = await fetch(
        `https://app.velorabundles.com/api/widget/${shopDomain}/${productId}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      if (!response.ok) return; // No bundle for this product — hide silently
      
      const { bundle } = await response.json();
      
      // Track view
      trackEvent(shopDomain, bundle.id, 'view');
      
      // Render widget
      container.innerHTML = renderWidget(bundle);
      
      // Position widget
      positionWidget(container, position);
      
      // Attach events
      attachEvents(container, bundle, shopDomain);
      
    } catch (error) {
      container.remove(); // Hide on error — never break merchant's store
    }
  }
  
  function renderWidget(bundle) {
    const tiers = bundle.volumeDiscounts.length > 0 
      ? bundle.volumeDiscounts 
      : [{ label: 'Bundle', quantity: bundle.minQuantity, discount: bundle.discountValue }];
    
    return `
      <div class="velora-widget" data-bundle-id="${bundle.id}">
        <div class="velora-widget__header">
          <span class="velora-widget__title">${escapeHtml(bundle.title)}</span>
        </div>
        <div class="velora-widget__tiers">
          ${tiers.map((tier, i) => `
            <label class="velora-widget__tier ${i === 1 ? 'velora-widget__tier--selected' : ''}">
              <input
                type="radio"
                name="velora-tier"
                value="${i}"
                ${i === 1 ? 'checked' : ''}
                data-discount="${tier.discountValue}"
                data-qty="${tier.minQuantity}"
              />
              <div class="velora-widget__tier-content">
                <div class="velora-widget__tier-info">
                  <span class="velora-widget__tier-label">${escapeHtml(tier.label)}</span>
                  ${tier.isMostPopular ? '<span class="velora-widget__badge velora-widget__badge--popular">Most Popular</span>' : ''}
                  ${tier.discountValue > 0 ? `<span class="velora-widget__badge velora-widget__badge--save">Save ${tier.discountValue}%</span>` : ''}
                </div>
                <div class="velora-widget__tier-price">
                  <span class="velora-widget__price">${formatPrice(calculatePrice(bundle, tier))}</span>
                  ${tier.discountValue > 0 ? `<span class="velora-widget__price velora-widget__price--original">${formatPrice(bundle.originalPrice * tier.minQuantity)}</span>` : ''}
                </div>
              </div>
            </label>
          `).join('')}
        </div>
        
        ${bundle.products.map((product, i) => `
          <div class="velora-widget__variants" data-product-index="${i}">
            ${product.variants.length > 1 ? product.options.map(option => `
              <select class="velora-widget__variant-select" data-option="${option.name}">
                ${option.values.map(v => `<option value="${v}">${v}</option>`).join('')}
              </select>
            `).join('') : ''}
          </div>
        `).join('')}
        
        <button class="velora-widget__atc" type="button">
          Add bundle to cart
        </button>
      </div>
    `;
  }
  
  function attachEvents(container, bundle, shopDomain) {
    // Tier selection
    container.querySelectorAll('input[name="velora-tier"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        container.querySelectorAll('.velora-widget__tier').forEach(t => 
          t.classList.remove('velora-widget__tier--selected'));
        e.target.closest('.velora-widget__tier').classList.add('velora-widget__tier--selected');
        updateAtcButton(container, bundle);
      });
    });
    
    // Add to cart
    container.querySelector('.velora-widget__atc').addEventListener('click', async () => {
      trackEvent(shopDomain, bundle.id, 'click');
      await addBundleToCart(container, bundle);
    });
  }
  
  async function addBundleToCart(container, bundle) {
    const btn = container.querySelector('.velora-widget__atc');
    btn.disabled = true;
    btn.textContent = 'Adding...';
    
    try {
      const items = bundle.products.map(product => ({
        id: getSelectedVariantId(container, product),
        quantity: 1,
        properties: { '_velora_bundle_id': bundle.id }
      }));
      
      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      
      btn.textContent = 'Added!';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Add bundle to cart';
      }, 2000);
      
      // Trigger cart drawer if theme supports it
      document.dispatchEvent(new CustomEvent('cart:updated'));
      
    } catch (error) {
      btn.disabled = false;
      btn.textContent = 'Add bundle to cart';
    }
  }
  
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
  
  function formatPrice(cents) {
    return (cents / 100).toLocaleString(undefined, {
      style: 'currency',
      currency: window.Shopify?.currency?.active || 'USD'
    });
  }
  
  async function trackEvent(shopDomain, bundleId, type) {
    try {
      await fetch(`https://app.velorabundles.com/api/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopDomain, bundleId, type }),
        keepalive: true
      });
    } catch {} // Never let tracking break the store
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVeloraWidget);
  } else {
    initVeloraWidget();
  }
})();
```

## CSS — mobile-first responsive
```css
/* bundle-widget.css */
.velora-widget {
  border: 1.5px solid #008060;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  font-family: inherit;
}

.velora-widget__header {
  margin-bottom: 12px;
  text-align: center;
}

.velora-widget__title {
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #008060;
}

.velora-widget__tier {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.velora-widget__tier--selected {
  border-color: #008060;
  background: #f0faf6;
}

.velora-widget__tier-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.velora-widget__badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 6px;
}

.velora-widget__badge--popular {
  background: #008060;
  color: #fff;
}

.velora-widget__badge--save {
  background: #e3f1df;
  color: #1c7a2d;
}

.velora-widget__price--original {
  text-decoration: line-through;
  color: #999;
  font-size: 12px;
  margin-left: 6px;
}

.velora-widget__variant-select {
  margin: 6px 4px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.velora-widget__atc {
  width: 100%;
  background: #1a1a1a;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 10px;
  transition: opacity 0.15s;
}

.velora-widget__atc:hover { opacity: 0.85; }
.velora-widget__atc:disabled { opacity: 0.6; cursor: not-allowed; }

/* Mobile */
@media (max-width: 480px) {
  .velora-widget__tier-content { flex-direction: column; align-items: flex-start; gap: 4px; }
  .velora-widget { padding: 12px; }
}
```

## API endpoint for widget data
```typescript
// app/routes/api.widget.$shop.$productId.ts
export async function loader({ params }: LoaderFunctionArgs) {
  const { shop, productId } = params;
  
  const cacheKey = `widget:${shop}:${productId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': `https://${shop}`,
        'Cache-Control': 'public, max-age=30'
      }
    });
  }
  
  const bundle = await prisma.bundle.findFirst({
    where: {
      shop: { shopDomain: shop },
      status: 'ACTIVE',
      products: { some: { shopifyProductId: `gid://shopify/Product/${productId}` } }
    },
    include: {
      products: { orderBy: { sortOrder: 'asc' } },
      volumeDiscounts: { orderBy: { sortOrder: 'asc' } }
    }
  });
  
  if (!bundle) return new Response(null, { status: 404 });
  
  const responseBody = JSON.stringify({ bundle });
  await redis.setex(cacheKey, CACHE_TTL.WIDGET_DATA, responseBody);
  
  return new Response(responseBody, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': `https://${shop}`,
    }
  });
}
```
