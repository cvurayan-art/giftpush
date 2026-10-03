/**
 * Present Panic - Storefront Core Controller
 * Connects Frontend UI with Shopify Backend (Storefront API, Cart, Collections, Search)
 */

import {
  getShopifyProducts,
  getShopifyProductByHandle,
  getShopifyCollections,
  searchShopifyProducts,
  getShopifyProductRecommendations,
  ShopifyProduct,
} from '../lib/shopify';
import { cart } from '../lib/cart';

// Expose on window for easy access if needed
(window as any).ShopifyCommerce = {
  getProducts: getShopifyProducts,
  getProductByHandle: getShopifyProductByHandle,
  getCollections: getShopifyCollections,
  searchProducts: searchShopifyProducts,
  getRecommendations: getShopifyProductRecommendations,
  cart,
};

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Shopify Cart
  try {
    await cart.init();
  } catch (err) {
    console.error('Cart initialization error:', err);
  }

  // Bind Cart Drawer Open / Close
  setupCartDrawer();

  // Bind Search Modal
  setupSearchModal();

  // Bind Wishlist Drawer
  setupWishlistDrawer();

  // If on Homepage (index.html), initialize dynamic products & collection filters
  if (document.getElementById('flash-deals-container') || document.getElementById('category-stories-track')) {
    initHomepageCommerce();
  }

  // If on Product Details Page (product.html), initialize dynamic product
  if (document.getElementById('pdp-active-image') || document.querySelector('.pdp-hero-section')) {
    initProductPageCommerce();
  }
});

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
    cartOverlay.classList.add('active'); // Supports product.html modal-overlay
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

  // Proceed to Shopify Checkout
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      cart.proceedToCheckout();
    });
  }

  // Apply Discount Code
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

  // Remove Discount Code
  if (removePromoBtn) {
    removePromoBtn.addEventListener('click', async () => {
      try {
        await cart.removePromoCode();
        showToast('Promo code removed');
      } catch (err: any) {
        showToast('Failed to remove promo');
      }
    });
  }
}

