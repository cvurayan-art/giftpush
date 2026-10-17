/**
 * Present Panic - Shopify Cart Controller & UI Sync
 * Communicates with Shopify Storefront Cart API and manages slide-out drawer UI
 */

import {
  ShopifyCart,
  shopifyCreateCart,
  shopifyGetCart,
  shopifyCartLinesAdd,
  shopifyCartLinesUpdate,
  shopifyCartLinesRemove,
  shopifyCartDiscountCodesUpdate,
  formatShopifyMoney,
  formatVariantGid,
} from './shopify';
import { analytics } from './analytics';

const SHOPIFY_CART_ID_KEY = 'present_panic_shopify_cart_id';
const SHOPIFY_CART_SNAPSHOT_KEY = 'present_panic_shopify_cart_snapshot';

class CartManager {
  private cart: ShopifyCart | null = null;
  private isBusy = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadCachedCart();
      window.addEventListener('storage', (e) => {
        if (e.key === SHOPIFY_CART_ID_KEY) {
          this.init();
        }
      });
    }
  }

  private loadCachedCart() {
    try {
      const raw = localStorage.getItem(SHOPIFY_CART_SNAPSHOT_KEY);
      if (raw) {
        this.cart = JSON.parse(raw);
        // Instant synchronous badge and drawer update
        setTimeout(() => this.broadcastUpdate(), 0);
      }
    } catch (_) {}
  }

  private saveCachedCart(cart: ShopifyCart | null) {
    try {
      if (cart) {
        localStorage.setItem(SHOPIFY_CART_SNAPSHOT_KEY, JSON.stringify(cart));
      } else {
        localStorage.removeItem(SHOPIFY_CART_SNAPSHOT_KEY);
      }
    } catch (_) {}
  }

  private getBlankCart(): ShopifyCart {
    return {
      id: `blank-${Date.now()}`,
      checkoutUrl: '',
      totalQuantity: 0,
      cost: {
        subtotalAmount: { amount: '0.00', currencyCode: 'GBP' },
        totalAmount: { amount: '0.00', currencyCode: 'GBP' },
      },
      discountCodes: [],
      discountAllocations: [],
      lines: { nodes: [] },
    };
  }

  public getCartId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(SHOPIFY_CART_ID_KEY);
  }

  public setCartId(id: string | null) {
    if (typeof window === 'undefined') return;
    if (id) {
      localStorage.setItem(SHOPIFY_CART_ID_KEY, id);
    } else {
      localStorage.removeItem(SHOPIFY_CART_ID_KEY);
    }
  }

  public getCurrentCart(): ShopifyCart | null {
    return this.cart;
  }

  /**
   * Initialize or retrieve active Shopify cart (Non-blocking)
   */
  public async init(): Promise<ShopifyCart | null> {
    const existingId = this.getCartId();
    if (existingId) {
      try {
        const fetched = await shopifyGetCart(existingId);
        if (fetched) {
          this.cart = fetched;
          this.saveCachedCart(fetched);
          this.broadcastUpdate();
          return fetched;
        } else {
          // Stale / expired / deleted cart on Shopify - clear it!
          this.setCartId(null);
          this.saveCachedCart(null);
          this.cart = null;
        }
      } catch (err) {
        console.warn('[CartManager] Existing cart expired or invalid:', err);
        this.setCartId(null);
        this.saveCachedCart(null);
        this.cart = null;
      }
    }

    if (!this.cart) {
      this.cart = this.getBlankCart();
      this.broadcastUpdate();
    }
    return this.cart;
  }

  private triggerAddTracking(cart: ShopifyCart, variantId: string, quantity: number) {
    try {
      const line = cart.lines?.nodes?.find(
        (n) => n.merchandise?.id === variantId || formatVariantGid(n.merchandise?.id || '') === variantId
      );
      if (line) {
        analytics.trackAddToCart(
          {
            id: line.merchandise.product?.id || variantId,
            variantId: line.merchandise.id || variantId,
            title: line.merchandise.product?.title || line.merchandise.title || 'Product',
            price: line.merchandise.price?.amount || 0,
            currency: line.merchandise.price?.currencyCode || 'GBP',
            category: line.merchandise.product?.productType || 'Gifts',
          },
          quantity
        );
      } else {
        analytics.trackAddToCart(
          {
            id: variantId,
            variantId: variantId,
            title: 'Gift Item',
            price: 0,
            currency: cart.cost?.totalAmount?.currencyCode || 'GBP',
          },
          quantity
        );
      }
    } catch (e) {
      console.warn('[CartManager] Add tracking notice:', e);
    }
  }

  /**
   * Add a product variant to the Shopify Cart (With self-healing automatic recovery)
   */
  public async addItem(
    variantId: string,
    quantity = 1,
    attributes: { key: string; value: string }[] = []
  ): Promise<ShopifyCart> {
    const cleanVariantId = formatVariantGid(variantId);

    const createFreshCart = async (): Promise<ShopifyCart> => {
      const newCart = await shopifyCreateCart([
        { merchandiseId: cleanVariantId, quantity, attributes },
      ]);
      this.cart = newCart;
      this.setCartId(newCart.id);
      this.saveCachedCart(newCart);
      this.broadcastUpdate();
      this.triggerAddTracking(newCart, cleanVariantId, quantity);
      return newCart;
    };

    const existingId = this.getCartId();
    if (!existingId || !this.cart || !this.cart.id || this.cart.id.startsWith('blank-')) {
      this.isBusy = true;
      try {
        return await createFreshCart();
      } catch (err: any) {
        console.error('[CartManager] Failed to create cart with item:', err);
        throw err;
      } finally {
        this.isBusy = false;
      }
    }

    try {
      this.isBusy = true;
      const updated = await shopifyCartLinesAdd(this.cart.id, [
        { merchandiseId: cleanVariantId, quantity, attributes },
      ]);
      this.cart = updated;
      this.saveCachedCart(updated);
      this.broadcastUpdate();
      this.triggerAddTracking(updated, cleanVariantId, quantity);
      return updated;
    } catch (err: any) {
      console.warn('[CartManager] Failed to add item to existing cart, auto-recovering with new cart:', err);
      // Auto-recover if cart expired, deleted, or invalid
      try {
        this.setCartId(null);
        this.saveCachedCart(null);
        this.cart = null;
        return await createFreshCart();
      } catch (freshErr: any) {
        console.error('[CartManager] Failed to create fresh cart during auto-recovery:', freshErr);
        throw freshErr;
      }
    } finally {
      this.isBusy = false;
    }
  }

  /**
   * Update quantity of a line item
   */
  public async updateQuantity(lineId: string, quantity: number): Promise<ShopifyCart> {
    if (!this.cart || !this.cart.id || this.cart.id.startsWith('blank-')) {
      const c = await this.init();
      if (!c) throw new Error('Cart unavailable');
    }

    try {
      this.isBusy = true;
      const updated = await shopifyCartLinesUpdate(this.cart!.id, [{ id: lineId, quantity }]);
      this.cart = updated;
      this.saveCachedCart(updated);
      this.broadcastUpdate();
      return updated;
    } catch (err: any) {
      console.error('[CartManager] Failed to update line quantity:', err);
      // If cart doesn't exist, reset cart
      this.setCartId(null);
      this.saveCachedCart(null);
      this.cart = this.getBlankCart();
      this.broadcastUpdate();
      throw err;
    } finally {
      this.isBusy = false;
    }
  }

  /**
   * Remove a line item from cart
   */
  public async removeItem(lineId: string): Promise<ShopifyCart> {
    if (!this.cart || !this.cart.id || this.cart.id.startsWith('blank-')) {
      const c = await this.init();
      if (!c) throw new Error('Cart unavailable');
    }

    // Capture item info before removal for tracking
    const itemToRemove = this.cart?.lines?.nodes?.find((n) => n.id === lineId);

    try {
      this.isBusy = true;
      const updated = await shopifyCartLinesRemove(this.cart!.id, [lineId]);
      this.cart = updated;
      this.saveCachedCart(updated);
      this.broadcastUpdate();

      if (itemToRemove) {
        try {
          analytics.trackRemoveFromCart(
            {
              id: itemToRemove.merchandise?.product?.id || itemToRemove.merchandise?.id || lineId,
              variantId: itemToRemove.merchandise?.id,
              title: itemToRemove.merchandise?.product?.title || itemToRemove.merchandise?.title || 'Product',
              price: itemToRemove.merchandise?.price?.amount || 0,
              currency: itemToRemove.merchandise?.price?.currencyCode || 'GBP',
            },
            itemToRemove.quantity || 1
          );
        } catch (tErr) {
          console.debug('[CartManager] Remove tracking notice:', tErr);
        }
      }

      return updated;
    } catch (err: any) {
      console.error('[CartManager] Failed to remove item:', err);
      this.setCartId(null);
      this.saveCachedCart(null);
      this.cart = this.getBlankCart();
      this.broadcastUpdate();
      throw err;
    } finally {
      this.isBusy = false;
    }
  }

  /**
   * Apply discount code via Shopify Cart API
   */
  public async applyPromoCode(code: string): Promise<ShopifyCart> {
    if (!this.cart) {
      const c = await this.init();
      if (!c) throw new Error('Cart unavailable');
    }

    try {
      this.isBusy = true;
      const updated = await shopifyCartDiscountCodesUpdate(this.cart!.id, [code]);
      this.cart = updated;
      this.saveCachedCart(updated);
      this.broadcastUpdate();
      return updated;
    } catch (err: any) {
      console.error('[CartManager] Failed to apply discount:', err);
      throw err;
    } finally {
      this.isBusy = false;
    }
  }

  /**
   * Remove discount code from cart
   */
  public async removePromoCode(): Promise<ShopifyCart> {
    if (!this.cart) {
      const c = await this.init();
      if (!c) throw new Error('Cart unavailable');
    }

    try {
      this.isBusy = true;
      const updated = await shopifyCartDiscountCodesUpdate(this.cart!.id, []);
      this.cart = updated;
      this.saveCachedCart(updated);
      this.broadcastUpdate();
      return updated;
    } catch (err: any) {
      console.error('[CartManager] Failed to remove promo:', err);
      throw err;
    } finally {
      this.isBusy = false;
    }
  }

  /**
   * Open Shopify Checkout
   * Customers complete purchase as guest directly on Shopify checkout
   */
  public proceedToCheckout(): void {
    if (!this.cart || this.cart.totalQuantity === 0) {
      alert('Your cart is empty. Please add items before proceeding to checkout.');
      return;
    }

    // Immediate visual loading animation on checkout buttons
    try {
      const checkoutButtons = document.querySelectorAll<HTMLElement>(
        '#cart-checkout-btn, #btn-proceed-checkout, #btn-checkout, #btn-cart-page-checkout, [data-checkout-btn]'
      );
      checkoutButtons.forEach((btn) => {
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.92';
        btn.innerHTML = `
          <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          <span class="font-bold tracking-wide">Redirecting to Checkout...</span>
        `;
      });
    } catch (_) {}

    const storeDomain =
      (import.meta.env.VITE_SHOPIFY_STORE_DOMAIN as string) ||
      'checkout.presentpanic.com';
    const checkoutUrl = this.cart.checkoutUrl || `https://${storeDomain}/cart`;

    try {
      const items = (this.cart.lines?.nodes || []).map((line) => ({
        id: line.merchandise?.product?.id || line.merchandise?.id || '',
        variantId: line.merchandise?.id,
        title: line.merchandise?.product?.title || line.merchandise?.title || 'Product',
        price: line.merchandise?.price?.amount || 0,
        currency: line.merchandise?.price?.currencyCode || 'GBP',
        quantity: line.quantity || 1,
      }));
      const total = parseFloat(this.cart.cost?.totalAmount?.amount || '0');
      const currency = this.cart.cost?.totalAmount?.currencyCode || 'GBP';

      analytics.trackInitiateCheckout(items, total, currency);
    } catch (e) {
      console.warn('[CartManager] Checkout tracking notice:', e);
    }

    // Decorate checkout URL with Meta Click ID and attribution parameters
    const targetUrl = analytics.decorateCheckoutUrl(checkoutUrl);

    // Redirect directly to Shopify-hosted Checkout
    window.location.href = targetUrl;
  }

  /**
   * Broadcast state changes to DOM
   */
  private broadcastUpdate() {
    if (typeof window === 'undefined') return;

    // Dispatch custom event
    const event = new CustomEvent('shopify:cart:updated', { detail: this.cart });
    window.dispatchEvent(event);

    // Synchronize UI
    this.renderCartUI();
  }

  /**
   * Update badges, drawer lines, subtotals, and discount badges
   */
  public renderCartUI() {
    if (!this.cart) return;

    const currency = this.cart.cost.subtotalAmount.currencyCode || 'GBP';
    const qty = this.cart.totalQuantity;
    const subtotalNum = parseFloat(this.cart.cost.subtotalAmount.amount);
    const subtotal = formatShopifyMoney(subtotalNum, currency);
    const total = formatShopifyMoney(parseFloat(this.cart.cost.totalAmount.amount), currency);

    // 1. Update Badges
    const badgeIds = ['cart-badge', 'cart-count', 'cart-drawer-count', 'cart-drawer-count-header'];
    badgeIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = String(qty);
        if (qty > 0) {
          el.classList.remove('hidden');
        }
      }
    });

    // 2. Update Subtotal & Total
    const subtotalEl = document.getElementById('cart-subtotal-price') || document.querySelector('.subtotal-amount');
    if (subtotalEl) subtotalEl.textContent = subtotal;

    const totalEl = document.getElementById('cart-total-price');
    if (totalEl) totalEl.textContent = total;

    const checkoutBtnTotal = document.getElementById('cart-checkout-btn-total');
    if (checkoutBtnTotal) checkoutBtnTotal.textContent = total;

    // Free shipping tracker (50 threshold)
    const shippingBar = document.getElementById('cart-shipping-bar');
    const shippingAmountEl = document.getElementById('cart-shipping-amount');
    const shippingTextEl = document.getElementById('cart-shipping-text');
    if (shippingBar) {
      const freeThreshold = 50;
      const diff = Math.max(0, freeThreshold - subtotalNum);
      const pct = Math.min(100, Math.round((subtotalNum / freeThreshold) * 100));
      shippingBar.style.width = `${pct}%`;
      if (shippingAmountEl) shippingAmountEl.textContent = formatShopifyMoney(diff, currency);
      if (diff === 0 && shippingTextEl) {
        shippingTextEl.innerHTML = `<span>🎉</span> <strong>FREE Holiday Delivery Unlocked!</strong>`;
      }
    }

    // 3. Discount Row
    const discountRow = document.getElementById('cart-discount-row');
    const discountAmtEl = document.getElementById('cart-discount-amount');
    const promoBadge = document.getElementById('promo-applied-badge');
    const promoBadgeText = document.getElementById('promo-applied-text');

    if (this.cart.discountAllocations && this.cart.discountAllocations.length > 0) {
      const dAmt = parseFloat(this.cart.discountAllocations[0].discountedAmount.amount);
      if (discountRow) discountRow.classList.remove('hidden');
      if (discountRow) discountRow.classList.add('flex');
      if (discountAmtEl) discountAmtEl.textContent = `-${formatShopifyMoney(dAmt, currency)}`;

      if (promoBadge) {
        promoBadge.classList.remove('hidden');
        promoBadge.classList.add('flex');
        const code = this.cart.discountCodes?.[0]?.code || 'PROMO';
        if (promoBadgeText) promoBadgeText.textContent = `Coupon applied: ${code} (-${formatShopifyMoney(dAmt, currency)})`;
      }
    } else {
      if (discountRow) {
        discountRow.classList.add('hidden');
        discountRow.classList.remove('flex');
      }
      if (promoBadge) {
        promoBadge.classList.add('hidden');
        promoBadge.classList.remove('flex');
      }
    }

    // 4. Empty State vs Items List
    let itemsContainer = document.getElementById('cart-items-list');
    const drawerBody = document.querySelector('.cart-drawer-body');
    let emptyView = document.getElementById('cart-empty-view');
    const footerSection = document.getElementById('cart-footer-section');

    if (!itemsContainer && drawerBody) {
      drawerBody.innerHTML = `
        <div id="cart-empty-view" class="hidden flex-col items-center justify-center h-full text-center space-y-4 py-12">
          <div class="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400 mb-2 mx-auto">
            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </div>
          <p class="text-neutral-500 text-sm">Your bag is currently empty.</p>
          <button class="text-[#ff4d61] font-bold text-sm hover:underline cursor-pointer" onclick="document.getElementById('btn-close-cart-drawer')?.click()">Continue Shopping</button>
        </div>
        <div id="cart-items-list" class="space-y-4"></div>
      `;
      itemsContainer = document.getElementById('cart-items-list');
      emptyView = document.getElementById('cart-empty-view');
    }

    if (!itemsContainer) return;

    if (qty === 0 || this.cart.lines.nodes.length === 0) {
      itemsContainer.innerHTML = '';
      if (emptyView) {
        emptyView.classList.remove('hidden');
        emptyView.classList.add('flex');
      }
      if (footerSection) {
        footerSection.classList.add('opacity-50', 'pointer-events-none');
      }
      return;
    }

    if (emptyView) {
      emptyView.classList.add('hidden');
      emptyView.classList.remove('flex');
    }
    if (footerSection) {
      footerSection.classList.remove('opacity-50', 'pointer-events-none');
    }

    // Render Line Items safely
    itemsContainer.innerHTML = this.cart.lines.nodes
      .map((line) => {
        const itemImg = line.merchandise?.image?.url || line.merchandise?.product?.featuredImage?.url || '/images/personalized_box.jpg';
        const itemTitle = line.merchandise?.product?.title || line.merchandise?.title || 'Curated Gift';
        const variantTitle = (line.merchandise?.title && line.merchandise.title !== 'Default Title') ? line.merchandise.title : '';
        const itemCurrency = line.merchandise?.price?.currencyCode || currency;
        const itemPrice = formatShopifyMoney(parseFloat(line.merchandise?.price?.amount || '0'), itemCurrency);
        const lineTotal = formatShopifyMoney(parseFloat(line.cost?.totalAmount?.amount || '0'), line.cost?.totalAmount?.currencyCode || itemCurrency);
        const handle = line.merchandise?.product?.handle || '';

        const attributesHtml = line.attributes && line.attributes.length > 0
          ? `<div class="mt-1 space-y-0.5 text-[11px] text-neutral-500 font-normal">
              ${line.attributes.map(a => `<div><span class="font-semibold text-neutral-700">${a.key}:</span> ${a.value}</div>`).join('')}
             </div>`
          : '';

        const productLink = handle ? `/product.html?handle=${handle}` : '#';

        return `
          <div class="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0 group" data-line-id="${line.id}">
            <a href="${productLink}" class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gray-50 flex items-center justify-center p-2 overflow-hidden flex-shrink-0 border border-gray-100 hover:opacity-90 transition">
              <img src="${itemImg}" alt="${itemTitle}" class="w-full h-full object-contain">
            </a>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start gap-2">
                <a href="${productLink}" class="text-xs sm:text-sm font-bold text-neutral-900 hover:text-[#ff4d61] transition line-clamp-1">
                  ${itemTitle}
                </a>
                <button class="cart-remove-line-btn text-neutral-400 hover:text-rose-500 transition p-1" data-line-id="${line.id}" title="Remove item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              ${variantTitle ? `<p class="text-[11px] text-neutral-500 font-medium">${variantTitle}</p>` : ''}
              ${attributesHtml}
              <div class="flex items-center justify-between mt-3">
                <div class="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <button type="button" class="cart-qty-minus px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 transition" data-line-id="${line.id}" data-qty="${line.quantity - 1}">
                    &minus;
                  </button>
                  <span class="px-2.5 py-1 text-xs font-bold text-neutral-800">${line.quantity}</span>
                  <button type="button" class="cart-qty-plus px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 transition" data-line-id="${line.id}" data-qty="${line.quantity + 1}">
                    &#43;
                  </button>
                </div>
                <div class="text-right">
                  <span class="text-xs sm:text-sm font-black text-neutral-950">${lineTotal}</span>
                  ${line.quantity > 1 ? `<span class="block text-[10px] text-neutral-400">${itemPrice} each</span>` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach event handlers to new buttons
    this.attachCartEventHandlers();
  }

  private attachCartEventHandlers() {
    // Quantity Minus
    document.querySelectorAll('.cart-qty-minus').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const lineId = btn.getAttribute('data-line-id');
        const qty = parseInt(btn.getAttribute('data-qty') || '0', 10);
        if (lineId) {
          if (qty <= 0) {
            this.removeItem(lineId);
          } else {
            this.updateQuantity(lineId, qty);
          }
        }
      });
    });

    // Quantity Plus
    document.querySelectorAll('.cart-qty-plus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lineId = btn.getAttribute('data-line-id');
        const qty = parseInt(btn.getAttribute('data-qty') || '1', 10);
        if (lineId) {
          this.updateQuantity(lineId, qty);
        }
      });
    });

    // Remove Line
    document.querySelectorAll('.cart-remove-line-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lineId = btn.getAttribute('data-line-id');
        if (lineId) {
          this.removeItem(lineId);
        }
      });
    });
  }
}

export const cart = new CartManager();
