(function () {
  "use strict";

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatDiscount(tier) {
    if (tier.discountType === "PERCENTAGE") {
      return tier.discountValue + "%";
    }
    if (tier.discountType === "FIXED_AMOUNT") {
      return "$" + tier.discountValue;
    }
    return "Special price";
  }

  function getTiers(bundle) {
    if (bundle.volumeDiscounts && bundle.volumeDiscounts.length > 0) {
      return bundle.volumeDiscounts;
    }
    return [
      {
        label: "Bundle",
        minQuantity: 1,
        discountType: bundle.discountType,
        discountValue: bundle.discountValue,
        isMostPopular: false,
      },
    ];
  }

  function renderWidget(bundle) {
    var tiers = getTiers(bundle);
    var defaultIndex = tiers.findIndex(function (t) {
      return t.isMostPopular;
    });
    if (defaultIndex < 0) defaultIndex = 0;

    var tiersHtml = tiers
      .map(function (tier, i) {
        var selected = i === defaultIndex ? " velora-widget__tier--selected" : "";
        var checked = i === defaultIndex ? " checked" : "";
        var badges = "";
        if (tier.isMostPopular) {
          badges +=
            '<span class="velora-widget__badge velora-widget__badge--popular">Most Popular</span>';
        }
        if (tier.discountValue > 0) {
          badges +=
            '<span class="velora-widget__badge velora-widget__badge--save">Save ' +
            escapeHtml(formatDiscount(tier)) +
            "</span>";
        }

        return (
          '<label class="velora-widget__tier' +
          selected +
          '">' +
          '<input type="radio" name="velora-tier" value="' +
          i +
          '"' +
          checked +
          " />" +
          '<div class="velora-widget__tier-content">' +
          '<div class="velora-widget__tier-info">' +
          '<span class="velora-widget__tier-label">' +
          escapeHtml(tier.label) +
          "</span>" +
          badges +
          "</div>" +
          '<div class="velora-widget__tier-price">' +
          '<span class="velora-widget__price">Qty ' +
          tier.minQuantity +
          "+</span>" +
          "</div>" +
          "</div>" +
          "</label>"
        );
      })
      .join("");

    var productsHtml = (bundle.products || [])
      .map(function (product) {
        var img = product.productImageUrl
          ? '<img class="velora-widget__product-image" src="' +
            escapeHtml(product.productImageUrl) +
            '" alt="" loading="lazy" />'
          : "";
        return (
          '<div class="velora-widget__product">' +
          img +
          "<span>" +
          escapeHtml(product.productTitle) +
          (product.quantity > 1 ? " x" + product.quantity : "") +
          "</span>" +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="velora-widget" data-bundle-id="' +
      escapeHtml(bundle.bundleId) +
      '">' +
      '<div class="velora-widget__header">' +
      '<span class="velora-widget__title">' +
      escapeHtml(bundle.title) +
      "</span>" +
      "</div>" +
      '<div class="velora-widget__tiers">' +
      tiersHtml +
      "</div>" +
      '<div class="velora-widget__products">' +
      productsHtml +
      "</div>" +
      '<button class="velora-widget__atc" type="button">Add bundle to cart</button>' +
      "</div>"
    );
  }

  function trackEvent(apiUrl, shopDomain, productId, bundleId, event) {
    fetch(
      apiUrl +
        "/api/widget/" +
        encodeURIComponent(shopDomain) +
        "/" +
        encodeURIComponent(productId),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId: bundleId, event: event }),
        keepalive: true,
      },
    ).catch(function () {});
  }

  function attachEvents(container, bundle, apiUrl, shopDomain, productId) {
    container.querySelectorAll('input[name="velora-tier"]').forEach(function (radio) {
      radio.addEventListener("change", function (e) {
        container.querySelectorAll(".velora-widget__tier").forEach(function (t) {
          t.classList.remove("velora-widget__tier--selected");
        });
        var tier = e.target.closest(".velora-widget__tier");
        if (tier) tier.classList.add("velora-widget__tier--selected");
      });
    });

    var btn = container.querySelector(".velora-widget__atc");
    if (!btn) return;

    btn.addEventListener("click", function () {
      trackEvent(apiUrl, shopDomain, productId, bundle.bundleId, "click");
      btn.disabled = true;
      btn.textContent = "Adding...";

      var items = (bundle.products || [])
        .filter(function (p) {
          return p.shopifyVariantId;
        })
        .map(function (product) {
          var variantId = product.shopifyVariantId;
          if (variantId.indexOf("gid://") === 0) {
            variantId = variantId.split("/").pop();
          }
          return {
            id: parseInt(variantId, 10),
            quantity: product.quantity || 1,
            properties: { _velora_bundle_id: bundle.bundleId },
          };
        });

      if (items.length === 0) {
        btn.disabled = false;
        btn.textContent = "Add bundle to cart";
        return;
      }

      fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items }),
      })
        .then(function () {
          btn.textContent = "Added!";
          setTimeout(function () {
            btn.disabled = false;
            btn.textContent = "Add bundle to cart";
          }, 2000);
          document.dispatchEvent(new CustomEvent("cart:updated"));
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = "Add bundle to cart";
        });
    });
  }

  async function initVeloraWidget() {
    var container = document.getElementById("velora-bundle-widget");
    if (!container) return;

    var shopDomain = container.dataset.shopDomain;
    var productId = container.dataset.productId;
    if (!shopDomain || !productId) return;

    var appUrl =
      container.dataset.appUrl || "https://app.velorabundles.com";
    appUrl = appUrl.replace(/\/$/, "");

    try {
      var response = await fetch(
        appUrl +
          "/api/widget/" +
          encodeURIComponent(shopDomain) +
          "/" +
          encodeURIComponent(productId),
        { headers: { "Content-Type": "application/json" } },
      );

      if (!response.ok) {
        container.remove();
        return;
      }

      var bundle = await response.json();
      container.innerHTML = renderWidget(bundle);
      trackEvent(appUrl, shopDomain, productId, bundle.bundleId, "view");
      attachEvents(container, bundle, appUrl, shopDomain, productId);
    } catch (_error) {
      container.remove();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVeloraWidget);
  } else {
    initVeloraWidget();
  }
})();
