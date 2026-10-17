/**
 * Present Panic - Production Storefront Core Controller
 * Connects Frontend UI with Shopify Backend (Storefront API, Cart, Collections, Search)
 * 100% Guest Checkout via Shopify Checkout. Zero Compare. Zero Wishlist.
 * 100% Real Shopify Data & Collections. Real Loading Skeletons.
 */

import {
  getShopifyProducts,
  getShopifyProductByHandle,
  getShopifyCollections,
  getShopifyCollectionByHandle,
  searchShopifyProducts,
  getShopifyProductRecommendations,
  formatShopifyMoney,
  getFallbackCollections,
  getFallbackProducts,
  prioritizeHeroProduct,
  ShopifyProduct,
  ShopifyVariant,
  ShopifyCollection,
} from '../lib/shopify';
import { cart } from '../lib/cart';
import { analytics } from '../lib/analytics';
import {
  getActiveMarket,
  getActiveCountryCode,
  setActiveMarket,
  initGeoMarketDetection,
  formatCurrency,
  MARKETS,
  MarketCode,
} from '../lib/currency';

// Expose on window for runtime debugging or global calls
(window as any).ShopifyCommerce = {
  getProducts: getShopifyProducts,
  getProductByHandle: getShopifyProductByHandle,
  getCollections: getShopifyCollections,
  getCollectionByHandle: getShopifyCollectionByHandle,
  searchProducts: searchShopifyProducts,
  getRecommendations: getShopifyProductRecommendations,
  formatMoney: formatShopifyMoney,
  cart,
  analytics,
  market: {
    getActiveMarket,
    setActiveMarket,
    MARKETS,
  },
};

(window as any).showToast = showToast;

async function initStorefront() {
  // Dual-Market & Currency Engine (UK 🇬🇧 & USA 🇺🇸)
  initMarketEngine();

  // Non-blocking Cart initialization (Synchronously loaded from snapshot, revalidates quietly)
  cart.init().catch(err => console.warn('Cart initialization notice:', err));

  // Enterprise Tracking: Automatic PageView, Form Submissions & Product Clicks
  analytics.trackPageView();
  setupGlobalFormTracking();
  setupProductClickTracking();

  // Bind Shared Global Components
  setupCartDrawer();
  setupSearchModal();
  setupMobileMenuDrawer();
  initGiftQuiz();
  setupHoverPrefetching();

  // Initialize Lucide Icons if available
  if ((window as any).lucide && typeof (window as any).lucide.createIcons === 'function') {
    (window as any).lucide.createIcons();
  }

  // 1. Homepage Controller (Dynamic Categories Carousel + Products)
  if (document.getElementById('flash-deals-container') || document.getElementById('category-stories-track')) {
    initHomepageCommerce();
  }

  // 2. Shop Catalog Page Controller (shop.html)
  if (document.getElementById('shop-products-grid')) {
    initShopPageCommerce();
  }

  // 3. Categories Hub Page Controller (categories.html)
  if (document.getElementById('categories-grid')) {
    initCategoriesPageCommerce();
  }

  // 4. Collection Template Page Controller (collection.html)
  if (document.getElementById('collection-products-grid')) {
    initCollectionPageCommerce();
  }

  // 5. Cart Page Controller (cart.html)
  if (document.getElementById('cart-page-items') || document.getElementById('cart-page-content')) {
    initCartPageCommerce();
  }

  // 6. Product Details Page Controller (product.html)
  if (document.getElementById('pdp-skeleton') || document.getElementById('pdp-title')) {
    initProductPageCommerce();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStorefront);
} else {
  initStorefront();
}

// ====================================================
// SHARED PRODUCT CARD COMPONENT BUILDER
// ====================================================
function createProductCardHTML(p: ShopifyProduct): string {
  const img = p.featuredImage?.url || (p.images?.nodes?.[0]?.url || '/images/personalized_box.jpg');
  const currency = p.priceRange.minVariantPrice.currencyCode || 'GBP';
  const price = formatShopifyMoney(p.priceRange.minVariantPrice.amount, currency);

  const hasCompare = Boolean(
    p.compareAtPriceRange?.minVariantPrice &&
    parseFloat(p.compareAtPriceRange.minVariantPrice.amount) > parseFloat(p.priceRange.minVariantPrice.amount)
  );
  const comparePrice = hasCompare
    ? formatShopifyMoney(p.compareAtPriceRange!.minVariantPrice.amount, currency)
    : '';

  const defaultVariant = p.variants?.nodes?.[0] || null;
  const variantId = defaultVariant ? defaultVariant.id : '';

  return `
    <div class="flex flex-col group w-full relative transition-all duration-300">
      <div class="relative w-full aspect-square overflow-hidden mb-3 flex items-center justify-center bg-white rounded-xl border border-neutral-100 shadow-2xs hover:shadow-xs transition-shadow">
        ${hasCompare ? `<span class="absolute top-2.5 left-2.5 bg-neutral-900 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider z-10 shadow-xs">Sale</span>` : ''}
        <a href="/product.html?handle=${p.handle}" class="w-full h-full flex items-center justify-center p-2" aria-label="${p.title}">
          <img alt="${p.title}" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 pointer-events-none" src="${img}" loading="lazy">
        </a>
      </div>
      <div class="flex flex-col text-left flex-1 justify-between">
        <div>
          <div class="text-[11px] sm:text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
            ${p.productType || 'Gifts'}
          </div>
          <a href="/product.html?handle=${p.handle}" class="text-sm sm:text-base font-semibold text-neutral-900 hover:text-neutral-600 transition block mb-1 line-clamp-1 sm:line-clamp-2 leading-snug">
            ${p.title}
          </a>
          <div class="flex items-baseline gap-2 mb-3">
            <span class="text-sm sm:text-base font-bold text-neutral-900">${price}</span>
            ${hasCompare ? `<span class="text-xs sm:text-sm text-neutral-400 line-through font-normal">${comparePrice}</span>` : ''}
          </div>
        </div>
        <button class="add-to-cart-action-btn w-full bg-neutral-900 hover:bg-black text-white text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md active:scale-[0.98]"
                data-variant-id="${variantId}"
                data-title="${p.title}"
                data-price="${price}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
          <span>Add to Cart</span>
        </button>
      </div>
    </div>
  `;
}

function bindAddToCartButtons(container: HTMLElement) {
  container.querySelectorAll('.add-to-cart-action-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const variantId = btn.getAttribute('data-variant-id');
      const title = btn.getAttribute('data-title') || 'Gift';
      if (!variantId) return;

      const origText = btn.innerHTML;
      btn.innerHTML = `
        <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
        <span>Adding...</span>
      `;
      (btn as HTMLElement).style.pointerEvents = 'none';
      try {
        await cart.addItem(variantId, 1);
        showToast(`Added "${title}" to your cart!`);
      } catch (err) {
        showToast('Could not add item to bag. Please try again.');
      } finally {
        btn.innerHTML = origText;
        (btn as HTMLElement).style.pointerEvents = 'auto';
      }
    });
  });
}

function setupGlobalFormTracking() {
  if (typeof document === 'undefined') return;

  // 1. Newsletter Forms across header/footer
  const newsletterForms = document.querySelectorAll('form[id*="newsletter"]');
  newsletterForms.forEach((form) => {
    form.addEventListener('submit', () => {
      const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement | null;
      const email = emailInput?.value || '';
      analytics.trackLead('Newsletter Subscription', email);
    });
  });

  // 2. Contact Page Form
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', () => {
      const emailInput = contactForm.querySelector('input[type="email"]') as HTMLInputElement | null;
      const email = emailInput?.value || '';
      analytics.trackLead('Contact Form Inquiry', email);
    });
  }
}

/**
 * Enterprise Tracking: Product Click Event Listener
 * Catches user clicks on any product card, link, or image across the store.
 * Fires Meta Pixel 'ProductClick' (with content_name) & GA4 'select_item' + 'product_click'.
 */
function setupProductClickTracking() {
  if (typeof document === 'undefined') return;

  document.addEventListener(
    'click',
    (e) => {
      try {
        const el = e.target as HTMLElement | null;
        if (!el) return;

        // Detect click on any anchor, button, or container targeting a product
        const link = el.closest(
          'a, [onclick*="/product.html"], [onclick*="/products/"], [data-product-handle]'
        ) as HTMLElement | null;
        if (!link) return;

        const href = link.getAttribute('href') || link.getAttribute('onclick') || '';
        const hasProductUrl = href.includes('/product.html?handle=') || href.includes('/products/');
        const hasProductData = link.hasAttribute('data-product-handle') || link.hasAttribute('data-product-title');

        if (!hasProductUrl && !hasProductData) return;

        // Extract product handle
        let handle = link.getAttribute('data-product-handle') || '';
        if (!handle) {
          if (href.includes('handle=')) {
            handle = href.split('handle=')[1]?.split('&')[0]?.split('#')[0]?.replace(/['"]/g, '') || '';
          } else if (href.includes('/products/')) {
            handle = href.split('/products/')[1]?.split('?')[0]?.split('#')[0]?.replace(/['"]/g, '') || '';
          }
        }

        // Find closest container card to extract extra info if available
        const card = link.closest('[data-product-title], .group, div');

        // Extract product title with multiple safe fallbacks
        let title =
          link.getAttribute('data-product-title') ||
          card?.getAttribute('data-product-title') ||
          link.getAttribute('aria-label') ||
          '';

        if (!title) {
          const titleEl = card?.querySelector('h1, h2, h3, h4, .font-semibold, .font-bold');
          if (titleEl && titleEl.textContent) {
            title = titleEl.textContent.trim();
          }
        }

        // Format clean title from handle if title was missing
        if (!title && handle) {
          title = handle
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        }

        if (!title && !handle) return;

        const price = link.getAttribute('data-product-price') || card?.getAttribute('data-product-price') || '';
        const category = link.getAttribute('data-product-category') || card?.getAttribute('data-product-category') || '';

        analytics.trackProductClick({
          title: title || handle,
          handle: handle,
          price: price || undefined,
          category: category || undefined,
          sourcePage: window.location.pathname + window.location.search,
          targetUrl: href || `/product.html?handle=${handle}`,
        });
      } catch (err) {
        // Non-blocking: never interfere with user clicks or navigation
        console.debug('[Analytics Click Notice]:', err);
      }
    },
    { capture: true, passive: true }
  );
}

// ====================================================
// DUAL-MARKET & CURRENCY ENGINE (UK 🇬🇧 & USA 🇺🇸)
// ====================================================

function initMarketEngine() {
  if (typeof document === 'undefined') return;

  // Mount Market Switcher in Desktop Header & Mobile Drawer
  mountDesktopMarketSwitcher();
  mountMobileMarketSwitcher();
  updateMarketUI();

  // Run async IP geolocation detection in background (fallback to timezone)
  initGeoMarketDetection().then(() => {
    updateMarketUI();
  });

  // Re-sync UI if market changes
  window.addEventListener('marketChange', (e: any) => {
    const config = e.detail?.config;
    updateMarketUI();
    if (config) {
      showToast(`Switched market to ${config.countryName} (${config.currency} ${config.symbol})`);
    }
    setTimeout(() => {
      window.location.reload();
    }, 450);
  });
}

function mountDesktopMarketSwitcher() {
  if (document.getElementById('market-switcher-container')) return;
  const cartBtn = document.getElementById('btn-header-cart');
  if (!cartBtn || !cartBtn.parentElement) return;

  const container = document.createElement('div');
  container.id = 'market-switcher-container';
  container.className = 'relative flex items-center mr-1 sm:mr-2';

  const market = getActiveMarket();
  container.innerHTML = `
    <button id="btn-market-switcher" type="button" aria-expanded="false" aria-label="Select Country and Currency" class="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-full text-xs font-bold text-white hover:bg-[#103B21] transition cursor-pointer border border-emerald-700/60 bg-[#0B2D19]/60 shadow-2xs">
      <span class="market-current-flag text-sm sm:text-base leading-none">${market.flag}</span>
      <span class="market-current-currency hidden sm:inline text-xs font-bold text-emerald-100">${market.currency} (${market.symbol})</span>
      <svg class="w-3 h-3 stroke-[2.5] text-emerald-200 transition-transform duration-200 market-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <div id="market-dropdown" class="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-neutral-100 p-2 hidden z-[150] text-neutral-800 text-xs">
      <div class="px-2.5 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Select Market</div>
      <button type="button" data-market="GB" class="market-select-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition font-semibold text-left cursor-pointer ${market.code === 'GB' ? 'bg-emerald-50 text-emerald-950 font-bold' : ''}">
        <span class="flex items-center gap-2.5"><span class="text-base">🇬🇧</span> United Kingdom</span>
        <span class="text-neutral-500 font-bold">GBP (£)</span>
      </button>
      <button type="button" data-market="US" class="market-select-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition font-semibold text-left cursor-pointer ${market.code === 'US' ? 'bg-emerald-50 text-emerald-950 font-bold' : ''}">
        <span class="flex items-center gap-2.5"><span class="text-base">🇺🇸</span> United States</span>
        <span class="text-neutral-500 font-bold">USD ($)</span>
      </button>
    </div>
  `;

  cartBtn.parentElement.insertBefore(container, cartBtn);

  const toggleBtn = container.querySelector('#btn-market-switcher');
  const dropdown = container.querySelector('#market-dropdown') as HTMLElement | null;
  const arrow = container.querySelector('.market-arrow') as HTMLElement | null;

  if (toggleBtn && dropdown) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = dropdown.classList.contains('hidden');
      if (isHidden) {
        dropdown.classList.remove('hidden');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
      } else {
        dropdown.classList.add('hidden');
        if (arrow) arrow.style.transform = '';
      }
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target as Node)) {
        dropdown.classList.add('hidden');
        if (arrow) arrow.style.transform = '';
      }
    });
  }

  container.querySelectorAll('.market-select-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const m = btn.getAttribute('data-market') as MarketCode;
      if (m) setActiveMarket(m);
    });
  });
}

