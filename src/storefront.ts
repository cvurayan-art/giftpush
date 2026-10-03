/**
 * Present Panic - Production Storefront Core Controller
 * Connects Frontend UI with Shopify Backend (Storefront API, Cart, Collections, Search)
 * 100% Guest Checkout via Shopify Checkout. Zero Compare. Zero Wishlist.
 */

import {
  getShopifyProducts,
  getShopifyProductByHandle,
  getShopifyCollections,
  getShopifyCollectionByHandle,
  searchShopifyProducts,
  getShopifyProductRecommendations,
  ShopifyProduct,
  ShopifyVariant,
} from '../lib/shopify';
import { cart } from '../lib/cart';

// Expose on window for runtime scripting
(window as any).ShopifyCommerce = {
  getProducts: getShopifyProducts,
  getProductByHandle: getShopifyProductByHandle,
  getCollections: getShopifyCollections,
  getCollectionByHandle: getShopifyCollectionByHandle,
  searchProducts: searchShopifyProducts,
  getRecommendations: getShopifyProductRecommendations,
  cart,
};

(window as any).showToast = showToast;

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Shopify Cart
  try {
    await cart.init();
  } catch (err) {
    console.warn('Cart initialization notice:', err);
  }

  // Bind Shared Global Components
  setupCartDrawer();
  setupSearchModal();
  setupMobileMenuDrawer();

  // Initialize Lucide Icons if available
  if ((window as any).lucide && typeof (window as any).lucide.createIcons === 'function') {
    (window as any).lucide.createIcons();
  }

  // 1. Homepage Controller
  if (document.getElementById('flash-deals-container') || document.getElementById('category-stories-track')) {
    initHomepageCommerce();
  }

  // 2. Shop Catalog Page Controller (shop.html)
  if (document.getElementById('shop-products-grid')) {
    initShopPageCommerce();
  }

  // 3. Collection Template Page Controller (collection.html)
  if (document.getElementById('collection-products-grid')) {
    initCollectionPageCommerce();
  }

  // 4. Cart Page Controller (cart.html)
  if (document.getElementById('cart-page-items') || document.getElementById('cart-page-content')) {
    initCartPageCommerce();
  }

  // 5. Product Details Page Controller (product.html)
  if (document.getElementById('pdp-active-image') || document.getElementById('pdp-title')) {
    initProductPageCommerce();
  }
});

