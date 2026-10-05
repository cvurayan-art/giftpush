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
} from './shopify';

const SHOPIFY_CART_ID_KEY = 'present_panic_shopify_cart_id';

class CartManager {
  private cart: ShopifyCart | null = null;
  private isBusy = false;

  constructor() {
    // Listen for storage changes across tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === SHOPIFY_CART_ID_KEY) {
          this.init();
        }
      });
    }
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
   * Initialize or retrieve active Shopify cart
   */
  public async init(): Promise<ShopifyCart> {
    const existingId = this.getCartId();
    if (existingId) {
      try {
        const fetched = await shopifyGetCart(existingId);
        if (fetched) {
          this.cart = fetched;
          this.broadcastUpdate();
          return fetched;
        }
      } catch (err) {
        console.warn('[CartManager] Existing cart expired or invalid, creating new:', err);
      }
    }

    // Create fresh cart
    try {
      const newCart = await shopifyCreateCart([]);
      this.cart = newCart;
      this.setCartId(newCart.id);
      this.broadcastUpdate();
      return newCart;
    } catch (err) {
      console.error('[CartManager] Error creating cart:', err);
      throw err;
    }
  }

  /**
   * Add a product variant to the Shopify Cart
   */
  public async addItem(
    variantId: string,
    quantity = 1,
    attributes: { key: string; value: string }[] = []
  ): Promise<ShopifyCart> {
    if (!this.cart) {
      await this.init();
    }

    try {
      this.isBusy = true;
      const updated = await shopifyCartLinesAdd(this.cart!.id, [
        { merchandiseId: variantId, quantity, attributes },
      ]);
      this.cart = updated;
      this.broadcastUpdate();
      return updated;
    } catch (err: any) {
      console.error('[CartManager] Failed to add item to cart:', err);
      throw err;
    } finally {
      this.isBusy = false;
    }
  }

  /**
   * Update quantity of a line item
   */
  public async updateQuantity(lineId: string, quantity: number): Promise<ShopifyCart> {
    if (!this.cart) return this.init();

    try {
      this.isBusy = true;
      const updated = await shopifyCartLinesUpdate(this.cart.id, [{ id: lineId, quantity }]);
      this.cart = updated;
      this.broadcastUpdate();
      return updated;
    } catch (err: any) {
      console.error('[CartManager] Failed to update line quantity:', err);
      throw err;
    } finally {
      this.isBusy = false;
    }
  }

  /**
   * Remove a line item from cart
   */
  public async removeItem(lineId: string): Promise<ShopifyCart> {
    if (!this.cart) return this.init();

    try {
      this.isBusy = true;
      const updated = await shopifyCartLinesRemove(this.cart.id, [lineId]);
      this.cart = updated;
      this.broadcastUpdate();
      return updated;
    } catch (err: any) {
      console.error('[CartManager] Failed to remove item:', err);
      throw err;
    } finally {
      this.isBusy = false;
    }
  }

  /**
   * Apply discount code via Shopify Cart API
   */
  public async applyPromoCode(code: string): Promise<ShopifyCart> {
    if (!this.cart) return this.init();

    try {
      this.isBusy = true;
      const updated = await shopifyCartDiscountCodesUpdate(this.cart.id, [code]);
      this.cart = updated;
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
    if (!this.cart) return this.init();

    try {
      this.isBusy = true;
      const updated = await shopifyCartDiscountCodesUpdate(this.cart.id, []);
      this.cart = updated;
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
    if (!this.cart || !this.cart.checkoutUrl) {
      alert('Cart is empty. Please add gifts before checking out.');
      return;
    }
    if (this.cart.totalQuantity === 0) {
      alert('Your cart is empty. Please add items before proceeding to checkout.');
      return;
    }

    // Redirect to Shopify-hosted Checkout URL
    window.location.href = this.cart.checkoutUrl;
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

    // Free shipping tracker ($50 threshold)
    const shippingBar = document.getElementById('cart-shipping-bar');
    const shippingAmountEl = document.getElementById('cart-shipping-amount');
    const shippingTextEl = document.getElementById('cart-shipping-text');
    if (shippingBar) {
      const freeThreshold = 50;
      const diff = Math.max(0, freeThreshold - subtotalNum);
      const pct = Math.min(100, Math.round((subtotalNum / freeThreshold) * 100));
      shippingBar.style.width = `${pct}%`;
      if (shippingAmountEl) shippingAmountEl.textContent = `$${diff.toFixed(2)}`;
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
      if (discountAmtEl) discountAmtEl.textContent = `-$${dAmt.toFixed(2)}`;

      if (promoBadge) {
        promoBadge.classList.remove('hidden');
        promoBadge.classList.add('flex');
        const code = this.cart.discountCodes?.[0]?.code || 'PROMO';
        if (promoBadgeText) promoBadgeText.textContent = `Coupon applied: ${code} (-$${dAmt.toFixed(2)})`;
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
    const itemsContainer = document.getElementById('cart-items-list');
    const emptyView = document.getElementById('cart-empty-view');
    const footerSection = document.getElementById('cart-footer-section');

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

    // Render Line Items
    itemsContainer.innerHTML = this.cart.lines.nodes
      .map((line) => {
        const itemImg = line.merchandise.image?.url || line.merchandise.product.featuredImage?.url || '/images/personalized_box.jpg';
        const itemTitle = line.merchandise.product.title;
        const variantTitle = line.merchandise.title !== 'Default Title' ? line.merchandise.title : '';
        const itemCurrency = line.merchandise.price.currencyCode || currency;
        const itemPrice = formatShopifyMoney(parseFloat(line.merchandise.price.amount), itemCurrency);
        const lineTotal = formatShopifyMoney(parseFloat(line.cost.totalAmount.amount), line.cost.totalAmount.currencyCode || itemCurrency);
        const handle = line.merchandise.product.handle;

        const attributesHtml = line.attributes && line.attributes.length > 0
          ? `<div class="mt-1 space-y-0.5 text-[11px] text-neutral-500 font-normal">
              ${line.attributes.map(a => `<div><span class="font-semibold text-neutral-700">${a.key}:</span> ${a.value}</div>`).join('')}
             </div>`
          : '';

        return `
          <div class="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0 group" data-line-id="${line.id}">
            <a href="/product.html?handle=${handle}" class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gray-50 flex items-center justify-center p-2 overflow-hidden flex-shrink-0 border border-gray-100 hover:opacity-90 transition">
              <img src="${itemImg}" alt="${itemTitle}" class="w-full h-full object-contain">
            </a>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start gap-2">
                <a href="/product.html?handle=${handle}" class="text-xs sm:text-sm font-bold text-neutral-900 hover:text-[#ff4d61] transition line-clamp-1">
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