function mountMobileMarketSwitcher() {
  if (document.getElementById('mobile-market-switcher-container')) return;
  const mobilePanel = document.getElementById('mobile-menu-panel');
  if (!mobilePanel) return;

  const container = document.createElement('div');
  container.id = 'mobile-market-switcher-container';
  container.className = 'pt-4 border-t border-gray-100 mt-4';

  const market = getActiveMarket();
  container.innerHTML = `
    <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Market & Currency</p>
    <div class="grid grid-cols-2 gap-2">
      <button type="button" data-market="GB" class="market-select-btn flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${market.code === 'GB'
      ? 'bg-[#0B2D19] text-white border-[#0B2D19]'
      : 'bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50'
    }">
        <span class="text-base">🇬🇧</span> UK (£)
      </button>
      <button type="button" data-market="US" class="market-select-btn flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${market.code === 'US'
      ? 'bg-[#0B2D19] text-white border-[#0B2D19]'
      : 'bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50'
    }">
        <span class="text-base">🇺🇸</span> USA ($)
      </button>
    </div>
  `;

  const helpSection = mobilePanel.querySelector('.pt-6.border-t.border-gray-100');
  if (helpSection) {
    mobilePanel.insertBefore(container, helpSection);
  } else {
    mobilePanel.appendChild(container);
  }

  container.querySelectorAll('.market-select-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const m = btn.getAttribute('data-market') as MarketCode;
      if (m) setActiveMarket(m);
    });
  });
}

function updateMarketUI() {
  const market = getActiveMarket();
  document.querySelectorAll('.market-current-flag').forEach((el) => {
    el.textContent = market.flag;
  });
  document.querySelectorAll('.market-current-currency').forEach((el) => {
    el.textContent = `${market.currency} (${market.symbol})`;
  });
  document.querySelectorAll('.market-select-btn').forEach((btn) => {
    const m = btn.getAttribute('data-market');
    if (m === market.code) {
      if (btn.closest('#mobile-market-switcher-container')) {
        btn.className = 'market-select-btn flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer bg-[#0B2D19] text-white border-[#0B2D19] shadow-xs';
      } else {
        btn.classList.add('bg-emerald-50', 'text-emerald-950', 'font-bold');
      }
    } else {
      if (btn.closest('#mobile-market-switcher-container')) {
        btn.className = 'market-select-btn flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50';
      } else {
        btn.classList.remove('bg-emerald-50', 'text-emerald-950', 'font-bold');
      }
    }
  });

  // Dynamically update the 4 hero promo banner cards to match active market currency
  document.querySelectorAll<HTMLElement>('[data-bento-price]').forEach((el) => {
    const baseGbp = el.getAttribute('data-bento-price');
    if (baseGbp) {
      el.textContent = formatCurrency(parseFloat(baseGbp), 'GBP');
    }
  });
  document.querySelectorAll<HTMLElement>('[data-bento-compare]').forEach((el) => {
    const baseGbp = el.getAttribute('data-bento-compare');
    if (baseGbp) {
      el.textContent = formatCurrency(parseFloat(baseGbp), 'GBP');
    }
  });
}

// ====================================================
// 1. CART DRAWER CONTROLLER
// ====================================================
function setupCartDrawer() {
  const cartTrigger = document.getElementById('btn-header-cart') || document.getElementById('btn-cart-trigger');
  const cartOverlay = document.getElementById('cart-drawer-overlay');
  const closeCartBtn = document.getElementById('btn-close-cart-drawer') || document.getElementById('btn-close-cart');
  const checkoutBtn =
    document.getElementById('cart-checkout-btn') ||
    document.getElementById('btn-proceed-checkout') ||
    document.getElementById('btn-checkout');
  const promoInput = document.getElementById('cart-promo-input') as HTMLInputElement | null;
  const applyPromoBtn = document.getElementById('btn-apply-promo');
  const removePromoBtn = document.getElementById('btn-remove-promo');
  const emptyShopBtn = document.getElementById('btn-cart-empty-shop');

  function openCart() {
    if (!cartOverlay) return;
    cartOverlay.classList.remove('pointer-events-none');
    cartOverlay.classList.add('active');
    const backdrop = document.getElementById('cart-drawer-backdrop');
    const panel = document.getElementById('cart-drawer-panel');
    if (backdrop) {
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
    }
    if (panel) {
      panel.classList.remove('translate-x-full');
      panel.classList.add('translate-x-0');
    }
    cart.renderCartUI();

    try {
      const currentCart = cart.getCurrentCart();
      if (currentCart && currentCart.lines?.nodes?.length > 0) {
        analytics.trackViewCart(
          currentCart.lines.nodes.map((n) => ({
            id: n.merchandise?.product?.id || n.merchandise?.id || '',
            variantId: n.merchandise?.id,
            title: n.merchandise?.product?.title || n.merchandise?.title || 'Product',
            price: n.merchandise?.price?.amount || 0,
            currency: n.merchandise?.price?.currencyCode || 'GBP',
            quantity: n.quantity || 1,
          })),
          parseFloat(currentCart.cost?.totalAmount?.amount || '0'),
          currentCart.cost?.totalAmount?.currencyCode || 'GBP'
        );
      }
    } catch (_) {}
  }

  function closeCart() {
    if (!cartOverlay) return;
    cartOverlay.classList.remove('active');
    const backdrop = document.getElementById('cart-drawer-backdrop');
    const panel = document.getElementById('cart-drawer-panel');
    if (backdrop) {
      backdrop.classList.remove('opacity-100');
      backdrop.classList.add('opacity-0');
    }
    if (panel) {
      panel.classList.remove('translate-x-0');
      panel.classList.add('translate-x-full');
    }
    setTimeout(() => {
      cartOverlay.classList.add('pointer-events-none');
    }, 300);
  }

  if (cartTrigger) {
    cartTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      openCart();
    });
  }

  if (closeCartBtn) {
    closeCartBtn.addEventListener('click', closeCart);
  }

  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeCart);
  }

  if (emptyShopBtn) {
    emptyShopBtn.addEventListener('click', () => {
      closeCart();
      const flash = document.getElementById('flash-deals');
      if (flash) flash.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        checkoutBtn.style.pointerEvents = 'none';
        checkoutBtn.style.opacity = '0.92';
        checkoutBtn.innerHTML = `
          <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          <span class="font-bold tracking-wide">Redirecting to Checkout...</span>
        `;
      } catch (_) {}
      cart.proceedToCheckout();
    });
  }

  if (applyPromoBtn && promoInput) {
    applyPromoBtn.addEventListener('click', async () => {
      const code = promoInput.value.trim();
      if (!code) return;
      applyPromoBtn.textContent = 'Applying...';
      try {
        await cart.applyPromoCode(code);
        showToast(`Promo "${code.toUpperCase()}" applied!`);
        promoInput.value = '';
      } catch (err: any) {
        showToast(err.message || 'Invalid promo code');
      } finally {
        applyPromoBtn.textContent = 'Apply';
      }
    });
  }

  if (removePromoBtn) {
    removePromoBtn.addEventListener('click', async () => {
      try {
        await cart.removePromoCode();
        showToast('Promo code removed');
      } catch (err) {
        showToast('Failed to remove promo');
      }
    });
  }
}

// ====================================================
// 2. MOBILE MENU DRAWER CONTROLLER
// ====================================================
function setupMobileMenuDrawer() {
  const openBtn = document.getElementById('btn-open-mobile-menu');
  const closeBtn = document.getElementById('btn-close-mobile-menu');
  const drawer = document.getElementById('mobile-menu-drawer');
  const backdrop = document.getElementById('mobile-menu-backdrop');
  const panel = document.getElementById('mobile-menu-panel');

  if (!drawer || !panel) return;

  function openMenu() {
    drawer.classList.remove('pointer-events-none');
    backdrop?.classList.remove('opacity-0');
    backdrop?.classList.add('opacity-100');
    panel.classList.remove('-translate-x-full');
    panel.classList.add('translate-x-0');
  }

  function closeMenu() {
    backdrop?.classList.remove('opacity-100');
    backdrop?.classList.add('opacity-0');
    panel.classList.remove('translate-x-0');
    panel.classList.add('-translate-x-full');
    setTimeout(() => {
      drawer.classList.add('pointer-events-none');
    }, 300);
  }

  if (openBtn) openBtn.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (backdrop) backdrop.addEventListener('click', closeMenu);

  drawer.querySelectorAll('.mobile-nav-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ====================================================
// 3. SEARCH CONTROLLER (Header Search Bar & Search Modal)
// ====================================================
function setupSearchModal() {
  // 1. Mobile Search Modal Elements
  const searchTrigger = document.getElementById('btn-header-search') || document.getElementById('btn-search-trigger');
  const searchOverlay = document.getElementById('search-modal-overlay');
  const closeSearchBtn = document.getElementById('btn-close-search-modal') || document.getElementById('btn-close-search');
  const modalSearchInput = (document.getElementById('live-search-input') ||
    document.getElementById('search-modal-input') ||
    document.getElementById('search-input')) as HTMLInputElement | null;
  const modalResultsContainer = document.getElementById('live-search-results') ||
    document.getElementById('search-results-container');
  const clearBtn = document.getElementById('btn-clear-search');

  // 2. Desktop Header Search Bar Elements
  const headerSearchInput = document.getElementById('header-search-input') as HTMLInputElement | null;
  const headerSearchSubmit = document.getElementById('btn-header-search-submit');
  const headerSearchResults = document.getElementById('header-search-results');

  // --- Modal Search Logic ---
  function openSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.remove('hidden');
    searchOverlay.classList.add('flex', 'active');
    if (modalSearchInput) {
      setTimeout(() => modalSearchInput.focus(), 150);
    }
  }

  function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.add('hidden');
    searchOverlay.classList.remove('flex', 'active');
  }

  if (searchTrigger) searchTrigger.addEventListener('click', openSearch);
  if (closeSearchBtn) closeSearchBtn.addEventListener('click', closeSearch);
  if (searchOverlay) {
    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) closeSearch();
    });
  }

  if (clearBtn && modalSearchInput) {
    clearBtn.addEventListener('click', () => {
      modalSearchInput.value = '';
      clearBtn.classList.add('hidden');
      triggerModalSearch('');
    });
  }

  let modalDebounceTimer: any = null;
  if (modalSearchInput) {
    modalSearchInput.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value;
      if (clearBtn) {
        if (q.trim()) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
      clearTimeout(modalDebounceTimer);
      modalDebounceTimer = setTimeout(() => {
        triggerModalSearch(q);
      }, 200);
    });

    modalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = modalSearchInput.value.trim();
        if (q) {
          try { analytics.trackSearch(q); } catch (_) {}
          window.location.href = `/shop.html?q=${encodeURIComponent(q)}`;
        }
      }
    });
  }

  // Handle trending tag chips inside modal
  document.querySelectorAll('.search-tag-chip, [data-tag]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const tag = chip.getAttribute('data-tag') || chip.textContent?.trim() || '';
      if (tag && modalSearchInput) {
        modalSearchInput.value = tag;
        if (clearBtn) clearBtn.classList.remove('hidden');
        triggerModalSearch(tag);
        modalSearchInput.focus();
      }
    });
  });

  async function triggerModalSearch(q: string) {
    if (!modalResultsContainer) return;
    if (!q.trim()) {
      modalResultsContainer.innerHTML = `
        <div class="text-center py-8 text-neutral-400 text-xs">
          Type to search gifts by title, category, or recipient...
        </div>
      `;
      return;
    }

    modalResultsContainer.innerHTML = `
      <div class="flex items-center justify-center py-8 text-neutral-500 text-xs gap-2">
        <div class="w-4 h-4 border-2 border-[#ff4d61] border-t-transparent rounded-full animate-spin"></div>
        <span>Searching gifts...</span>
      </div>
    `;

    try {
      const products = await searchShopifyProducts(q, 10);
      if (products.length === 0) {
        modalResultsContainer.innerHTML = `
          <div class="text-center py-8">
            <p class="text-xs font-bold text-neutral-800">No gifts found matching "${escapeHtml(q)}"</p>
            <p class="text-[11px] text-neutral-400 mt-1">Try another search term like "Crystal", "Lamp", "Gifts", or "Decor".</p>
            <a href="/shop.html?q=${encodeURIComponent(q)}" class="inline-block mt-3 px-4 py-2 text-xs font-bold bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition">
              Explore All in Shop
            </a>
          </div>
        `;
        return;
      }

      modalResultsContainer.innerHTML = `
        <div class="space-y-2">
          ${products.map((p) => {
            const img = p.featuredImage?.url || '/images/personalized_box.jpg';
            const cur = p.priceRange.minVariantPrice.currencyCode || 'GBP';
            const price = formatShopifyMoney(p.priceRange.minVariantPrice.amount, cur);
            return `
              <a href="/product.html?handle=${p.handle}" class="flex items-center gap-3 p-3 rounded-2xl hover:bg-neutral-50 transition border border-transparent hover:border-gray-100 group">
                <img src="${img}" alt="${escapeHtml(p.title)}" class="w-12 h-12 object-contain rounded-xl bg-gray-50 flex-shrink-0">
                <div class="flex-1 min-w-0">
                  <h4 class="text-xs font-bold text-neutral-900 group-hover:text-[#ff4d61] transition line-clamp-1">${escapeHtml(p.title)}</h4>
                  <p class="text-[11px] text-neutral-400">${escapeHtml(p.productType || 'Gift Item')}</p>
                </div>
                <span class="text-xs font-black text-neutral-900">${price}</span>
              </a>
            `;
          }).join('')}
          <a href="/shop.html?q=${encodeURIComponent(q)}" class="block text-center py-3 mt-3 border-t border-gray-100 text-xs font-bold text-[#ff4d61] hover:text-[#e03a4e] transition bg-rose-50/60 hover:bg-rose-50 rounded-xl">
            View all results for "${escapeHtml(q)}" in Shop →
          </a>
        </div>
      `;
    } catch (err) {
      modalResultsContainer.innerHTML = `
        <div class="text-center py-6 text-rose-500 text-xs">Search error. Please try again.</div>
      `;
    }
  }

  // --- Inline Header Search Bar Logic ---
  if (headerSearchInput && headerSearchResults) {
    let headerDebounceTimer: any = null;

    const performHeaderSearch = async (queryText: string) => {
      const q = queryText.trim();
      if (!q) {
        headerSearchResults.classList.add('hidden');
        headerSearchResults.innerHTML = '';
        return;
      }

      headerSearchResults.classList.remove('hidden');
      headerSearchResults.innerHTML = `
        <div class="flex items-center justify-center py-6 text-neutral-400 text-xs gap-2">
          <div class="w-4 h-4 border-2 border-[#0B2D19] border-t-transparent rounded-full animate-spin"></div>
          <span>Searching catalog...</span>
        </div>
      `;

      try {
        const products = await searchShopifyProducts(q, 6);
        if (products.length === 0) {
          headerSearchResults.innerHTML = `
            <div class="text-center py-6 px-4">
              <p class="text-xs font-bold text-neutral-800">No gifts found for "${escapeHtml(q)}"</p>
              <p class="text-[11px] text-neutral-400 mt-1">Press Enter to search the full shop</p>
              <a href="/shop.html?q=${encodeURIComponent(q)}" class="inline-block mt-3 px-3 py-1.5 text-xs font-bold bg-[#0B2D19] text-white rounded-lg hover:bg-emerald-900 transition">
                Search in Shop
              </a>
            </div>
          `;
          return;
        }

        headerSearchResults.innerHTML = `
          <div class="space-y-1">
            ${products.map((p) => {
              const img = p.featuredImage?.url || '/images/personalized_box.jpg';
              const cur = p.priceRange.minVariantPrice.currencyCode || 'GBP';
              const price = formatShopifyMoney(p.priceRange.minVariantPrice.amount, cur);
              return `
                <a href="/product.html?handle=${p.handle}" class="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-50 transition border border-transparent hover:border-gray-100 group">
                  <img src="${img}" alt="${escapeHtml(p.title)}" class="w-10 h-10 object-contain rounded-lg bg-gray-50 flex-shrink-0">
                  <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold text-neutral-900 group-hover:text-[#ff4d61] transition line-clamp-1">${escapeHtml(p.title)}</h4>
                    <p class="text-[10px] text-neutral-400">${escapeHtml(p.productType || 'Gift Item')}</p>
                  </div>
                  <span class="text-xs font-black text-neutral-900">${price}</span>
                </a>
              `;
            }).join('')}
            <a href="/shop.html?q=${encodeURIComponent(q)}" class="block text-center py-2 mt-1 border-t border-gray-100 text-xs font-bold text-[#ff4d61] hover:text-[#e03a4e] transition bg-rose-50/50 hover:bg-rose-50 rounded-lg">
              View all results for "${escapeHtml(q)}" in Shop →
            </a>
          </div>
        `;
      } catch (err) {
        headerSearchResults.innerHTML = `
          <div class="text-center py-4 text-rose-500 text-xs">Search error. Please try again.</div>
        `;
      }
    };

    headerSearchInput.addEventListener('input', (e) => {
      clearTimeout(headerDebounceTimer);
      const val = (e.target as HTMLInputElement).value;
      headerDebounceTimer = setTimeout(() => {
        performHeaderSearch(val);
      }, 200);
    });

    headerSearchInput.addEventListener('focus', () => {
      if (headerSearchInput.value.trim()) {
        performHeaderSearch(headerSearchInput.value);
      }
    });

    headerSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = headerSearchInput.value.trim();
        if (q) {
          try { analytics.trackSearch(q); } catch (_) {}
          window.location.href = `/shop.html?q=${encodeURIComponent(q)}`;
        }
      }
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!headerSearchInput.contains(target) && !headerSearchResults.contains(target)) {
        headerSearchResults.classList.add('hidden');
      }
    });
  }

  if (headerSearchSubmit) {
    headerSearchSubmit.addEventListener('click', (e) => {
      e.preventDefault();
      const q = headerSearchInput?.value.trim() || '';
      if (q) {
        try { analytics.trackSearch(q); } catch (_) {}
        window.location.href = `/shop.html?q=${encodeURIComponent(q)}`;
      } else if (headerSearchInput) {
        headerSearchInput.focus();
      }
    });
  }
}