// ====================================================
// 2. SEARCH MODAL CONTROLLER
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
  const quickTags = document.querySelectorAll('.search-tag-chip, .search-quick-tag, .tag-btn');
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

  quickTags.forEach((tag) => {
    tag.addEventListener('click', () => {
      if (searchInput) {
        const val = tag.getAttribute('data-tag') || tag.textContent?.trim() || '';
        searchInput.value = val;
        if (clearBtn) clearBtn.classList.remove('hidden');
        triggerSearch(val);
      }
    });
  });

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
            <p class="text-[11px] text-neutral-400 mt-1">Try another search term like "Watch", "Candle", "Hamper", or "Box".</p>
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
// 3. WISHLIST DRAWER CONTROLLER
// ====================================================
function setupWishlistDrawer() {
  const wishlistTrigger = document.getElementById('btn-header-wishlist');
  const wishlistOverlay = document.getElementById('wishlist-drawer-overlay');
  const closeWishlistBtn = document.getElementById('btn-close-wishlist-drawer');

  function openWishlist() {
    if (!wishlistOverlay) return;
    wishlistOverlay.classList.remove('pointer-events-none');
    const backdrop = document.getElementById('wishlist-drawer-backdrop');
    const panel = document.getElementById('wishlist-drawer-panel');
    if (backdrop) {
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
    }
    if (panel) {
      panel.classList.remove('translate-x-full');
      panel.classList.add('translate-x-0');
    }
  }

  function closeWishlist() {
    if (!wishlistOverlay) return;
    const backdrop = document.getElementById('wishlist-drawer-backdrop');
    const panel = document.getElementById('wishlist-drawer-panel');
    if (backdrop) {
      backdrop.classList.remove('opacity-100');
      backdrop.classList.add('opacity-0');
    }
    if (panel) {
      panel.classList.remove('translate-x-0');
      panel.classList.add('translate-x-full');
    }
    setTimeout(() => {
      wishlistOverlay.classList.add('pointer-events-none');
    }, 300);
  }

  if (wishlistTrigger) wishlistTrigger.addEventListener('click', openWishlist);
  if (closeWishlistBtn) closeWishlistBtn.addEventListener('click', closeWishlist);
  const backdrop = document.getElementById('wishlist-drawer-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeWishlist);
}

// ====================================================
// 4. HOMEPAGE COMMERCE INITIALIZATION
// ====================================================
async function initHomepageCommerce() {
  // Load products from Shopify
  try {
    const products = await getShopifyProducts({ first: 12 });
    renderFlashDeals(products);
    bindCategoryFilters();
  } catch (err) {
    console.error('[Homepage] Failed to load Shopify products:', err);
  }
}

function renderFlashDeals(products: ShopifyProduct[]) {
  const container = document.getElementById('flash-deals-container');
  if (!container || products.length === 0) return;

  container.innerHTML = products
    .map((p) => {
      const img = p.featuredImage?.url || '/images/personalized_box.jpg';
      const price = `$${parseFloat(p.priceRange.minVariantPrice.amount).toFixed(2)}`;
      const hasCompare = Boolean(p.compareAtPriceRange?.minVariantPrice);
      const comparePrice = hasCompare
        ? `$${parseFloat(p.compareAtPriceRange!.minVariantPrice.amount).toFixed(2)}`
        : '';
      const defaultVariant = p.variants.nodes[0];
      const variantId = defaultVariant ? defaultVariant.id : '';

      return `
        <div class="border border-gray-100 rounded-2xl p-5 bg-white flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
          <a href="/product.html?handle=${p.handle}" class="relative bg-gray-50 rounded-xl p-5 flex items-center justify-center h-52 lg:h-56 block overflow-hidden">
            ${hasCompare ? `<span class="absolute top-3 left-3 bg-[#ff4d61] text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow-sm">Deal</span>` : ''}
            <img alt="${p.title}" class="h-36 lg:h-40 object-contain group-hover:scale-108 transition duration-300 pointer-events-none" src="${img}">
          </a>
          <div class="mt-5 flex-1 flex flex-col justify-between">
            <div>
              <a href="/product.html?handle=${p.handle}" class="text-sm font-semibold text-neutral-800 line-clamp-2 leading-snug hover:text-[#ff4d61] transition block">
                ${p.title}
              </a>
              <div class="mt-2 flex items-center gap-2">
                ${hasCompare ? `<span class="text-xs text-neutral-400 line-through">${comparePrice}</span>` : ''}
                <span class="text-base font-bold text-[#ff4d61]">${price}</span>
              </div>
            </div>
            <div class="mt-5 flex items-center gap-2">
              <button class="add-to-cart-action-btn flex-1 bg-neutral-900 hover:bg-[#ff4d61] text-white text-xs font-semibold py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                      data-variant-id="${variantId}"
                      data-title="${p.title}"
                      data-price="${price}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
                <span>Add To Cart</span>
              </button>
              <button aria-label="Favorite" class="wishlist-toggle-btn w-10 h-10 border border-neutral-900 bg-neutral-900 text-white rounded-xl flex items-center justify-center hover:bg-[#ff4d61] hover:border-[#ff4d61] transition cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  // Attach Add to Cart listener
  container.querySelectorAll('.add-to-cart-action-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const variantId = btn.getAttribute('data-variant-id');
      const title = btn.getAttribute('data-title') || 'Item';
      if (!variantId) return;

      const origText = btn.innerHTML;
      btn.innerHTML = `<span>Adding...</span>`;
      try {
        await cart.addItem(variantId, 1);
        showToast(`Added "${title}" to your cart!`);
      } catch (err: any) {
        showToast('Error adding to cart. Please try again.');
      } finally {
        btn.innerHTML = origText;
      }
    });
  });
}

function bindCategoryFilters() {
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
        renderFlashDeals(filtered);
      } catch (e) {
        console.error('Filter error:', e);
      }
    });
  });
}

// ====================================================
// 5. PRODUCT DETAILS PAGE COMMERCE INITIALIZATION
// ====================================================
async function initProductPageCommerce() {
  const urlParams = new URLSearchParams(window.location.search);
  const handle = urlParams.get('handle') || 'engraved-family-keepsake-box';

  try {
    const product = await getShopifyProductByHandle(handle);
    if (!product) return;

    // 1. Update Title & Meta
    document.title = `${product.title} | Present Panic`;
    const titleEl = document.querySelector('.pdp-title');
    if (titleEl) titleEl.textContent = product.title;

    // Breadcrumb
    const breadcrumbItem = document.querySelector('.breadcrumb-list li:last-child span');
    if (breadcrumbItem) breadcrumbItem.textContent = product.title;

    // 2. Pricing
    const price = parseFloat(product.priceRange.minVariantPrice.amount);
    const displayPriceEl = document.getElementById('pdp-display-price');
    if (displayPriceEl) displayPriceEl.textContent = `$${price.toFixed(2)}`;

    const comparePriceEl = document.querySelector('.pdp-compare-price');
    if (comparePriceEl && product.compareAtPriceRange?.minVariantPrice) {
      const cmp = parseFloat(product.compareAtPriceRange.minVariantPrice.amount);
      comparePriceEl.textContent = `$${cmp.toFixed(2)}`;
    }

    // 3. Main Image & Gallery
    const activeImg = document.getElementById('pdp-active-image') as HTMLImageElement | null;
    const featuredUrl = product.featuredImage?.url || '/images/personalized_box.jpg';
    if (activeImg) {
      activeImg.src = featuredUrl;
      activeImg.alt = product.title;
    }

    const thumbsContainer = document.querySelector('.pdp-thumbnails-strip');
    if (thumbsContainer && product.images.nodes.length > 0) {
      thumbsContainer.innerHTML = product.images.nodes
        .map((img, idx) => `
          <button class="thumb-btn ${idx === 0 ? 'active' : ''}" data-img="${img.url}" aria-label="View product image ${idx + 1}">
            <img src="${img.url}" alt="${img.altText || product.title}">
          </button>
        `)
        .join('');

      thumbsContainer.querySelectorAll('.thumb-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          thumbsContainer.querySelectorAll('.thumb-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const newSrc = btn.getAttribute('data-img');
          if (activeImg && newSrc) activeImg.src = newSrc;
        });
      });
    }

    // 4. Description
    const descEl = document.querySelector('.pdp-lead-description');
    if (descEl && product.description) {
      descEl.textContent = product.description;
    }

    // 5. Active Variant State
    let selectedVariant = product.variants.nodes[0];
    let quantity = 1;

    const qtyValEl = document.getElementById('qty-val');
    const minusBtn = document.getElementById('btn-qty-minus');
    const plusBtn = document.getElementById('btn-qty-plus');

    if (minusBtn && qtyValEl) {
      minusBtn.addEventListener('click', () => {
        if (quantity > 1) {
          quantity--;
          qtyValEl.textContent = String(quantity);
          updateAddToCartBtn();
        }
      });
    }
    if (plusBtn && qtyValEl) {
      plusBtn.addEventListener('click', () => {
        quantity++;
        qtyValEl.textContent = String(quantity);
        updateAddToCartBtn();
      });
    }

    // Wood & Velvet Swatch Selection -> Variant Match
    const woodSwatches = document.querySelectorAll('.wood-swatch');
    const velvetSwatches = document.querySelectorAll('.velvet-swatch');
    let selectedWood = 'Heritage Walnut';
    let selectedVelvet = 'Emerald Forest Velvet';

    woodSwatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        woodSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        selectedWood = swatch.getAttribute('data-finish') || '';
        const lbl = document.getElementById('selected-finish-label');
        if (lbl) lbl.textContent = selectedWood;
        findMatchingVariant();
      });
    });

    velvetSwatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        velvetSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        selectedVelvet = swatch.getAttribute('data-velvet') || '';
        const lbl = document.getElementById('selected-velvet-label');
        if (lbl) lbl.textContent = selectedVelvet;
        findMatchingVariant();
      });
    });

    function findMatchingVariant() {
      // Find variant that matches options
      const match = product!.variants.nodes.find((v) => {
        const matchesWood = v.selectedOptions.some(o => o.value.includes(selectedWood) || selectedWood.includes(o.value));
        const matchesVelvet = v.selectedOptions.some(o => o.value.includes(selectedVelvet) || selectedVelvet.includes(o.value));
        return matchesWood || matchesVelvet;
      });

      if (match) {
        selectedVariant = match;
        const vPrice = parseFloat(match.price.amount);
        if (displayPriceEl) displayPriceEl.textContent = `$${vPrice.toFixed(2)}`;
        if (match.image?.url && activeImg) {
          activeImg.src = match.image.url;
        }
      }
      updateAddToCartBtn();
    }

    function updateAddToCartBtn() {
      const addBtn = document.getElementById('btn-add-pdp-cart');
      if (!addBtn) return;

      const unitPrice = parseFloat(selectedVariant ? selectedVariant.price.amount : '49.00');
      const total = unitPrice * quantity;

      if (selectedVariant && !selectedVariant.availableForSale) {
        addBtn.innerHTML = `<span>Out of Stock</span>`;
        addBtn.classList.add('opacity-50', 'pointer-events-none');
      } else {
        addBtn.classList.remove('opacity-50', 'pointer-events-none');
        addBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
          <span>Add Custom Box to Bag &bull; $${total.toFixed(2)}</span>
        `;
      }
    }

    // Add to Cart Action
    const addBtn = document.getElementById('btn-add-pdp-cart');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        if (!selectedVariant) return;

        // Custom attributes from personalizer inputs
        const customNameInput = document.getElementById('custom-name-input') as HTMLInputElement | null;
        const customDateInput = document.getElementById('custom-date-input') as HTMLInputElement | null;
        const fontInput = document.querySelector('input[name="engrave-font"]:checked') as HTMLInputElement | null;

        const customAttributes: { key: string; value: string }[] = [];
        if (customNameInput && customNameInput.value) {
          customAttributes.push({ key: 'Engraved Name', value: customNameInput.value });
        }
        if (customDateInput && customDateInput.value) {
          customAttributes.push({ key: 'Dedication / Date', value: customDateInput.value });
        }
        if (fontInput && fontInput.value) {
          customAttributes.push({ key: 'Typography Style', value: fontInput.value });
        }

        const origHtml = addBtn.innerHTML;
        addBtn.innerHTML = `<span>Adding to Bag...</span>`;
        try {
          await cart.addItem(selectedVariant.id, quantity, customAttributes);
          showToast(`Added "${product.title}" to bag!`);

          // Open cart drawer to reveal addition
          const cartTrigger = document.getElementById('btn-header-cart') || document.getElementById('btn-cart-trigger');
          if (cartTrigger) cartTrigger.click();
        } catch (err: any) {
          showToast('Could not add item to bag. Please try again.');
        } finally {
          addBtn.innerHTML = origHtml;
        }
      });
    }

  } catch (err) {
    console.error('[PDP] Error initializing product page:', err);
  }
}

// ----------------------------------------------------
// Toast Utility
// ----------------------------------------------------
function showToast(message: string) {
  let toast = document.getElementById('action-toast') || document.getElementById('toast-notification');
  let text = document.getElementById('action-toast-text');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'action-toast';
    toast.className = 'fixed top-5 right-5 z-[200] bg-neutral-900 text-white text-xs font-bold py-3 px-5 rounded-2xl shadow-xl flex items-center gap-2 transform transition-all duration-300';
    toast.innerHTML = `<span id="action-toast-text">${message}</span>`;
    document.body.appendChild(toast);
    text = document.getElementById('action-toast-text');
  }

  if (text) text.textContent = message;
  toast.classList.remove('opacity-0', 'pointer-events-none');
  toast.classList.add('opacity-100');

  setTimeout(() => {
    toast?.classList.remove('opacity-100');
    toast?.classList.add('opacity-0', 'pointer-events-none');
  }, 3000);
}