// ====================================================
// SHARED PRODUCT CARD COMPONENT BUILDER
// ====================================================
function createProductCardHTML(p: ShopifyProduct): string {
  const img = p.featuredImage?.url || '/images/personalized_box.jpg';
  const price = `$${parseFloat(p.priceRange.minVariantPrice.amount).toFixed(2)}`;
  const hasCompare = Boolean(
    p.compareAtPriceRange?.minVariantPrice &&
    parseFloat(p.compareAtPriceRange.minVariantPrice.amount) > parseFloat(p.priceRange.minVariantPrice.amount)
  );
  const comparePrice = hasCompare
    ? `$${parseFloat(p.compareAtPriceRange!.minVariantPrice.amount).toFixed(2)}`
    : '';
  const defaultVariant = p.variants.nodes[0];
  const variantId = defaultVariant ? defaultVariant.id : '';

  return `
    <div class="border border-gray-100 rounded-2xl p-4 sm:p-5 bg-white flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
      <a href="/product.html?handle=${p.handle}" class="relative bg-gray-50 rounded-xl p-4 flex items-center justify-center h-48 sm:h-56 block overflow-hidden">
        ${hasCompare ? `<span class="absolute top-3 left-3 bg-[#ff4d61] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">Sale</span>` : ''}
        <img alt="${p.title}" class="h-36 sm:h-44 object-contain group-hover:scale-105 transition-transform duration-300 pointer-events-none" src="${img}" loading="lazy">
      </a>
      <div class="mt-4 flex-1 flex flex-col justify-between">
        <div>
          <a href="/product.html?handle=${p.handle}" class="text-xs sm:text-sm font-bold text-neutral-900 line-clamp-2 leading-snug hover:text-[#ff4d61] transition block">
            ${p.title}
          </a>
          <div class="mt-2 flex items-center gap-2 flex-wrap">
            <span class="text-sm sm:text-base font-extrabold text-[#ff4d61]">${price}</span>
            ${hasCompare ? `<span class="text-xs text-neutral-400 line-through">${comparePrice}</span>` : ''}
          </div>
        </div>
        <div class="mt-4">
          <button class="add-to-cart-action-btn w-full bg-neutral-900 hover:bg-[#ff4d61] text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                  data-variant-id="${variantId}"
                  data-title="${p.title}"
                  data-price="${price}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <span>Add to Cart</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindAddToCartButtons(container: HTMLElement) {
  container.querySelectorAll('.add-to-cart-action-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const variantId = btn.getAttribute('data-variant-id');
      const title = btn.getAttribute('data-title') || 'Gift';
      if (!variantId) return;

      const origText = btn.innerHTML;
      btn.innerHTML = `<span>Adding...</span>`;
      try {
        await cart.addItem(variantId, 1);
        showToast(`Added "${title}" to your cart!`);
      } catch (err) {
        showToast('Could not add item to bag. Please try again.');
      } finally {
        btn.innerHTML = origText;
      }
    });
  });
}

// ====================================================
// 1. CART DRAWER CONTROLLER
// ====================================================
function setupCartDrawer() {
  const cartTrigger = document.getElementById('btn-header-cart') || document.getElementById('btn-cart-trigger');
  const cartOverlay = document.getElementById('cart-drawer-overlay');
  const closeCartBtn = document.getElementById('btn-close-cart-drawer') || document.getElementById('btn-close-cart');
  const checkoutBtn = document.getElementById('btn-proceed-checkout') || document.getElementById('btn-checkout');
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
    checkoutBtn.addEventListener('click', () => {
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

// ====================================================
// 3. SEARCH MODAL CONTROLLER
// ====================================================
function setupSearchModal() {
  const searchTrigger = document.getElementById('btn-header-search') || document.getElementById('btn-search-trigger');
  const searchOverlay = document.getElementById('search-modal-overlay');
  const closeSearchBtn = document.getElementById('btn-close-search-modal') || document.getElementById('btn-close-search');
  const searchInput = (document.getElementById('live-search-input') ||
                       document.getElementById('search-modal-input') ||
                       document.getElementById('search-input')) as HTMLInputElement | null;
  const resultsContainer = document.getElementById('live-search-results') ||
                           document.getElementById('search-results-container');
  const clearBtn = document.getElementById('btn-clear-search');

  function openSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.remove('hidden');
    searchOverlay.classList.add('flex', 'active');
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 150);
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

  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.classList.add('hidden');
      triggerSearch('');
    });
  }

  let debounceTimer: any = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value;
      if (clearBtn) {
        if (q.trim()) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        triggerSearch(q);
      }, 250);
    });
  }

  async function triggerSearch(q: string) {
    if (!resultsContainer) return;
    if (!q.trim()) {
      resultsContainer.innerHTML = `
        <div class="text-center py-8 text-neutral-400 text-xs">
          Type to search gifts by title, category, or recipient...
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = `
      <div class="flex items-center justify-center py-8 text-neutral-500 text-xs gap-2">
        <div class="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Searching gifts...</span>
      </div>
    `;

    try {
      const products = await searchShopifyProducts(q, 8);
      if (products.length === 0) {
        resultsContainer.innerHTML = `
          <div class="text-center py-8">
            <p class="text-xs font-bold text-neutral-800">No gifts found matching "${q}"</p>
            <p class="text-[11px] text-neutral-400 mt-1">Try another search term like "Keepsake", "Candle", "Hamper", or "Sign".</p>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = products
        .map((p) => {
          const img = p.featuredImage?.url || '/images/personalized_box.jpg';
          const price = `$${parseFloat(p.priceRange.minVariantPrice.amount).toFixed(2)}`;
          return `
            <a href="/product.html?handle=${p.handle}" class="flex items-center gap-3 p-3 rounded-2xl hover:bg-neutral-50 transition border border-transparent hover:border-gray-100 group">
              <img src="${img}" alt="${p.title}" class="w-12 h-12 object-contain rounded-xl bg-gray-50 flex-shrink-0">
              <div class="flex-1 min-w-0">
                <h4 class="text-xs font-bold text-neutral-900 group-hover:text-[#ff4d61] transition line-clamp-1">${p.title}</h4>
                <p class="text-[11px] text-neutral-400">${p.productType || 'Gift Item'}</p>
              </div>
              <span class="text-xs font-black text-neutral-900">${price}</span>
            </a>
          `;
        })
        .join('');
    } catch (err) {
      resultsContainer.innerHTML = `
        <div class="text-center py-6 text-rose-500 text-xs">Search error. Please try again.</div>
      `;
    }
  }
}

// ====================================================
// 4. HOMEPAGE COMMERCE INITIALIZATION
// ====================================================
async function initHomepageCommerce() {
  try {
    const products = await getShopifyProducts({ first: 12 });
    const container = document.getElementById('flash-deals-container');
    if (container && products.length > 0) {
      container.innerHTML = products.map(createProductCardHTML).join('');
      bindAddToCartButtons(container);
    }
    bindHomepageCategoryFilters();
  } catch (err) {
    console.warn('[Homepage] Notice loading products:', err);
  }
}

function bindHomepageCategoryFilters() {
  const track = document.getElementById('category-stories-track');
  if (!track) return;

  const links = track.querySelectorAll('a');
  links.forEach((a) => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const catName = a.querySelector('span')?.textContent?.trim() || '';
      showToast(`Loading collection: ${catName}...`);

      const flashSection = document.getElementById('flash-deals');
      if (flashSection) flashSection.scrollIntoView({ behavior: 'smooth' });

      try {
        const filtered = await getShopifyProducts({ query: catName, first: 12 });
        const container = document.getElementById('flash-deals-container');
        if (container) {
          container.innerHTML = filtered.map(createProductCardHTML).join('');
          bindAddToCartButtons(container);
        }
      } catch (err) {
        console.error('Filter error:', err);
      }
    });
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
  const filterBtns = document.querySelectorAll('.shop-filter-btn');
  const resetBtn = document.getElementById('btn-reset-filters');

  let allProducts: ShopifyProduct[] = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let currentSort = 'featured';

  try {
    allProducts = await getShopifyProducts({ first: 50 });
    applyFilterAndSort();
  } catch (err) {
    console.error('Error fetching catalog:', err);
  }

  function applyFilterAndSort() {
    if (!grid) return;

    let filtered = [...allProducts];

    // 1. Filter by category
    if (currentFilter !== 'all') {
      const q = currentFilter.toLowerCase();
      filtered = filtered.filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(q);
        const typeMatch = (p.productType || '').toLowerCase().includes(q);
        const tagMatch = p.tags.some(t => t.toLowerCase().includes(q));
        return titleMatch || typeMatch || tagMatch;
      });
    }

    // 2. Filter by search input
    if (currentSearch.trim()) {
      const q = currentSearch.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        const tagMatch = p.tags.some(t => t.toLowerCase().includes(q));
        return titleMatch || descMatch || tagMatch;
      });
    }

    // 3. Sort
    if (currentSort === 'price-asc') {
      filtered.sort((a, b) => parseFloat(a.priceRange.minVariantPrice.amount) - parseFloat(b.priceRange.minVariantPrice.amount));
    } else if (currentSort === 'price-desc') {
      filtered.sort((a, b) => parseFloat(b.priceRange.minVariantPrice.amount) - parseFloat(a.priceRange.minVariantPrice.amount));
    } else if (currentSort === 'title-asc') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    }

    // 4. Update count
    if (countEl) countEl.textContent = String(filtered.length);

    // 5. Render
    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyState?.classList.remove('hidden');
    } else {
      emptyState?.classList.add('hidden');
      grid.innerHTML = filtered.map(createProductCardHTML).join('');
      bindAddToCartButtons(grid);
    }
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('active', 'bg-neutral-900', 'text-white');
        b.classList.add('bg-neutral-100', 'text-neutral-700');
      });
      btn.classList.add('active', 'bg-neutral-900', 'text-white');
      btn.classList.remove('bg-neutral-100', 'text-neutral-700');

      currentFilter = btn.getAttribute('data-filter') || 'all';
      applyFilterAndSort();
    });
  });

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
      filterBtns.forEach((b, idx) => {
        if (idx === 0) {
          b.classList.add('active', 'bg-neutral-900', 'text-white');
          b.classList.remove('bg-neutral-100', 'text-neutral-700');
        } else {
          b.classList.remove('active', 'bg-neutral-900', 'text-white');
          b.classList.add('bg-neutral-100', 'text-neutral-700');
        }
      });
      applyFilterAndSort();
    });
  }
}

// ====================================================
// 6. COLLECTION TEMPLATE CONTROLLER (collection.html)
// ====================================================
async function initCollectionPageCommerce() {
  const urlParams = new URLSearchParams(window.location.search);
  const handle = urlParams.get('handle') || 'personalized-keepsakes';

  const titleEl = document.getElementById('collection-title');
  const breadcrumbEl = document.getElementById('collection-breadcrumb-title');
  const descEl = document.getElementById('collection-description');
  const countEl = document.getElementById('collection-product-count');
  const grid = document.getElementById('collection-products-grid');
  const emptyState = document.getElementById('collection-empty-state');
  const sortSelect = document.getElementById('collection-sort-select') as HTMLSelectElement | null;
  const searchInput = document.getElementById('collection-search-input') as HTMLInputElement | null;

  try {
    const collection = await getShopifyCollectionByHandle(handle, 30);
    if (!collection) return;

    document.title = `${collection.title} | Present Panic`;
    if (titleEl) titleEl.textContent = collection.title;
    if (breadcrumbEl) breadcrumbEl.textContent = collection.title;
    if (descEl && collection.description) descEl.textContent = collection.description;

    let products = collection.products.nodes;
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

    // Sort listener
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

    // Search input listener
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
// 7. CART PAGE CONTROLLER (cart.html)
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

    const subtotalNum = parseFloat(currentCart.cost.subtotalAmount.amount);
    const subtotal = `$${subtotalNum.toFixed(2)}`;
    const total = `$${parseFloat(currentCart.cost.totalAmount.amount).toFixed(2)}`;

    if (subtotalEl) subtotalEl.textContent = subtotal;
    if (totalEl) totalEl.textContent = total;

    // Free shipping threshold ($75)
    const threshold = 75;
    const diff = Math.max(0, threshold - subtotalNum);
    const pct = Math.min(100, Math.round((subtotalNum / threshold) * 100));
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (shippingText) {
      if (diff === 0) {
        shippingText.innerHTML = `🎉 <strong>Congratulations! Free Shipping Unlocked!</strong>`;
      } else {
        shippingText.innerHTML = `Add <strong>$${diff.toFixed(2)}</strong> more to unlock Free Tracked Delivery`;
      }
    }

    if (!itemsContainer) return;

    itemsContainer.innerHTML = currentCart.lines.nodes
      .map((line) => {
        const itemImg = line.merchandise.image?.url || line.merchandise.product.featuredImage?.url || '/images/personalized_box.jpg';
        const itemTitle = line.merchandise.product.title;
        const variantTitle = line.merchandise.title !== 'Default Title' ? line.merchandise.title : '';
        const itemPrice = `$${parseFloat(line.merchandise.price.amount).toFixed(2)}`;
        const lineTotal = `$${parseFloat(line.cost.totalAmount.amount).toFixed(2)}`;
        const handle = line.merchandise.product.handle;

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

    // Attach listeners for line item controls
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

  // Initial render
  renderPageCart();

  // Listen to custom cart updates
  window.addEventListener('shopify:cart:updated', () => {
    renderPageCart();
  });

  // Checkout trigger
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      cart.proceedToCheckout();
    });
  }

  // Apply promo code on cart page
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
// 8. PRODUCT DETAILS PAGE CONTROLLER (product.html)
// ====================================================
async function initProductPageCommerce() {
  const urlParams = new URLSearchParams(window.location.search);
  const handle = urlParams.get('handle') || 'engraved-family-keepsake-box';

  try {
    const product = await getShopifyProductByHandle(handle);
    if (!product) return;

    // 1. Meta & Title
    document.title = `${product.title} | Present Panic`;
    const titleEl = document.getElementById('pdp-title');
    if (titleEl) titleEl.textContent = product.title;

    const breadcrumbTitle = document.getElementById('pdp-breadcrumb-title');
    if (breadcrumbTitle) breadcrumbTitle.textContent = product.title;

    const breadcrumbCat = document.getElementById('pdp-breadcrumb-category');
    if (breadcrumbCat) breadcrumbCat.textContent = product.productType || 'Gifts';

    const vendorEl = document.getElementById('pdp-vendor');
    if (vendorEl && product.vendor) vendorEl.textContent = product.vendor;

    // 2. Pricing & Sale Indications
    const minPrice = parseFloat(product.priceRange.minVariantPrice.amount);
    const displayPriceEl = document.getElementById('pdp-display-price');
    if (displayPriceEl) displayPriceEl.textContent = `$${minPrice.toFixed(2)}`;

    const comparePriceEl = document.getElementById('pdp-compare-price');
    const saveBadge = document.getElementById('pdp-save-badge');
    const saleBadge = document.getElementById('pdp-sale-badge');

    if (product.compareAtPriceRange?.minVariantPrice) {
      const cmp = parseFloat(product.compareAtPriceRange.minVariantPrice.amount);
      if (cmp > minPrice) {
        if (comparePriceEl) {
          comparePriceEl.textContent = `$${cmp.toFixed(2)}`;
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

    // 3. Descriptions & Specs
    const leadDesc = document.getElementById('pdp-lead-description');
    if (leadDesc && product.description) leadDesc.textContent = product.description;

    const fullDesc = document.getElementById('pdp-full-description');
    if (fullDesc && product.description) {
      fullDesc.innerHTML = `<p>${product.description}</p>`;
    }

    const specVendor = document.getElementById('pdp-spec-vendor');
    if (specVendor && product.vendor) specVendor.textContent = product.vendor;

    const specType = document.getElementById('pdp-spec-type');
    if (specType && product.productType) specType.textContent = product.productType;

    // 4. Main Gallery & Thumbnails
    const activeImg = document.getElementById('pdp-active-image') as HTMLImageElement | null;
    const featuredUrl = product.featuredImage?.url || '/images/personalized_box.jpg';
    if (activeImg) {
      activeImg.src = featuredUrl;
      activeImg.alt = product.title;
    }

    const thumbsContainer = document.getElementById('pdp-thumbnails-strip');
    if (thumbsContainer && product.images.nodes.length > 0) {
      thumbsContainer.innerHTML = product.images.nodes
        .map((img, idx) => `
          <button class="thumb-btn w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border ${idx === 0 ? 'border-[#ff4d61]' : 'border-gray-200'} p-1.5 flex items-center justify-center flex-shrink-0 cursor-pointer overflow-hidden transition" data-img="${img.url}">
            <img src="${img.url}" alt="${img.altText || product.title}" class="w-full h-full object-contain">
          </button>
        `)
        .join('');

      thumbsContainer.querySelectorAll('.thumb-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          thumbsContainer.querySelectorAll('.thumb-btn').forEach(b => {
            b.classList.remove('border-[#ff4d61]');
            b.classList.add('border-gray-200');
          });
          btn.classList.add('border-[#ff4d61]');
          btn.classList.remove('border-gray-200');
          const newSrc = btn.getAttribute('data-img');
          if (activeImg && newSrc) activeImg.src = newSrc;
        });
      });
    }

    // 5. Dynamic Shopify Variants Selection
    let selectedVariant: ShopifyVariant = product.variants.nodes[0] || null;
    const variantsContainer = document.getElementById('pdp-variants-container');
    const selectedOptionsState: Record<string, string> = {};

    if (selectedVariant) {
      selectedVariant.selectedOptions.forEach((opt) => {
        selectedOptionsState[opt.name] = opt.value;
      });
    }

    // Render variant options if product has real variant choices
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
                                class="pdp-option-pill text-xs font-semibold px-4 py-2 rounded-xl border transition cursor-pointer ${
                                  isSelected
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

        // Attach option click listeners
        variantsContainer.querySelectorAll('.pdp-option-pill').forEach((pill) => {
          pill.addEventListener('click', () => {
            const optName = pill.getAttribute('data-option');
            const optVal = pill.getAttribute('data-value');
            if (!optName || !optVal) return;

            selectedOptionsState[optName] = optVal;

            // Update label
            const lbl = document.getElementById(`opt-label-${optName}`);
            if (lbl) lbl.textContent = optVal;

            // Update button styles in this option group
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

            // Find matching variant
            const match = product.variants.nodes.find((v) => {
              return v.selectedOptions.every(
                (so) => selectedOptionsState[so.name] === so.value
              );
            });

            if (match) {
              selectedVariant = match;
              updateVariantUI(match);
            }
          });
        });
      }
    }

    function updateVariantUI(v: ShopifyVariant) {
      const vPrice = parseFloat(v.price.amount);
      if (displayPriceEl) displayPriceEl.textContent = `$${vPrice.toFixed(2)}`;

      if (v.image?.url && activeImg) {
        activeImg.src = v.image.url;
      }

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
          stockEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span class="text-emerald-600">In Stock</span>`;
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
    // Only show personalization form if this product is tagged or configured for it
    const isPersonalized =
      product.title.toLowerCase().includes('personalized') ||
      product.title.toLowerCase().includes('custom') ||
      product.tags.some(t => /personaliz|custom|engrav/i.test(t));

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

    // 7. Quantity Controls
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

    // 8. Add to Cart with Genuine Custom Attributes
    const addBtn = document.getElementById('btn-add-pdp-cart');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        if (!selectedVariant) return;

        const customAttributes: { key: string; value: string }[] = [];

        // Validate personalization if section is active
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

          // Open cart drawer
          const cartTrigger = document.getElementById('btn-header-cart');
          if (cartTrigger) cartTrigger.click();
        } catch (err) {
          showToast('Could not add item to bag. Please try again.');
        } finally {
          addBtn.innerHTML = origHtml;
        }
      });
    }

    // 9. Buy Now Direct Checkout
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

    // 10. Load Real Recommendations
    const recsGrid = document.getElementById('pdp-recommendations-grid');
    if (recsGrid) {
      try {
        const recs = await getShopifyProductRecommendations(product.id, 4);
        if (recs.length > 0) {
          recsGrid.innerHTML = recs.map(createProductCardHTML).join('');
          bindAddToCartButtons(recsGrid);
        }
      } catch (err) {
        console.warn('Notice loading recommendations:', err);
      }
    }

  } catch (err) {
    console.error('Error initializing PDP:', err);
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