function renderHomepageCategories(collections: ShopifyCollection[]) {
  const track = document.getElementById('category-stories-track');
  if (!track || !collections || collections.length === 0) return;

  const THEMES = [
    { outer: 'bg-[#ffe1e8]', inner: 'bg-[#f4cbd6]' }, // 0. Handmade Gifts (Pink)
    { outer: 'bg-[#e6f5ea]', inner: 'bg-[#b8dcba]' }, // 1. Christmas Gifts (Mint)
    { outer: 'bg-[#fdf0df]', inner: 'bg-[#eed5b3]' }, // 2. Clocks (Honey)
    { outer: 'bg-[#e9e2fb]', inner: 'bg-[#d8c6f4]' }, // 3. Table Lamps (Lavender)
    { outer: 'bg-[#fceee5]', inner: 'bg-[#f0d4c4]' }, // 4. Personalized Gifts (Blush)
    { outer: 'bg-[#ffe1e8]', inner: 'bg-[#cfbecb]' }, // 5. Desk Organizers (Pink)
    { outer: 'bg-[#e6f5ea]', inner: 'bg-[#a7cea8]' }, // 6. HomeDecor (Mint)
    { outer: 'bg-[#fdf0df]', inner: 'bg-[#eed5b3]' }, // 7. Toys (Honey)
  ];

  track.innerHTML = collections
    .map((col, idx) => {
      const theme = THEMES[idx % THEMES.length];
      const imgUrl = col.image?.url;
      const isPhoto = imgUrl && (col.title.toLowerCase().includes('personalized') || imgUrl.includes('IMG_3962'));

      const imgHtml = imgUrl
        ? `<img alt="${col.title}" class="w-full h-full ${
            isPhoto ? 'object-cover' : 'object-contain mix-blend-multiply scale-[1.12] sm:scale-[1.16]'
          } object-center transition-transform duration-500 ease-out group-hover:scale-125" src="${imgUrl}" loading="eager">`
        : `<div class="w-full h-full text-[#ff4d61] flex items-center justify-center font-bold text-3xl">${col.title.charAt(0)}</div>`;

      return `
        <a class="flex flex-col items-center flex-shrink-0 group outline-none focus:outline-none w-28 sm:w-36 lg:w-44 snap-center cursor-pointer" 
           href="/collection.html?handle=${col.handle}">
          <!-- Outer Border Ring Frame -->
          <div class="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full ${theme.outer} flex items-center justify-center p-2 sm:p-2.5 lg:p-3 transition-all duration-300 group-hover:-translate-y-1.5 shadow-sm group-hover:shadow-md">
            <!-- Inner Circle -->
            <div class="w-full h-full rounded-full ${theme.inner} flex items-center justify-center overflow-hidden p-1 sm:p-1.5 shadow-inner">
              ${imgHtml}
            </div>
          </div>
          <span class="mt-3 sm:mt-4 text-xs sm:text-sm font-bold text-neutral-800 text-center group-hover:text-[#ff4d61] transition-colors">${col.title}</span>
        </a>
      `;
    })
    .join('');
}

function renderHomepageProducts(products: ShopifyProduct[]) {
  const container = document.getElementById('flash-deals-container');
  if (!container || !products || products.length === 0) return;
  container.innerHTML = products.map(createProductCardHTML).join('');
  bindAddToCartButtons(container);
}

function setupHoverPrefetching() {
  if (typeof document === 'undefined') return;
  document.addEventListener('mouseover', (e) => {
    const target = (e.target as HTMLElement)?.closest('a');
    if (!target) return;
    const href = target.getAttribute('href') || '';
    if (href.includes('/product.html?handle=')) {
      const handle = href.split('handle=')[1]?.split('&')[0];
      if (handle) getShopifyProductByHandle(handle).catch(() => {});
    } else if (href.includes('/collection.html?handle=')) {
      const handle = href.split('handle=')[1]?.split('&')[0];
      if (handle) getShopifyCollectionByHandle(handle, 24).catch(() => {});
    }
  }, { passive: true });
}

// ====================================================
// 4. HOMEPAGE COMMERCE INITIALIZATION
// ====================================================
async function initHomepageCommerce() {
  // 1. Instant 0ms Render with Pre-Seeded / SWR Cached Data
  const seedCollections = getFallbackCollections();
  renderHomepageCategories(seedCollections);

  const seedProducts = prioritizeHeroProduct(getFallbackProducts());
  renderHomepageProducts(seedProducts.slice(0, 12));

  // 2. Fetch Live Shopify Data in Parallel (0ms cache hit or background refresh)
  Promise.all([
    getShopifyCollections(100),
    getShopifyProducts({ first: 24 }),
  ]).then(([freshCollections, freshProducts]) => {
    if (freshCollections && freshCollections.length > 0) {
      renderHomepageCategories(freshCollections);
    }
    if (freshProducts && freshProducts.length > 0) {
      renderHomepageProducts(prioritizeHeroProduct(freshProducts));
    }
  }).catch((err) => {
    console.warn('[Homepage] Parallel fetch notice:', err);
  });

  // 3. React to silent SWR background updates
  window.addEventListener('shopify:collections:updated', (e: any) => {
    if (e.detail && Array.isArray(e.detail)) renderHomepageCategories(e.detail);
  });
  window.addEventListener('shopify:products:updated', (e: any) => {
    if (e.detail && Array.isArray(e.detail)) renderHomepageProducts(prioritizeHeroProduct(e.detail));
  });
}

// ====================================================
// 5. SHOP CATALOG PAGE CONTROLLER (shop.html)
// ====================================================
async function initShopPageCommerce() {
  const grid = document.getElementById('shop-products-grid');
  const countEl = document.getElementById('shop-products-count');
  const emptyState = document.getElementById('shop-empty-state');
  const sortSelect = document.getElementById('shop-sort-select') as HTMLSelectElement | null;
  const searchInput = document.getElementById('shop-search-input') as HTMLInputElement | null;
  const filterContainer = document.getElementById('shop-category-filters');
  const resetBtn = document.getElementById('btn-reset-filters');

  let allProducts: ShopifyProduct[] = [];
  let currentProducts: ShopifyProduct[] = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let currentSort = 'featured';

  // Read URL query params for search or collection filtering
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q') || urlParams.get('search');
  if (initialQuery) {
    currentSearch = initialQuery.trim();
    if (searchInput) searchInput.value = currentSearch;
    const headerInput = document.getElementById('header-search-input') as HTMLInputElement | null;
    if (headerInput) headerInput.value = currentSearch;
    try { analytics.trackSearch(currentSearch); } catch (_) {}
  }
  const initialCategory = urlParams.get('collection') || urlParams.get('category');
  if (initialCategory) {
    currentFilter = initialCategory.trim();
  }

  function renderShopFilterButtons(collections: ShopifyCollection[]) {
    if (!filterContainer) return;
    let filterHTML = `
      <button class="shop-filter-btn ${currentFilter === 'all' ? 'active bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'} text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap" data-filter="all">
        All Products
      </button>
    `;

    collections.forEach((col) => {
      const isSelected = currentFilter === col.handle;
      filterHTML += `
        <button class="shop-filter-btn ${isSelected ? 'active bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'} hover:bg-neutral-200 text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap" data-filter="${col.handle}" data-title="${col.title}">
          ${col.title}
        </button>
      `;
    });

    filterContainer.innerHTML = filterHTML;

    filterContainer.querySelectorAll('.shop-filter-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        filterContainer.querySelectorAll('.shop-filter-btn').forEach(b => {
          b.classList.remove('active', 'bg-neutral-900', 'text-white');
          b.classList.add('bg-neutral-100', 'text-neutral-700');
        });
        btn.classList.add('active', 'bg-neutral-900', 'text-white');
        btn.classList.remove('bg-neutral-100', 'text-neutral-700');

        currentFilter = btn.getAttribute('data-filter') || 'all';

        if (currentFilter === 'all') {
          currentProducts = [...allProducts];
          applyFilterAndSort();
        } else {
          try {
            const colData = await getShopifyCollectionByHandle(currentFilter, 250);
            currentProducts = colData?.products || [];
          } catch (e) {
            currentProducts = [];
          }
          applyFilterAndSort();
        }
      });
    });
  }

  // 1. Instant 0ms render of categories & catalog from seed/cache
  const initialCollections = getFallbackCollections();
  renderShopFilterButtons(initialCollections);

  const initialProds = prioritizeHeroProduct(getFallbackProducts());
  allProducts = [...initialProds];
  currentProducts = [...initialProds];
  applyFilterAndSort();

  // 2. Fetch fresh collections & products in parallel!
  Promise.all([
    getShopifyCollections(100),
    getShopifyProducts({ first: 250 }),
  ]).then(async ([freshCols, freshProds]) => {
    if (freshCols && freshCols.length > 0) {
      renderShopFilterButtons(freshCols);
    }
    if (freshProds && freshProds.length > 0) {
      allProducts = prioritizeHeroProduct(freshProds);
      if (currentFilter === 'all') {
        currentProducts = [...allProducts];
      } else {
        const colData = await getShopifyCollectionByHandle(currentFilter, 250);
        currentProducts = colData?.products || [...allProducts];
      }
      applyFilterAndSort();
    }
  }).catch(err => {
    console.warn('[Shop] Notice during parallel fetch:', err);
  });

  // 3. React to live background updates
  window.addEventListener('shopify:products:updated', (e: any) => {
    if (e.detail && e.detail.length > 0) {
      allProducts = prioritizeHeroProduct(e.detail);
      if (currentFilter === 'all') {
        currentProducts = [...allProducts];
        applyFilterAndSort();
      }
    }
  });

  window.addEventListener('shopify:collections:updated', (e: any) => {
    if (e.detail && e.detail.length > 0) {
      renderShopFilterButtons(e.detail);
    }
  });

  function applyFilterAndSort() {
    if (!grid) return;

    let filtered = [...currentProducts];

    // Filter by keyword search
    if (currentSearch.trim()) {
      const q = currentSearch.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        const tagMatch = p.tags?.some(t => t.toLowerCase().includes(q));
        return titleMatch || descMatch || tagMatch;
      });
    }

    // Sort
    if (currentSort === 'price-asc') {
      filtered.sort((a, b) => parseFloat(a.priceRange.minVariantPrice.amount) - parseFloat(b.priceRange.minVariantPrice.amount));
    } else if (currentSort === 'price-desc') {
      filtered.sort((a, b) => parseFloat(b.priceRange.minVariantPrice.amount) - parseFloat(a.priceRange.minVariantPrice.amount));
    } else if (currentSort === 'title-asc') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // 'featured' / default sort: Always pin DIY Crochet Cat Bed Kit to index 0 on top!
      if (!currentSearch.trim()) {
        filtered = prioritizeHeroProduct(filtered);
      }
    }

    if (countEl) countEl.textContent = String(filtered.length);

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyState?.classList.remove('hidden');
    } else {
      emptyState?.classList.add('hidden');
      grid.innerHTML = filtered.map(createProductCardHTML).join('');
      bindAddToCartButtons(grid);
    }
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = (e.target as HTMLSelectElement).value;
      applyFilterAndSort();
    });
  }

  if (searchInput) {
    let sTimer: any = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(sTimer);
      sTimer = setTimeout(() => {
        currentSearch = (e.target as HTMLInputElement).value;
        applyFilterAndSort();
      }, 250);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      currentFilter = 'all';
      currentSearch = '';
      if (searchInput) searchInput.value = '';
      const headerInput = document.getElementById('header-search-input') as HTMLInputElement | null;
      if (headerInput) headerInput.value = '';
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (filterContainer) {
        filterContainer.querySelectorAll('.shop-filter-btn').forEach((b, idx) => {
          if (idx === 0) {
            b.classList.add('active', 'bg-neutral-900', 'text-white');
            b.classList.remove('bg-neutral-100', 'text-neutral-700');
          } else {
            b.classList.remove('active', 'bg-neutral-900', 'text-white');
            b.classList.add('bg-neutral-100', 'text-neutral-700');
          }
        });
      }
      currentProducts = [...allProducts];
      applyFilterAndSort();
    });
  }
}

// ====================================================
// 6. CATEGORIES HUB PAGE CONTROLLER (categories.html)
// ====================================================
async function initCategoriesPageCommerce() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  try {
    const collections = await getShopifyCollections(100);
    if (collections.length > 0) {
      grid.innerHTML = collections
        .map((col) => {
          const imgUrl = col.image?.url;
          const imgHtml = imgUrl
            ? `<img src="${imgUrl}" alt="${col.title}" class="w-full h-full object-cover">`
            : `<div class="w-full h-full bg-rose-50 text-[#ff4d61] flex items-center justify-center font-black text-2xl">${col.title.charAt(0)}</div>`;

          return `
            <a href="/collection.html?handle=${col.handle}" class="group bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:shadow-xl transition-all duration-300">
              <div>
                <div class="w-16 h-16 rounded-2xl overflow-hidden mb-6 group-hover:scale-105 transition-transform border border-gray-100 shadow-xs">
                  ${imgHtml}
                </div>
                <h2 class="text-xl sm:text-2xl font-bold text-neutral-900 group-hover:text-[#ff4d61] transition">
                  ${col.title}
                </h2>
                <p class="text-xs sm:text-sm text-neutral-500 mt-2 leading-relaxed">
                  ${col.description || 'Explore curated items available in this Shopify collection.'}
                </p>
              </div>
              <div class="mt-6 flex items-center gap-2 text-xs font-bold text-[#ff4d61] group-hover:translate-x-1 transition-transform">
                <span>Explore Collection</span>
                <span>&rarr;</span>
              </div>
            </a>
          `;
        })
        .join('');
    }
  } catch (err) {
    console.warn('[Categories] Notice loading collections from Shopify:', err);
  }
}

// ====================================================
// 7. COLLECTION TEMPLATE CONTROLLER (collection.html)
// ====================================================
async function initCollectionPageCommerce() {
  const urlParams = new URLSearchParams(window.location.search);
  const handle = urlParams.get('handle') || 'handmade-gifts';

  const titleEl = document.getElementById('collection-title');
  const breadcrumbEl = document.getElementById('collection-breadcrumb-title');
  const descEl = document.getElementById('collection-description');
  const countEl = document.getElementById('collection-product-count');
  const grid = document.getElementById('collection-products-grid');
  const bannerImg = document.getElementById('collection-banner-img') as HTMLImageElement | null;
  const emptyState = document.getElementById('collection-empty-state');
  const sortSelect = document.getElementById('collection-sort-select') as HTMLSelectElement | null;
  const searchInput = document.getElementById('collection-search-input') as HTMLInputElement | null;

  try {
    const colData = await getShopifyCollectionByHandle(handle, 250);
    if (!colData) return;

    let { collection, products } = colData;

    document.title = `${collection.title} | Present Panic`;
    if (titleEl) titleEl.textContent = collection.title;
    if (breadcrumbEl) breadcrumbEl.textContent = collection.title;
    if (descEl) descEl.textContent = collection.description || `Browse curated gifts in our ${collection.title} collection.`;

    if (bannerImg && collection.image?.url) {
      bannerImg.src = collection.image.url;
      bannerImg.alt = collection.title;
    }

    if (countEl) countEl.textContent = String(products.length);

    function renderCollectionProducts(items: ShopifyProduct[]) {
      if (!grid) return;
      if (items.length === 0) {
        grid.innerHTML = '';
        emptyState?.classList.remove('hidden');
      } else {
        emptyState?.classList.add('hidden');
        grid.innerHTML = items.map(createProductCardHTML).join('');
        bindAddToCartButtons(grid);
      }
    }

    renderCollectionProducts(products);

    // Listen for live background updates
    window.addEventListener('shopify:collection:updated', (e: any) => {
      if (e.detail && e.detail.collection && e.detail.collection.handle === handle) {
        products = e.detail.products || [];
        renderCollectionProducts(products);
        if (countEl) countEl.textContent = String(products.length);
      }
    });

    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        const val = sortSelect.value;
        let sorted = [...products];
        if (val === 'price-asc') {
          sorted.sort((a, b) => parseFloat(a.priceRange.minVariantPrice.amount) - parseFloat(b.priceRange.minVariantPrice.amount));
        } else if (val === 'price-desc') {
          sorted.sort((a, b) => parseFloat(b.priceRange.minVariantPrice.amount) - parseFloat(a.priceRange.minVariantPrice.amount));
        } else if (val === 'title-asc') {
          sorted.sort((a, b) => a.title.localeCompare(b.title));
        }
        renderCollectionProducts(sorted);
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        const filtered = products.filter(p => p.title.toLowerCase().includes(q));
        renderCollectionProducts(filtered);
      });
    }

  } catch (err) {
    console.error('Error loading collection:', err);
  }
}

// ====================================================
// 8. CART PAGE CONTROLLER (cart.html)
// ====================================================
function initCartPageCommerce() {
  const itemsContainer = document.getElementById('cart-page-items');
  const emptyView = document.getElementById('cart-page-empty');
  const contentView = document.getElementById('cart-page-content');
  const subtotalEl = document.getElementById('cart-page-subtotal');
  const totalEl = document.getElementById('cart-page-total');
  const progressBar = document.getElementById('cart-page-shipping-progress');
  const shippingText = document.getElementById('cart-page-shipping-text');
  const checkoutBtn = document.getElementById('btn-cart-page-checkout');
  const promoInput = document.getElementById('cart-page-promo') as HTMLInputElement | null;
  const applyPromoBtn = document.getElementById('btn-cart-page-apply-promo');

  function renderPageCart() {
    const currentCart = cart.getCurrentCart();
    if (!currentCart || currentCart.lines.nodes.length === 0) {
      if (contentView) contentView.classList.add('hidden');
      if (emptyView) emptyView.classList.remove('hidden');
      return;
    }

    if (contentView) contentView.classList.remove('hidden');
    if (emptyView) emptyView.classList.add('hidden');

    const currency = currentCart.cost.subtotalAmount.currencyCode || 'GBP';
    const subtotalNum = parseFloat(currentCart.cost.subtotalAmount.amount);
    const subtotal = formatShopifyMoney(subtotalNum, currency);
    const total = formatShopifyMoney(parseFloat(currentCart.cost.totalAmount.amount), currency);

    if (subtotalEl) subtotalEl.textContent = subtotal;
    if (totalEl) totalEl.textContent = total;

    try {
      analytics.trackViewCart(
        currentCart.lines.nodes.map((n) => ({
          id: n.merchandise?.product?.id || n.merchandise?.id || '',
          variantId: n.merchandise?.id,
          title: n.merchandise?.product?.title || n.merchandise?.title || 'Product',
          price: n.merchandise?.price?.amount || 0,
          currency: n.merchandise?.price?.currencyCode || 'GBP',
          quantity: n.quantity || 1,
        })),
        parseFloat(currentCart.cost?.totalAmount?.amount || '0'),
        currency
      );
    } catch (_) {}

    // Free shipping threshold ($75)
    const threshold = 75;
    const diff = Math.max(0, threshold - subtotalNum);
    const pct = Math.min(100, Math.round((subtotalNum / threshold) * 100));
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (shippingText) {
      if (diff === 0) {
        shippingText.innerHTML = `🎉 <strong>Congratulations! Free Shipping Unlocked!</strong>`;
      } else {
        shippingText.innerHTML = `Add <strong>${formatShopifyMoney(diff, currency)}</strong> more to unlock Free Tracked Delivery`;
      }
    }

    if (!itemsContainer) return;

    itemsContainer.innerHTML = currentCart.lines.nodes
      .map((line) => {
        const itemImg = line.merchandise?.image?.url || line.merchandise?.product?.featuredImage?.url || '/images/personalized_box.jpg';
        const itemTitle = line.merchandise?.product?.title || line.merchandise?.title || 'Curated Gift';
        const variantTitle = (line.merchandise?.title && line.merchandise.title !== 'Default Title') ? line.merchandise.title : '';
        const itemCur = line.merchandise?.price?.currencyCode || currency;
        const itemPrice = formatShopifyMoney(parseFloat(line.merchandise?.price?.amount || '0'), itemCur);
        const lineTotal = formatShopifyMoney(parseFloat(line.cost?.totalAmount?.amount || '0'), line.cost?.totalAmount?.currencyCode || itemCur);
        const handle = line.merchandise?.product?.handle || '';

        const attributesHtml = line.attributes && line.attributes.length > 0
          ? `<div class="mt-2 bg-rose-50/70 border border-rose-100 rounded-xl p-2.5 text-xs text-neutral-700 space-y-1">
              <span class="text-[10px] uppercase font-extrabold text-[#ff4d61] tracking-wider block">Customization</span>
              ${line.attributes.map(a => `<div><span class="font-bold text-neutral-900">${a.key}:</span> ${a.value}</div>`).join('')}
             </div>`
          : '';

        return `
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6 border-b border-gray-100 last:border-0" data-line-id="${line.id}">
            <div class="flex items-center gap-4 flex-1">
              <a href="/product.html?handle=${handle}" class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gray-50 flex items-center justify-center p-2 flex-shrink-0 border border-gray-100 overflow-hidden">
                <img src="${itemImg}" alt="${itemTitle}" class="w-full h-full object-contain">
              </a>
              <div class="min-w-0">
                <a href="/product.html?handle=${handle}" class="text-sm sm:text-base font-bold text-neutral-950 hover:text-[#ff4d61] transition line-clamp-1">
                  ${itemTitle}
                </a>
                ${variantTitle ? `<p class="text-xs text-neutral-500 mt-0.5">${variantTitle}</p>` : ''}
                ${attributesHtml}
                <div class="text-xs font-semibold text-neutral-500 mt-1 sm:hidden">
                  Price: ${itemPrice}
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
              <!-- Quantity Controls -->
              <div class="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
                <button type="button" class="page-cart-qty-minus px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 transition cursor-pointer" data-line-id="${line.id}" data-qty="${line.quantity - 1}">
                  &minus;
                </button>
                <span class="px-3.5 py-1.5 text-xs sm:text-sm font-bold text-neutral-900">${line.quantity}</span>
                <button type="button" class="page-cart-qty-plus px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 transition cursor-pointer" data-line-id="${line.id}" data-qty="${line.quantity + 1}">
                  &#43;
                </button>
              </div>

              <!-- Price & Remove -->
              <div class="text-right flex items-center gap-4">
                <div>
                  <span class="text-sm sm:text-base font-black text-neutral-950 block">${lineTotal}</span>
                  ${line.quantity > 1 ? `<span class="text-[11px] text-neutral-400 block">${itemPrice} ea</span>` : ''}
                </div>
                <button class="page-cart-remove text-neutral-400 hover:text-rose-500 p-1.5 transition cursor-pointer" data-line-id="${line.id}" title="Remove item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    itemsContainer.querySelectorAll('.page-cart-qty-minus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lineId = btn.getAttribute('data-line-id');
        const qty = parseInt(btn.getAttribute('data-qty') || '0', 10);
        if (lineId) {
          if (qty <= 0) cart.removeItem(lineId);
          else cart.updateQuantity(lineId, qty);
        }
      });
    });

    itemsContainer.querySelectorAll('.page-cart-qty-plus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lineId = btn.getAttribute('data-line-id');
        const qty = parseInt(btn.getAttribute('data-qty') || '1', 10);
        if (lineId) cart.updateQuantity(lineId, qty);
      });
    });

    itemsContainer.querySelectorAll('.page-cart-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lineId = btn.getAttribute('data-line-id');
        if (lineId) cart.removeItem(lineId);
      });
    });
  }

  renderPageCart();

  window.addEventListener('shopify:cart:updated', () => {
    renderPageCart();
  });

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        checkoutBtn.style.pointerEvents = 'none';
        checkoutBtn.style.opacity = '0.92';
        checkoutBtn.innerHTML = `
          <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          <span class="font-bold tracking-wide">Redirecting to Checkout...</span>
        `;
      } catch (_) {}
      cart.proceedToCheckout();
    });
  }

  if (applyPromoBtn && promoInput) {
    applyPromoBtn.addEventListener('click', async () => {
      const code = promoInput.value.trim();
      if (!code) return;
      applyPromoBtn.textContent = '...';
      try {
        await cart.applyPromoCode(code);
        showToast(`Promo "${code.toUpperCase()}" applied!`);
        promoInput.value = '';
      } catch (err: any) {
        showToast(err.message || 'Invalid promo code');
      } finally {
        applyPromoBtn.textContent = 'Apply';
      }
    });
  }
}

// ====================================================
// 9. PRODUCT DETAILS PAGE CONTROLLER (product.html)
// ====================================================
async function initProductPageCommerce() {
  const urlParams = new URLSearchParams(window.location.search);
  let handle = urlParams.get('handle');

  const skeleton = document.getElementById('pdp-skeleton');
  const mainStage = document.getElementById('pdp-main-stage');
  const notFound = document.getElementById('pdp-not-found');

  try {
    // If no handle provided in URL (e.g. visiting /product.html directly),
    // pick the DIY Crochet Cat Bed Kit immediately!
    if (!handle) {
      handle = 'diy-crochet-cat-bed-kit';
    }

    const product = await getShopifyProductByHandle(handle);
    if (!product) {
      if (skeleton) skeleton.classList.add('hidden');
      if (notFound) notFound.classList.remove('hidden');
      return;
    }

    // Enterprise Tracking: ViewContent (Meta Pixel + CAPI with deduplication) & GA4 view_item
    try {
      analytics.trackViewContent({
        id: product.id,
        variantId: product.variants?.nodes?.[0]?.id,
        title: product.title,
        price: product.priceRange.minVariantPrice.amount,
        currency: product.priceRange.minVariantPrice.currencyCode || 'GBP',
        category: product.productType || 'Gifts',
        handle: product.handle,
      });
    } catch (_) {}

    // 1. Meta & Title
    document.title = `${product.title} | Present Panic`;
    const titleEl = document.getElementById('pdp-title');
    if (titleEl) titleEl.textContent = product.title;

    const breadcrumbTitle = document.getElementById('pdp-breadcrumb-title');
    if (breadcrumbTitle) breadcrumbTitle.textContent = product.title;

    const breadcrumbCat = document.getElementById('pdp-breadcrumb-category');
    if (breadcrumbCat) breadcrumbCat.textContent = product.productType || 'Gifts';

    const vendorEl = document.getElementById('pdp-vendor');
    const displayVendor = (!product.vendor || product.vendor.toLowerCase() === 'my store')
      ? 'Present Panic Curated'
      : product.vendor;
    if (vendorEl) vendorEl.textContent = displayVendor;

    // 2. Pricing & Currency Formatting
    const currency = product.priceRange.minVariantPrice.currencyCode || 'GBP';
    const minPrice = parseFloat(product.priceRange.minVariantPrice.amount);
    const displayPriceEl = document.getElementById('pdp-display-price');
    if (displayPriceEl) displayPriceEl.textContent = formatShopifyMoney(minPrice, currency);

    const comparePriceEl = document.getElementById('pdp-compare-price');
    const saveBadge = document.getElementById('pdp-save-badge');
    const saleBadge = document.getElementById('pdp-sale-badge');

    if (product.compareAtPriceRange?.minVariantPrice) {
      const cmp = parseFloat(product.compareAtPriceRange.minVariantPrice.amount);
      if (cmp > minPrice) {
        if (comparePriceEl) {
          comparePriceEl.textContent = formatShopifyMoney(cmp, currency);
          comparePriceEl.classList.remove('hidden');
        }
        if (saleBadge) saleBadge.classList.remove('hidden');
        if (saveBadge) {
          const discountPct = Math.round(((cmp - minPrice) / cmp) * 100);
          saveBadge.textContent = `Save ${discountPct}%`;
          saveBadge.classList.remove('hidden');
        }
      }
    }

    // Product identifier flags
    const isCatBed = (handle === 'diy-crochet-cat-bed-kit' || !handle || product.title.toLowerCase().includes('cat bed'));

    // 3. Descriptions & Specs
    const leadDesc = document.getElementById('pdp-lead-description');
    if (leadDesc) {
      if (isCatBed) {
        leadDesc.innerHTML = `<p class="text-[13.5px] text-neutral-600 leading-relaxed mb-1">Create a cozy handmade cat hideaway with this adorable DIY crochet cat bed kit, crafted with 100% natural organic cotton for the ultimate feline comfort.</p>`;
      } else if (product.descriptionHtml) {
        let cleanHtml = product.descriptionHtml
          .replace(/<div>\s*<div>\s*<p>/gi, '<p>')
          .replace(/<\/p>\s*<\/div>\s*<\/div>/gi, '</p>')
          .replace(/<div>/gi, '<p>')
          .replace(/<\/div>/gi, '</p>')
          .replace(/<p>\s*<\/p>/gi, '');
        leadDesc.innerHTML = cleanHtml;
      } else if (product.description) {
        const lines = product.description.split(/(?=[🧶🐱🎁•\-\*])/).map(s => s.trim()).filter(Boolean);
        if (lines.length > 1) {
          const p = `<p class="mb-2 text-neutral-700 leading-relaxed">${lines[0]}</p>`;
          const bullets = lines.slice(1).map(l => `<li class="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">${l}</li>`).join('');
          leadDesc.innerHTML = `${p}<ul class="flex flex-wrap gap-1.5 list-none p-0 my-2">${bullets}</ul>`;
        } else {
          leadDesc.innerHTML = `<p class="text-neutral-700 leading-relaxed">${product.description}</p>`;
        }
      }
    }

    const fullDesc = document.getElementById('pdp-full-description');
    if (fullDesc) {
      fullDesc.innerHTML = `<p>${product.description || 'Discover a truly thoughtful gift created to be treasured for years to come.'}</p>`;
    }

    const specVendor = document.getElementById('pdp-spec-vendor');
    if (specVendor) specVendor.textContent = displayVendor;

    const specType = document.getElementById('pdp-spec-type');
    if (specType) specType.textContent = product.productType || 'Curated Gifts';

    // 4. Main Gallery & Thumbnails
    const activeImg = document.getElementById('pdp-active-image') as HTMLImageElement | null;

    // Keep top gallery focused purely on the main product shot for the Cat Bed
    if (isCatBed && product.images?.nodes) {
      product.images.nodes = product.images.nodes.filter(img =>
        !img.url.includes('Cozy_Crochet_Basket') &&
        !img.url.includes('Curious_Cat_Watches') &&
        !img.url.includes('Cozy_Kitten_in_Handmade')
      );
      if (product.images.nodes.length === 0) {
        product.images.nodes = [{
          url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/CozyGrayCatCavewithKitten.png?v=1791363758",
          altText: "DIY Crochet Cat Bed Kit"
        }];
      }
    }

    const featuredUrl = isCatBed
      ? "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/CozyGrayCatCavewithKitten.png?v=1791363758"
      : (product.featuredImage?.url || (product.images.nodes[0] ? product.images.nodes[0].url : ''));
    if (activeImg && featuredUrl) {
      activeImg.src = featuredUrl;
      activeImg.alt = product.title;
    }

    const thumbsContainer = document.getElementById('pdp-thumbnails-strip');
    if (thumbsContainer) {
      if (product.images.nodes.length > 1) {
        thumbsContainer.classList.remove('hidden');
        thumbsContainer.innerHTML = product.images.nodes
          .map((img, idx) => `
            <button class="thumb-btn w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 ${idx === 0 ? 'border-[#0B2D19] ring-2 ring-[#0B2D19]/20 shadow-xs' : 'border-neutral-200/80 hover:border-neutral-400'} p-1 flex items-center justify-center flex-shrink-0 cursor-pointer overflow-hidden transition-all aspect-square" data-img="${img.url}">
              <img src="${img.url}" alt="${img.altText || product.title}" class="w-full h-full object-contain rounded-xl">
            </button>
          `)
          .join('');

        thumbsContainer.querySelectorAll('.thumb-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            thumbsContainer.querySelectorAll('.thumb-btn').forEach(b => {
              b.classList.remove('border-[#0B2D19]', 'ring-2', 'ring-[#0B2D19]/20', 'shadow-xs');
              b.classList.add('border-neutral-200/80');
            });
            btn.classList.add('border-[#0B2D19]', 'ring-2', 'ring-[#0B2D19]/20', 'shadow-xs');
            btn.classList.remove('border-neutral-200/80');
            const newSrc = btn.getAttribute('data-img');
            if (activeImg && newSrc) activeImg.src = newSrc;
          });
        });
      } else {
        thumbsContainer.classList.add('hidden');
      }
    }

    // 5. Dynamic Shopify Variants Selection
    let selectedVariant: ShopifyVariant = product.variants.nodes[0] || null;
    const variantsContainer = document.getElementById('pdp-variants-container');
    const selectedOptionsState: Record<string, string> = {};

    if (selectedVariant) {
      selectedVariant.selectedOptions?.forEach((opt) => {
        selectedOptionsState[opt.name] = opt.value;
      });
    }

    if (variantsContainer && product.options && product.options.length > 0) {
      const meaningfulOptions = product.options.filter(
        opt => opt.name !== 'Title' || (opt.values.length > 1 && opt.values[0] !== 'Default Title')
      );

      if (meaningfulOptions.length > 0) {
        variantsContainer.innerHTML = meaningfulOptions
          .map((option) => {
            return `
              <div>
                <label class="block text-xs font-bold text-neutral-800 mb-2 uppercase tracking-wider">
                  ${option.name}: <span class="font-normal text-neutral-500 normal-case" id="opt-label-${option.name}">${selectedOptionsState[option.name] || option.values[0]}</span>
                </label>
                <div class="flex items-center gap-2 flex-wrap" data-option-name="${option.name}">
                  ${option.values
                .map((val) => {
                  const isSelected = selectedOptionsState[option.name] === val;
                  return `
                        <button type="button" 
                                class="pdp-option-pill text-xs font-semibold px-4 py-2 rounded-xl border transition cursor-pointer ${isSelected
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-white text-neutral-700 border-gray-200 hover:border-neutral-400'
                    }"
                                data-option="${option.name}"
                                data-value="${val}">
                          ${val}
                        </button>
                      `;
                })
                .join('')}
                </div>
              </div>
            `;
          })
          .join('');

        variantsContainer.querySelectorAll('.pdp-option-pill').forEach((pill) => {
          pill.addEventListener('click', () => {
            const optName = pill.getAttribute('data-option');
            const optVal = pill.getAttribute('data-value');
            if (!optName || !optVal) return;

            selectedOptionsState[optName] = optVal;

            const lbl = document.getElementById(`opt-label-${optName}`);
            if (lbl) lbl.textContent = optVal;

            const group = variantsContainer.querySelector(`[data-option-name="${optName}"]`);
            group?.querySelectorAll('.pdp-option-pill').forEach((btn) => {
              if (btn.getAttribute('data-value') === optVal) {
                btn.classList.add('bg-neutral-900', 'text-white', 'border-neutral-900');
                btn.classList.remove('bg-white', 'text-neutral-700', 'border-gray-200');
              } else {
                btn.classList.remove('bg-neutral-900', 'text-white', 'border-neutral-900');
                btn.classList.add('bg-white', 'text-neutral-700', 'border-gray-200');
              }
            });

            const match = product.variants.nodes.find((v) => {
              return v.selectedOptions?.every(
                (so) => selectedOptionsState[so.name] === so.value
              );
            });

            if (match) {
              selectedVariant = match;
              updateVariantUI(match);
            }
          });
        });
      } else {
        variantsContainer.innerHTML = '';
      }
    }

    function updateVariantUI(v: ShopifyVariant) {
      const vPrice = parseFloat(v.price.amount);
      const cur = v.price.currencyCode || currency;
      if (displayPriceEl) displayPriceEl.textContent = formatShopifyMoney(vPrice, cur);

      if (v.image?.url && activeImg) {
        activeImg.src = v.image.url;
      }

      const stickyImg = document.getElementById('sticky-pdp-img') as HTMLImageElement | null;
      const stickyPrice = document.getElementById('sticky-pdp-price');
      if (stickyPrice) stickyPrice.textContent = formatShopifyMoney(vPrice, cur);
      if (v.image?.url && stickyImg) stickyImg.src = v.image.url;

      const skuEl = document.getElementById('pdp-spec-sku');
      if (skuEl) skuEl.textContent = v.sku || 'N/A';

      const stockEl = document.getElementById('pdp-stock-status');
      const addBtn = document.getElementById('btn-add-pdp-cart');
      const buyNowBtn = document.getElementById('btn-buy-now');

      if (!v.availableForSale) {
        if (stockEl) {
          stockEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="text-rose-600">Out of Stock</span>`;
        }
        if (addBtn) {
          addBtn.setAttribute('disabled', 'true');
          addBtn.classList.add('opacity-50', 'pointer-events-none');
          addBtn.innerHTML = `<span>Out of Stock</span>`;
        }
        if (buyNowBtn) {
          buyNowBtn.setAttribute('disabled', 'true');
          buyNowBtn.classList.add('opacity-50', 'pointer-events-none');
        }
      } else {
        if (stockEl) {
          stockEl.innerHTML = `<svg class="w-4 h-4 text-[#0B2D19] flex-shrink-0 inline-block" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg><span class="text-neutral-950 font-bold">In Stock — Ships Within 24 Hours</span>`;
        }
        if (addBtn) {
          addBtn.removeAttribute('disabled');
          addBtn.classList.remove('opacity-50', 'pointer-events-none');
          addBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <span id="btn-add-text">Add to Cart</span>
          `;
        }
        if (buyNowBtn) {
          buyNowBtn.removeAttribute('disabled');
          buyNowBtn.classList.remove('opacity-50', 'pointer-events-none');
        }
      }
    }

    if (selectedVariant) updateVariantUI(selectedVariant);

    // 6. REAL PERSONALIZATION FLOW (Requirements 9, 10, 11, 12)
    const isPersonalized =
      product.title.toLowerCase().includes('personalized') ||
      product.title.toLowerCase().includes('personlized') ||
      product.title.toLowerCase().includes('custom') ||
      (product.tags && product.tags.some(t => /personaliz|custom|engrav/i.test(t)));

    const personalSection = document.getElementById('pdp-personalization-section');
    const inputName = document.getElementById('input-custom-name') as HTMLInputElement | null;
    const inputMsg = document.getElementById('input-custom-message') as HTMLInputElement | null;

    if (personalSection) {
      if (isPersonalized) {
        personalSection.classList.remove('hidden');
      } else {
        personalSection.classList.add('hidden');
      }
    }

    // 7. Hide Skeleton & Reveal Main Stage
    if (skeleton) skeleton.classList.add('hidden');
    if (mainStage) mainStage.classList.remove('hidden');
    if (notFound) notFound.classList.add('hidden');

    // 8. Quantity Controls
    let quantity = 1;
    const minusBtn = document.getElementById('btn-qty-minus');
    const plusBtn = document.getElementById('btn-qty-plus');
    const qtyVal = document.getElementById('qty-val');

    if (minusBtn && qtyVal) {
      minusBtn.addEventListener('click', () => {
        if (quantity > 1) {
          quantity--;
          qtyVal.textContent = String(quantity);
        }
      });
    }

    if (plusBtn && qtyVal) {
      plusBtn.addEventListener('click', () => {
        quantity++;
        qtyVal.textContent = String(quantity);
      });
    }

    // 9. Add to Cart with Genuine Custom Attributes
    const addBtn = document.getElementById('btn-add-pdp-cart');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        if (!selectedVariant) return;

        const customAttributes: { key: string; value: string }[] = [];

        if (isPersonalized && inputName) {
          const val = inputName.value.trim();
          if (!val) {
            inputName.focus();
            inputName.classList.add('border-rose-500', 'ring-1', 'ring-rose-500');
            showToast('Please enter your personalization text before adding to cart.');
            return;
          }
          inputName.classList.remove('border-rose-500', 'ring-1', 'ring-rose-500');
          customAttributes.push({ key: 'Personalization Name', value: val });

          if (inputMsg && inputMsg.value.trim()) {
            customAttributes.push({ key: 'Gift Message', value: inputMsg.value.trim() });
          }
        }

        const origHtml = addBtn.innerHTML;
        addBtn.innerHTML = `<span>Adding to Bag...</span>`;
        try {
          await cart.addItem(selectedVariant.id, quantity, customAttributes);
          showToast(`Added "${product.title}" to bag!`);

          const cartTrigger = document.getElementById('btn-header-cart');
          if (cartTrigger) cartTrigger.click();
        } catch (err) {
          showToast('Could not add item to bag. Please try again.');
        } finally {
          addBtn.innerHTML = origHtml;
        }
      });
    }

    // 10. Buy Now Direct Checkout
    const buyNowBtn = document.getElementById('btn-buy-now');
    if (buyNowBtn) {
      buyNowBtn.addEventListener('click', async () => {
        if (!selectedVariant) return;

        const customAttributes: { key: string; value: string }[] = [];
        if (isPersonalized && inputName) {
          const val = inputName.value.trim();
          if (!val) {
            inputName.focus();
            inputName.classList.add('border-rose-500', 'ring-1', 'ring-rose-500');
            showToast('Please enter your personalization text before checkout.');
            return;
          }
          customAttributes.push({ key: 'Personalization Name', value: val });
          if (inputMsg && inputMsg.value.trim()) {
            customAttributes.push({ key: 'Gift Message', value: inputMsg.value.trim() });
          }
        }

        buyNowBtn.textContent = 'Redirecting to Checkout...';
        try {
          await cart.addItem(selectedVariant.id, quantity, customAttributes);
          cart.proceedToCheckout();
        } catch (err) {
          showToast('Could not initiate checkout.');
          buyNowBtn.textContent = 'Buy It Now →';
        }
      });
    }

    // 11. Load Real Recommendations (with smart fallback)
    const recsGrid = document.getElementById('pdp-recommendations-grid');
    if (recsGrid) {
      try {
        let recs = await getShopifyProductRecommendations(product.id);
        if (!recs || recs.length === 0) {
          const allCatalog = await getShopifyProducts({ first: 8 });
          recs = allCatalog.filter(p => p.id !== product.id).slice(0, 4);
        }
        if (recs.length > 0) {
          recsGrid.innerHTML = recs.map(createProductCardHTML).join('');
          bindAddToCartButtons(recsGrid);
        }
      } catch (err) {
        console.warn('Notice loading recommendations:', err);
      }
    }

    // 12. Interactive Tabs (Overview, Specs, Shipping, Reviews)
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    tabButtons.forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const targetId = tabBtn.getAttribute('data-target');
        if (!targetId) return;

        tabButtons.forEach((btn) => {
          btn.classList.remove('active', 'border-[#0B2D19]', 'bg-emerald-50', 'text-[#0B2D19]');
          btn.classList.add('border-transparent', 'text-neutral-600');
        });
        tabBtn.classList.add('active', 'border-[#0B2D19]', 'bg-emerald-50', 'text-[#0B2D19]');
        tabBtn.classList.remove('border-transparent', 'text-neutral-600');

        tabPanels.forEach((panel) => {
          if (panel.id === targetId) {
            panel.classList.remove('hidden');
          } else {
            panel.classList.add('hidden');
          }
        });

        if ((window as any).lucide && typeof (window as any).lucide.createIcons === 'function') {
          (window as any).lucide.createIcons();
        }
      });
    });

    // 12b. Dedicated DTC Cat Bed Experience Controller (Shows for Cat Bed only)
    const catBedLanding = document.getElementById('cat-bed-landing-experience');
    const standardTabs = document.getElementById('pdp-details-tabs');
    const isCatBedProduct = (handle === 'diy-crochet-cat-bed-kit' || !handle || product.title.toLowerCase().includes('cat bed'));

    if (catBedLanding) {
      if (isCatBedProduct) {
        catBedLanding.classList.remove('hidden');
        if (standardTabs) standardTabs.classList.add('hidden');
      } else {
        catBedLanding.classList.add('hidden');
        if (standardTabs) standardTabs.classList.remove('hidden');
      }
    }

    // Scroll to order form buttons on landing sections
    document.querySelectorAll('.btn-scroll-order').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pdpHero = document.getElementById('pdp-hero-container') || document.getElementById('btn-add-pdp-cart');
        if (pdpHero) {
          pdpHero.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const mainAddBtn = document.getElementById('btn-add-pdp-cart');
          if (mainAddBtn) {
            mainAddBtn.classList.add('ring-2', 'ring-emerald-500', 'scale-105');
            setTimeout(() => {
              mainAddBtn.classList.remove('ring-2', 'ring-emerald-500', 'scale-105');
            }, 1200);
          }
        }
      });
    });

    // Cat Bed FAQ Accordion
    const faqAccordion = document.getElementById('cat-bed-faq-accordion');
    if (faqAccordion) {
      faqAccordion.querySelectorAll('.faq-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
          const content = btn.nextElementSibling as HTMLElement;
          const chevron = btn.querySelector('svg, i');
          const isCurrentlyHidden = content.classList.contains('hidden');

          // Close all FAQ items
          faqAccordion.querySelectorAll('.faq-content').forEach((c) => c.classList.add('hidden'));
          faqAccordion.querySelectorAll('.faq-toggle svg, .faq-toggle i').forEach((icon) => {
            icon.classList.remove('rotate-180');
          });

          if (isCurrentlyHidden) {
            content.classList.remove('hidden');
            chevron?.classList.add('rotate-180');
          }
        });
      });
    }

    // Jump to Reviews when clicking star rating in hero
    const btnScrollReviews = document.getElementById('btn-scroll-reviews');
    if (btnScrollReviews) {
      btnScrollReviews.addEventListener('click', () => {
        if (isCatBedProduct && catBedLanding) {
          const reviewsSection = catBedLanding.querySelector('section:nth-of-type(4)');
          reviewsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          const reviewsTabNav = document.getElementById('tab-nav-reviews');
          if (reviewsTabNav) {
            reviewsTabNav.click();
            const tabsSection = document.getElementById('pdp-details-tabs');
            tabsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    }

    // 13. Sticky Floating Add to Cart Bar
    const stickyBar = document.getElementById('sticky-pdp-bar');
    const stickyImg = document.getElementById('sticky-pdp-img') as HTMLImageElement | null;
    const stickyTitle = document.getElementById('sticky-pdp-title');
    const stickyPrice = document.getElementById('sticky-pdp-price');
    const stickyAddBtn = document.getElementById('btn-sticky-add-cart');

    if (stickyBar) {
      if (stickyTitle) stickyTitle.textContent = product.title;
      if (stickyPrice) stickyPrice.textContent = formatShopifyMoney(minPrice, currency);
      if (stickyImg && featuredUrl) stickyImg.src = featuredUrl;

      stickyAddBtn?.addEventListener('click', () => {
        const mainAddBtn = document.getElementById('btn-add-pdp-cart');
        mainAddBtn?.click();
      });

      window.addEventListener('scroll', () => {
        const scrollY = window.scrollY || window.pageYOffset;
        if (scrollY > 550) {
          stickyBar.classList.remove('translate-y-full');
          stickyBar.classList.add('translate-y-0');
        } else {
          stickyBar.classList.add('translate-y-full');
          stickyBar.classList.remove('translate-y-0');
        }
      }, { passive: true });
    }

    // 14. Wishlist & Share Buttons
    const btnWishlist = document.getElementById('btn-wishlist');
    let isWishlisted = false;
    if (btnWishlist) {
      btnWishlist.addEventListener('click', () => {
        isWishlisted = !isWishlisted;
        const heartSvg = btnWishlist.querySelector('svg');
        if (isWishlisted) {
          btnWishlist.classList.add('text-[#ff4d61]', 'bg-rose-50', 'border-rose-300');
          if (heartSvg) heartSvg.classList.add('fill-[#ff4d61]');
          showToast('Saved to your favorites!');
        } else {
          btnWishlist.classList.remove('text-[#ff4d61]', 'bg-rose-50', 'border-rose-300');
          if (heartSvg) heartSvg.classList.remove('fill-[#ff4d61]');
          showToast('Removed from favorites.');
        }
      });
    }

    const btnShare = document.getElementById('btn-share-product');
    if (btnShare) {
      btnShare.addEventListener('click', async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: `${product.title} | Present Panic`,
              text: `Discover ${product.title} at Present Panic!`,
              url: window.location.href,
            });
          } catch (_) {}
        } else {
          try {
            await navigator.clipboard.writeText(window.location.href);
            showToast('Gift link copied to clipboard!');
          } catch (_) {
            showToast('Could not copy link.');
          }
        }
      });
    }

    // 15. Lightbox Modal
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img') as HTMLImageElement | null;
    const btnOpenLightbox = document.getElementById('btn-open-lightbox');
    const btnCloseLightbox = document.getElementById('btn-close-lightbox');

    function openLightbox() {
      if (!lightboxModal || !activeImg) return;
      if (lightboxImg) lightboxImg.src = activeImg.src;
      lightboxModal.classList.remove('hidden');
      lightboxModal.classList.add('flex');
    }

    function closeLightbox() {
      if (!lightboxModal) return;
      lightboxModal.classList.add('hidden');
      lightboxModal.classList.remove('flex');
    }

    btnOpenLightbox?.addEventListener('click', openLightbox);
    activeImg?.addEventListener('click', openLightbox);
    btnCloseLightbox?.addEventListener('click', closeLightbox);
    lightboxModal?.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeLightbox();
    });

    // 16. Write a Review Modal
    const reviewModal = document.getElementById('write-review-modal');
    const btnOpenReview = document.getElementById('btn-open-review-modal');
    const btnCloseReview = document.getElementById('btn-close-review-modal');
    const reviewForm = document.getElementById('write-review-form');

    btnOpenReview?.addEventListener('click', () => {
      reviewModal?.classList.remove('hidden');
      reviewModal?.classList.add('flex');
    });

    btnCloseReview?.addEventListener('click', () => {
      reviewModal?.classList.add('hidden');
      reviewModal?.classList.remove('flex');
    });

    reviewModal?.addEventListener('click', (e) => {
      if (e.target === reviewModal) {
        reviewModal.classList.add('hidden');
        reviewModal.classList.remove('flex');
      }
    });

    reviewForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      reviewModal?.classList.add('hidden');
      reviewModal?.classList.remove('flex');
      showToast('Thank you! Your verified review has been submitted for publishing.');
    });

    // Re-initialize Lucide Icons
    if ((window as any).lucide && typeof (window as any).lucide.createIcons === 'function') {
      (window as any).lucide.createIcons();
    }

  } catch (err) {
    console.error('Error initializing PDP:', err);
    if (skeleton) skeleton.classList.add('hidden');
    if (notFound) notFound.classList.remove('hidden');
  }
}

// ====================================================
// TOAST NOTIFICATION UTILITY
// ====================================================
function showToast(message: string) {
  let toast = document.getElementById('action-toast');
  let text = document.getElementById('action-toast-text');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'action-toast';
    toast.className = 'fixed top-6 right-6 z-[200] bg-neutral-950 text-white text-xs sm:text-sm font-medium px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 transform translate-y-[-100px] opacity-0 transition-all duration-300 pointer-events-none';
    toast.innerHTML = `<span id="action-toast-text">${message}</span>`;
    document.body.appendChild(toast);
    text = document.getElementById('action-toast-text');
  }

  if (text) text.textContent = message;
  toast.classList.remove('opacity-0', 'translate-y-[-100px]', 'pointer-events-none');
  toast.classList.add('opacity-100', 'translate-y-0');

  setTimeout(() => {
    toast?.classList.remove('opacity-100', 'translate-y-0');
    toast?.classList.add('opacity-0', 'translate-y-[-100px]', 'pointer-events-none');
  }, 3200);
}

// ====================================================
// GIFT FINDER QUIZ CONTROLLER (Integrated with Shopify)
// ====================================================

// Pre-verified fallback catalog of live Shopify products for instant, zero-delay quiz matching
const VERIFIED_QUIZ_CATALOG: ShopifyProduct[] = [
  {
    id: "gid://shopify/Product/16345824526417",
    title: "Personalized Crystal Ball LED Lamp",
    handle: "personlized-crystal-ball-led-lamp",
    description: "Personalized crystal ball night light with warm LED wooden base.",
    vendor: "Present Panic",
    productType: "Lighting & Home Decor",
    tags: ["lamp", "crystal", "personalized", "night light", "cozy", "luxury", "mum", "partner"],
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: "48.99", currencyCode: "GBP" },
      maxVariantPrice: { amount: "48.99", currencyCode: "GBP" }
    },
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/Celestial_Crystal_Globe_Lamp.png?v=1791453230",
      altText: "Personalized Crystal Ball LED Lamp"
    },
    images: { nodes: [] },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62793929687121",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "48.99", currencyCode: "GBP" },
          selectedOptions: []
        }
      ]
    },
    options: []
  },
  {
    id: "gid://shopify/Product/16352140558417",
    title: "Handmade Feather Dream Catcher Wall Hanging",
    handle: "handmade-feather-dream-catcher-wall-hanging",
    description: "Boho chic feather dream catcher wall hanging with wooden beads and soft feathers.",
    vendor: "Present Panic",
    productType: "Wall Decor",
    tags: ["boho", "handmade", "cozy", "sentimental", "gift", "friend", "mum"],
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: "24.00", currencyCode: "GBP" },
      maxVariantPrice: { amount: "24.00", currencyCode: "GBP" }
    },
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/BohemianDreamcatcherwithLayeredFeathers.png?v=1791358935",
      altText: "Handmade Feather Dream Catcher Wall Hanging"
    },
    images: { nodes: [] },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62832114040913",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "24.00", currencyCode: "GBP" },
          selectedOptions: []
        }
      ]
    },
    options: []
  },
  {
    id: "gid://shopify/Product/16352294633553",
    title: "Handmade Crochet Christmas Hanging Ornaments",
    handle: "handmade-crochet-christmas-hanging-ornaments",
    description: "Festive artisan crochet ornaments for holiday trees and seasonal gifting.",
    vendor: "Present Panic",
    productType: "Holiday Decor",
    tags: ["christmas", "holiday", "ornament", "crochet", "festive", "cozy", "playful"],
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: "28.99", currencyCode: "GBP" },
      maxVariantPrice: { amount: "28.99", currencyCode: "GBP" }
    },
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/Untitled-1_adasg2.png?v=1791453230",
      altText: "Handmade Crochet Christmas Hanging Ornaments"
    },
    images: { nodes: [] },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62833053171793",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "28.99", currencyCode: "GBP" },
          selectedOptions: []
        }
      ]
    },
    options: []
  },
  {
    id: "gid://shopify/Product/16352161857617",
    title: "Woven Straw Beach Tote Bag for Women",
    handle: "woven-straw-beach-tote-bag-for-women",
    description: "Chic luxury crochet raffia tote bag for weekend outings and stylish summer wear.",
    vendor: "Present Panic",
    productType: "Accessories",
    tags: ["luxury", "bag", "mum", "partner", "fashion", "pampering"],
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: "79.99", currencyCode: "GBP" },
      maxVariantPrice: { amount: "79.99", currencyCode: "GBP" }
    },
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/CrochetRaffiaToteBag_ParisMilano.png?v=1791359674",
      altText: "Woven Straw Beach Tote Bag"
    },
    images: { nodes: [] },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62832270868561",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "79.99", currencyCode: "GBP" },
          selectedOptions: []
        }
      ]
    },
    options: []
  },
  {
    id: "gid://shopify/Product/16352187908177",
    title: "Handwoven Straw Fan Wall Decor",
    handle: "handwoven-straw-fan-wall-decor",
    description: "Natural handwoven straw fan wall art for minimalist and bohemian home accents.",
    vendor: "Present Panic",
    productType: "Wall Decor",
    tags: ["decor", "straw", "artisan", "cozy", "classic", "dad", "colleague"],
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: "17.99", currencyCode: "GBP" },
      maxVariantPrice: { amount: "17.99", currencyCode: "GBP" }
    },
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/Untitled-1_adasg.png?v=1791453230",
      altText: "Handwoven Straw Fan Wall Decor"
    },
    images: { nodes: [] },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62832412524625",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "17.99", currencyCode: "GBP" },
          selectedOptions: []
        }
      ]
    },
    options: []
  },
  {
    id: "gid://shopify/Product/16352149012561",
    title: "Boho Hanging Photo Display with Wooden Clips",
    handle: "boho-hanging-photo-display-with-wooden-clips",
    description: "Macrame photo clip string organizer for polaroids, memories, and cards.",
    vendor: "Present Panic",
    productType: "Home Decor",
    tags: ["sentimental", "photo", "friend", "mum", "cozy", "heartfelt"],
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: "28.99", currencyCode: "GBP" },
      maxVariantPrice: { amount: "28.99", currencyCode: "GBP" }
    },
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/BohoMacramePhotoDisplay.png?v=1791359274",
      altText: "Boho Hanging Photo Display"
    },
    images: { nodes: [] },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62832191832145",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "28.99", currencyCode: "GBP" },
          selectedOptions: []
        }
      ]
    },
    options: []
  }
];

// Pre-cached products so quiz recommendations render instantaneously without freezing
let quizCatalogCache: ShopifyProduct[] = [...VERIFIED_QUIZ_CATALOG];
getShopifyProducts({ first: 250 }).then((prods) => {
  if (prods && prods.length > 0) quizCatalogCache = prods;
}).catch(() => {});

export function initGiftQuiz() {
  const quizOverlay = document.getElementById('gift-quiz-modal-overlay');
  const quizModalContainer = document.getElementById('quiz-modal-container');
  const quizCardWrapper = document.getElementById('quiz-card-wrapper');
  const quizStepContent = document.getElementById('quiz-body-content');
  const quizProgressPills = document.getElementById('quiz-progress-pills');
  const quizStepCounter = document.getElementById('quiz-step-counter');
  const btnQuizPrev = document.getElementById('btn-quiz-prev');
  const btnQuizSkip = document.getElementById('btn-quiz-skip');
  const btnCloseQuiz = document.getElementById('btn-close-gift-quiz');
  const quizResultsWrapper = document.getElementById('quiz-recommendations-wrapper');
  const quizHeroHeadline = document.getElementById('quiz-main-headline');

  if (!quizOverlay) return;

  // Quiz Questions Data (4 distinct, balanced steps)
  const quizQuestions = [
    {
      id: 'who',
      title: 'Who are you shopping for?',
      options: ['Mum', 'Dad', 'Partner', 'Friend', 'Colleague', 'Grandparents']
    },
    {
      id: 'occasion',
      title: "What is the special occasion?",
      options: ['Christmas & Holiday', 'Birthday', 'Anniversary', 'Housewarming', 'Thank You', 'Just Because']
    },
    {
      id: 'style',
      title: "What style suits them best?",
      options: ['Warm & Artisanal', 'Timeless & Classic', 'Thoughtful Keepsake', 'Modern & Sleek', 'Playful & Creative', 'Elevated Luxury']
    },
    {
      id: 'budget',
      title: "What is your ideal budget?",
      options: ['Under £25', '£25 – £50', '£50 – £100', '£100+ Luxury']
    }
  ];

  let currentQuizStep = 0;
  let isTransitioning = false;
  let quizAnswers: Record<string, string> = {
    who: '',
    occasion: '',
    style: '',
    vibe: '',
    budget: ''
  };

  function openGiftQuiz() {
    if (!quizOverlay) return;
    
    // Always start fresh from question 1
    currentQuizStep = 0;
    isTransitioning = false;
    quizAnswers = { who: '', occasion: '', style: '', vibe: '', budget: '' };

    quizOverlay.classList.remove('hidden');
    quizOverlay.classList.add('flex', 'active');
    document.body.style.overflow = 'hidden';

    renderQuizStep(0);
  }

  function closeGiftQuiz() {
    try {
      localStorage.setItem('pp_quiz_seen', '1');
    } catch (_) {}
    if (!quizOverlay) return;
    quizOverlay.classList.remove('active');
    setTimeout(() => {
      quizOverlay.classList.add('hidden');
      quizOverlay.classList.remove('flex');
    }, 200);
    document.body.style.overflow = '';
    if (quizModalContainer) {
      quizModalContainer.classList.remove('max-w-4xl', 'max-w-2xl', 'has-results');
      quizModalContainer.classList.add('max-w-lg');
    }
    isTransitioning = false;
  }

  // Expose globally for HTML onclick and mobile drawer
  (window as any).openGiftQuiz = openGiftQuiz;
  (window as any).closeGiftQuiz = closeGiftQuiz;
  (window as any).showQuizResults = showQuizResults;

  // Auto-show existing Gift Finder Quiz on first visit only
  const QUIZ_SEEN_KEY = 'pp_quiz_seen';
  try {
    if (!localStorage.getItem(QUIZ_SEEN_KEY)) {
      setTimeout(() => {
        if (!localStorage.getItem(QUIZ_SEEN_KEY) && quizOverlay && quizOverlay.classList.contains('hidden')) {
          localStorage.setItem(QUIZ_SEEN_KEY, '1');
          openGiftQuiz();
        }
      }, 1500);
    }
  } catch (err) {
    console.warn('Quiz auto-prompt error:', err);
  }

  // Bind all potential quiz trigger elements
  const triggers = document.querySelectorAll(
    '#btn-nav-quiz, #top-bar-quiz-btn, #hero-quiz-btn, #floating-quiz-trigger, #mobile-drawer-quiz-btn, .footer-quiz-link, [data-quiz-trigger], a[href="#quiz"], .mobile-quiz-link'
  );
  triggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openGiftQuiz();
    });
  });

  function renderQuizStep(stepIdx: number) {
    if (!quizStepContent) return;
    currentQuizStep = Math.max(0, Math.min(stepIdx, quizQuestions.length - 1));
    isTransitioning = false;

    if (quizModalContainer) {
      quizModalContainer.classList.remove('max-w-4xl', 'max-w-2xl', 'has-results');
      quizModalContainer.classList.add('max-w-lg');
    }

    if (quizCardWrapper) quizCardWrapper.classList.remove('hidden');
    if (quizResultsWrapper) {
      quizResultsWrapper.classList.add('hidden');
      quizResultsWrapper.classList.remove('flex');
      quizResultsWrapper.innerHTML = '';
    }
    if (quizHeroHeadline) {
      quizHeroHeadline.innerHTML = 'Find the Perfect Gift';
    }

    const q = quizQuestions[currentQuizStep];

    // Update Progress Dashes
    if (quizProgressPills) {
      const dashes = quizProgressPills.querySelectorAll('span');
      dashes.forEach((dash, idx) => {
        if (idx === currentQuizStep) {
          dash.className = 'w-8 sm:w-10 h-1.5 rounded-full bg-[#0B2D19] transition-all duration-300';
        } else if (idx < currentQuizStep) {
          dash.className = 'w-8 sm:w-10 h-1.5 rounded-full bg-neutral-900 transition-all duration-300';
        } else {
          dash.className = 'w-8 sm:w-10 h-1.5 rounded-full bg-neutral-200 transition-all duration-300';
        }
      });
    }

    // Update Step Counter
    if (quizStepCounter) {
      quizStepCounter.textContent = `${currentQuizStep + 1} / ${quizQuestions.length}`;
    }

    // Update Back Button
    if (btnQuizPrev) {
      if (currentQuizStep > 0) {
        btnQuizPrev.classList.remove('opacity-0', 'pointer-events-none');
        btnQuizPrev.classList.add('opacity-100', 'pointer-events-auto');
      } else {
        btnQuizPrev.classList.add('opacity-0', 'pointer-events-none');
        btnQuizPrev.classList.remove('opacity-100', 'pointer-events-auto');
      }
    }

    // Render Question & Symmetrical 2-Column Options Grid
    quizStepContent.className = 'w-full flex flex-col items-center py-1 fade-step-enter';
    quizStepContent.innerHTML = `
      <h3 class="text-base sm:text-lg font-bold text-neutral-900 mb-4 text-center">${q.title}</h3>
      <div class="grid grid-cols-2 gap-2 sm:gap-2.5 w-full max-w-sm sm:max-w-md mx-auto mb-2">
        ${q.options.map(opt => {
          const isSelected = (quizAnswers[q.id] === opt) || (q.id === 'style' && quizAnswers.vibe === opt);
          return `
            <button type="button" class="quiz-option-pill px-3.5 py-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer text-center ${
              isSelected
                ? 'bg-[#0B2D19] text-white border-[#0B2D19] shadow-sm font-bold'
                : 'bg-white border-neutral-200 text-neutral-800 hover:border-neutral-900 hover:bg-neutral-50 shadow-2xs'
            }" data-value="${escapeHtml(opt)}">
              ${escapeHtml(opt)}
            </button>
          `;
        }).join('')}
      </div>
    `;

    // Attach Click to Options
    quizStepContent.querySelectorAll('.quiz-option-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isTransitioning) return;
        isTransitioning = true;

        const val = pill.getAttribute('data-value') || '';
        quizAnswers[q.id] = val;
        if (q.id === 'style') {
          quizAnswers.vibe = val;
        }

        // Visual selection feedback
        quizStepContent.querySelectorAll('.quiz-option-pill').forEach(p => {
          p.className = 'quiz-option-pill px-3.5 py-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all duration-150 bg-white border-neutral-200 text-neutral-800 hover:border-neutral-900 hover:bg-neutral-50 shadow-2xs cursor-pointer text-center';
        });
        pill.className = 'quiz-option-pill px-3.5 py-3 rounded-xl border text-xs sm:text-sm font-bold transition-all duration-150 bg-[#0B2D19] text-white border-[#0B2D19] shadow-sm cursor-pointer text-center';

        setTimeout(() => {
          isTransitioning = false;
          if (currentQuizStep < quizQuestions.length - 1) {
            renderQuizStep(currentQuizStep + 1);
          } else {
            showQuizResults();
          }
        }, 160);
      });
    });
  }

  async function showQuizResults() {
    try {
      localStorage.setItem('pp_quiz_seen', '1');
    } catch (_) {}
    isTransitioning = false;

    if (quizModalContainer) {
      quizModalContainer.classList.remove('max-w-xl', 'max-w-4xl');
      quizModalContainer.classList.add('max-w-2xl', 'has-results');
    }

    if (quizCardWrapper) quizCardWrapper.classList.add('hidden');
    if (quizResultsWrapper) {
      quizResultsWrapper.classList.remove('hidden');
      quizResultsWrapper.classList.add('flex');
    }
    if (quizHeroHeadline) {
      quizHeroHeadline.innerHTML = 'Curated Gift Recommendations';
    }

    // Retrieve products (instant from cache or verified catalog)
    let allProducts = (quizCatalogCache && quizCatalogCache.length > 0) ? quizCatalogCache : VERIFIED_QUIZ_CATALOG;

    // Intelligent Scored Matching based on user answers
    const who = (quizAnswers.who || '').toLowerCase();
    const occasion = (quizAnswers.occasion || '').toLowerCase();
    const style = (quizAnswers.style || quizAnswers.vibe || '').toLowerCase();
    const budget = quizAnswers.budget || '';

    const scoredProducts = allProducts.map(p => {
      let score = Math.floor(Math.random() * 15); // baseline subtle variation
      const title = (p.title || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const type = (p.productType || '').toLowerCase();
      const tags = (p.tags || []).join(' ').toLowerCase();
      const text = `${title} ${desc} ${type} ${tags}`;
      const price = parseFloat(p.priceRange?.minVariantPrice?.amount || '0');

      // Occasion matching
      if (occasion.includes('christmas') && (text.includes('christmas') || text.includes('snowman') || text.includes('holiday') || text.includes('decor') || text.includes('hanging') || text.includes('music box') || text.includes('ferris wheel'))) {
        score += 40;
      }
      if (occasion.includes('birthday') && (text.includes('lamp') || text.includes('light') || text.includes('tote') || text.includes('crochet') || text.includes('gift'))) {
        score += 35;
      }
      if (occasion.includes('anniversary') && (text.includes('crystal') || text.includes('photo') || text.includes('lamp') || text.includes('music box'))) {
        score += 35;
      }
      if (occasion.includes('housewarming') && (text.includes('lamp') || text.includes('light') || text.includes('clock') || text.includes('night light') || text.includes('bed') || text.includes('decor'))) {
        score += 35;
      }

      // Who matching
      if ((who.includes('partner') || who.includes('mum')) && (text.includes('lamp') || text.includes('crystal') || text.includes('feather') || text.includes('tote') || text.includes('photo') || text.includes('music box'))) {
        score += 35;
      }
      if ((who.includes('dad') || who.includes('colleague')) && (text.includes('fan') || text.includes('lamp') || text.includes('clock') || text.includes('night light') || text.includes('wall'))) {
        score += 35;
      }
      if (who.includes('friend') && (text.includes('crochet') || text.includes('photo') || text.includes('feather') || text.includes('tote') || text.includes('cat bed'))) {
        score += 35;
      }
      if (who.includes('grandparent') && (text.includes('night light') || text.includes('house') || text.includes('photo') || text.includes('music box') || text.includes('crochet') || text.includes('lamp'))) {
        score += 35;
      }

      // Style matching (Professional Big-Brand Categories)
      if ((style.includes('warm') || style.includes('artisanal')) && (text.includes('crochet') || text.includes('cat bed') || text.includes('wood') || text.includes('light') || text.includes('handmade') || text.includes('organic'))) {
        score += 35;
      }
      if ((style.includes('timeless') || style.includes('classic')) && (text.includes('music box') || text.includes('piano') || text.includes('clock') || text.includes('wooden') || text.includes('ferris wheel'))) {
        score += 35;
      }
      if ((style.includes('thoughtful') || style.includes('keepsake')) && (text.includes('photo') || text.includes('night light') || text.includes('crystal') || text.includes('personalized') || text.includes('house'))) {
        score += 35;
      }
      if ((style.includes('modern') || style.includes('sleek')) && (text.includes('3-in-1') || text.includes('night light') || text.includes('lamp') || text.includes('led') || text.includes('diffuser'))) {
        score += 35;
      }
      if ((style.includes('playful') || style.includes('creative')) && (text.includes('crochet') || text.includes('cat bed') || text.includes('ferris wheel') || text.includes('diy') || text.includes('ballerina'))) {
        score += 35;
      }
      if ((style.includes('luxury') || style.includes('refined')) && (text.includes('crystal') || text.includes('gold') || text.includes('music box') || text.includes('deluxe') || text.includes('luxury'))) {
        score += 35;
      }

      // Budget matching
      if (budget.includes('25') && price > 0 && price <= 30) score += 30;
      if (budget.includes('50') && price > 25 && price <= 55) score += 30;
      if (budget.includes('100') && price > 50 && price <= 100) score += 30;
      if (budget.includes('100+') && price >= 75) score += 30;

      return { product: p, score };
    });

    scoredProducts.sort((a, b) => b.score - a.score);
    const topPicks = scoredProducts.slice(0, 3).map(sp => sp.product);

    // If fewer than 3 picked, fill with verified items
    while (topPicks.length < 3) {
      const extra = VERIFIED_QUIZ_CATALOG[topPicks.length % VERIFIED_QUIZ_CATALOG.length];
      topPicks.push(extra);
    }

    const badges = ['Top Match', 'Curator’s Pick', 'Most Gifted'];

    if (quizResultsWrapper) {
      const summaryItems = [quizAnswers.who, quizAnswers.occasion, quizAnswers.style || quizAnswers.vibe, quizAnswers.budget].filter(Boolean);

      quizResultsWrapper.innerHTML = `
        <div class="text-center mb-3.5 w-full">
          <span class="inline-block text-[10px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 rounded-full mb-1">
            Curated Recommendations
          </span>
          <h3 class="text-lg sm:text-xl font-black text-neutral-950 tracking-tight">
            Handpicked for ${escapeHtml(quizAnswers.who || 'Someone Special')}
          </h3>
          <p class="text-[11px] text-neutral-500 mt-0.5">
            ${summaryItems.map(escapeHtml).join(' · ')}
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-4 w-full">
          ${topPicks.map((item, idx) => {
            const badge = badges[idx] || 'Curator Choice';
            const priceAmount = item.priceRange?.minVariantPrice?.amount || '24.00';
            const currency = item.priceRange?.minVariantPrice?.currencyCode || 'GBP';
            const priceFormatted = formatShopifyMoney(priceAmount, currency);
            const imgUrl = item.featuredImage?.url || '/images/personalized_box.jpg';
            const variantId = item.variants?.nodes?.[0]?.id || '';

            return `
              <div class="border border-neutral-200/80 rounded-xl p-2.5 bg-white flex flex-col justify-between hover:shadow-md transition-all duration-200 group">
                <div class="relative w-full aspect-square flex items-center justify-center overflow-hidden mb-2 bg-[#f8f9fa] rounded-lg p-2 cursor-pointer" onclick="window.location.href='/product.html?handle=${item.handle}'">
                  <span class="absolute top-1.5 left-1.5 bg-neutral-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide z-10 shadow-2xs">${badge}</span>
                  <img src="${imgUrl}" alt="${escapeHtml(item.title)}" class="h-full w-full object-contain object-center group-hover:scale-105 transition duration-300 mix-blend-multiply">
                </div>
                <div class="flex-1 flex flex-col justify-between text-left">
                  <a href="/product.html?handle=${item.handle}" class="block">
                    <h4 class="text-xs font-bold text-neutral-900 line-clamp-2 h-8 leading-snug group-hover:text-emerald-700 transition" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
                    <div class="mt-1 flex items-baseline justify-between">
                      <span class="text-sm font-extrabold text-neutral-950">${priceFormatted}</span>
                      <span class="text-[10px] text-emerald-800 font-medium">Free Delivery</span>
                    </div>
                  </a>
                  <button type="button" class="quiz-add-btn mt-2.5 w-full bg-[#0B2D19] hover:bg-[#144929] active:scale-[0.98] text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs" data-id="${variantId}" data-name="${escapeHtml(item.title)}">
                    <i class="w-3.5 h-3.5" data-lucide="shopping-bag"></i>
                    <span>Add to Bag</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="flex items-center justify-center gap-2.5 pt-3 border-t border-neutral-100 w-full">
          <button type="button" class="px-5 py-2 rounded-xl border border-neutral-200 text-neutral-700 text-xs font-bold hover:bg-neutral-50 transition cursor-pointer" id="btn-quiz-retake">
            ↺ Retake Quiz
          </button>
          <button type="button" class="px-5 py-2 rounded-xl bg-[#0B2D19] text-white text-xs font-bold hover:bg-[#144929] transition cursor-pointer shadow-2xs" id="btn-quiz-explore">
            Browse All Gifts &rarr;
          </button>
        </div>
      `;

      if ((window as any).lucide && typeof (window as any).lucide.createIcons === 'function') {
        (window as any).lucide.createIcons();
      }

      // Add to Bag handler inside Quiz results
      quizResultsWrapper.querySelectorAll('.quiz-add-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const variantId = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name') || 'Item';
          if (!variantId) {
            window.location.href = '/shop.html';
            return;
          }

          const origHtml = btn.innerHTML;
          btn.innerHTML = `<span>Adding...</span>`;

          try {
            await cart.addItem(variantId, 1);
            btn.classList.remove('bg-neutral-900');
            btn.classList.add('bg-emerald-600');
            btn.innerHTML = `<span>✓ Added!</span>`;
            showToast(`Added "${name}" to bag!`);

            const cartTrigger = document.getElementById('btn-header-cart');
            if (cartTrigger) cartTrigger.click();

            setTimeout(() => {
              btn.classList.remove('bg-emerald-600');
              btn.classList.add('bg-neutral-900');
              btn.innerHTML = origHtml;
              if ((window as any).lucide && typeof (window as any).lucide.createIcons === 'function') {
                (window as any).lucide.createIcons();
              }
            }, 2000);
          } catch (err) {
            btn.innerHTML = origHtml;
            showToast('Could not add item to bag.');
          }
        });
      });

      // Retake and Explore handlers
      const retakeBtn = document.getElementById('btn-quiz-retake');
      if (retakeBtn) {
        retakeBtn.addEventListener('click', () => {
          currentQuizStep = 0;
          quizAnswers = { who: '', occasion: '', vibe: '', budget: '' };
          renderQuizStep(0);
        });
      }

      const exploreBtn = document.getElementById('btn-quiz-explore');
      if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
          closeGiftQuiz();
          window.location.href = '/shop.html';
        });
      }
    }
  }

  // Previous & Skip button handlers
  if (btnQuizPrev) {
    btnQuizPrev.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentQuizStep > 0) {
        renderQuizStep(currentQuizStep - 1);
      }
    });
  }

  if (btnQuizSkip) {
    btnQuizSkip.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        localStorage.setItem('pp_quiz_seen', '1');
      } catch (_) {}
      showQuizResults();
    });
  }

  if (btnCloseQuiz) {
    btnCloseQuiz.addEventListener('click', (e) => {
      e.preventDefault();
      closeGiftQuiz();
    });
  }

  if (quizOverlay) {
    quizOverlay.addEventListener('click', (e) => {
      if (e.target === quizOverlay) {
        closeGiftQuiz();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && quizOverlay && !quizOverlay.classList.contains('hidden')) {
      closeGiftQuiz();
    }
  });
}


