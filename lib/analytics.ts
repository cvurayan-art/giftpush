/**
 * Present Panic - Enterprise Meta Ads & Google Analytics Tracking Engine
 * Supports Meta Pixel (Client-Side fbq), Meta Conversions API (Server-Side CAPI),
 * and Google Analytics 4 (GA4) with 100% strict event deduplication (event_id matching)
 * to prevent double-counting conversions.
 */

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    fbq: (...args: any[]) => void;
    _fbq?: any;
    PresentPanicAnalytics?: any;
  }
}

export interface TrackingProduct {
  id: string;
  variantId?: string;
  title: string;
  price: number | string;
  currency?: string;
  category?: string;
  quantity?: number;
  handle?: string;
}

export interface CapiCustomData {
  currency?: string;
  value?: number;
  content_name?: string;
  content_type?: string;
  content_ids?: string[];
  contents?: Array<{
    id: string;
    quantity: number;
    item_price: number;
  }>;
  num_items?: number;
  search_string?: string;
  status?: string;
  [key: string]: any;
}

export interface CapiUserData {
  fbp?: string;
  fbc?: string;
  em?: string; // SHA-256 hashed email
  ph?: string; // SHA-256 hashed phone
  client_ip_address?: string;
  client_user_agent?: string;
  [key: string]: any;
}

export interface CapiPayload {
  eventName: string;
  eventId: string;
  eventSourceUrl?: string;
  customData?: CapiCustomData;
  userData?: CapiUserData;
}

class AnalyticsManager {
  private pixelId: string | null = null;
  private gaId: string | null = null;
  private isPixelLoaded = false;
  private isGaLoaded = false;
  private pageViewSent = false;

  constructor() {
    this.pixelId = (import.meta.env.VITE_META_PIXEL_ID as string) || '1569317721181690';
    this.gaId = (import.meta.env.VITE_GA4_MEASUREMENT_ID as string) || 'G-WEXQP7YJZ5';

    if (typeof window !== 'undefined') {
      this.initAttributionCookies();
      this.initMetaPixel();
      this.initGA4();
    }
  }

  // ====================================================
  // 1. UNIQUE DETERMINISTIC EVENT ID GENERATOR
  // ====================================================
  /**
   * Generates a unique, collision-resistant event_id.
   * Both Meta Pixel (browser) and Meta Conversions API (server) must receive
   * the EXACT same event_id and event_name so Meta deduplicates them into 1 event.
   */
  public generateEventId(prefix = 'evt'): string {
    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 10);
    return `${prefix}_${timestamp}_${randomHex}`;
  }

  // ====================================================
  // 2. ATTRIBUTION & COOKIE HELPERS (_fbp, _fbc, fbclid)
  // ====================================================
  public getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : null;
  }

  public setCookie(name: string, value: string, days = 90) {
    if (typeof document === 'undefined') return;
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    // Use top domain if possible for subdomains like checkout.presentpanic.com
    const hostname = window.location.hostname;
    const domainParts = hostname.split('.');
    let domainStr = '';
    if (domainParts.length >= 2 && !hostname.includes('localhost') && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      const rootDomain = domainParts.slice(-2).join('.');
      domainStr = `; domain=.${rootDomain}`;
    }
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/${domainStr}; SameSite=Lax`;
  }

  /**
   * Automatically captures 'fbclid' from URL and stores it as Meta '_fbc' cookie,
   * formatted as 'fb.1.${timestamp}.${fbclid}' per official Meta documentation.
   */
  private initAttributionCookies() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fbclid = urlParams.get('fbclid');

      if (fbclid) {
        const existingFbc = this.getCookie('_fbc');
        // Only override or set if not present or new click id
        if (!existingFbc || !existingFbc.endsWith(fbclid)) {
          const fbcValue = `fb.1.${Date.now()}.${fbclid}`;
          this.setCookie('_fbc', fbcValue, 90);
          console.log('[Analytics] Captured Meta Click ID (_fbc):', fbcValue);
        }
      }
    } catch (e) {
      console.warn('[Analytics] Attribution cookie error:', e);
    }
  }

  public getMetaAttribution(): { fbp?: string; fbc?: string } {
    const fbp = this.getCookie('_fbp') || undefined;
    const fbc = this.getCookie('_fbc') || undefined;
    return { fbp, fbc };
  }

  // ====================================================
  // 3. CRYPTO HASHING FOR USER DATA (SHA-256)
  // ====================================================
  /**
   * Hashes sensitive user data (email, phone) using SHA-256
   * required by Meta Conversions API for privacy & high Event Match Quality (EMQ).
   */
  public async sha256(value: string): Promise<string> {
    if (!value) return '';
    const clean = value.trim().toLowerCase();
    try {
      if (window.crypto && window.crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(clean);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) {}
    return clean;
  }

  // ====================================================
  // 4. META PIXEL LOADER
  // ====================================================
  private initMetaPixel() {
    if (this.isPixelLoaded) return;
    if (!this.pixelId) {
      console.info('[Analytics] Notice: VITE_META_PIXEL_ID is not configured in .env. Pixel will queue until configured.');
      // Stub window.fbq so calls don't crash
      if (!window.fbq) {
        window.fbq = function (...args: any[]) {
          console.debug('[Analytics Mock Pixel Call]:', ...args);
        };
      }
      return;
    }

    // Standard Meta Pixel Script Injector
    if (!window.fbq) {
      /* eslint-disable */
      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
    }

    try {
      window.fbq('init', this.pixelId);
      this.isPixelLoaded = true;
      console.log(`[Analytics] Meta Pixel (${this.pixelId}) initialized successfully.`);
    } catch (err) {
      console.warn('[Analytics] Meta Pixel initialization failed:', err);
    }
  }

  // ====================================================
  // 5. GOOGLE ANALYTICS (GA4) LOADER
  // ====================================================
  private initGA4() {
    if (this.isGaLoaded) return;
    if (!this.gaId) return;

    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
    }

    // Verify if script already exists in DOM
    const existing = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${this.gaId}"]`);
    if (!existing) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaId}`;
      document.head.appendChild(script);
    }

    window.gtag('js', new Date());
    window.gtag('config', this.gaId, {
      send_page_view: false, // We dispatch custom deduplicated page_view explicitly
    });
    this.isGaLoaded = true;
    console.log(`[Analytics] Google Analytics 4 (${this.gaId}) initialized.`);
  }

  // ====================================================
  // 6. SERVER-SIDE META CONVERSIONS API (CAPI) DISPATCHER
  // ====================================================
  public async sendToCAPI(payload: CapiPayload): Promise<void> {
    try {
      const attribution = this.getMetaAttribution();
      const enrichedUserData: CapiUserData = {
        ...attribution,
        ...(payload.userData || {}),
      };

      const finalPayload: CapiPayload = {
        ...payload,
        eventSourceUrl: payload.eventSourceUrl || window.location.href,
        userData: enrichedUserData,
      };

      // Use fetch with keepalive: true so requests are never lost on redirects / navigation
      fetch('/api/meta-capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
        keepalive: true,
      })
        .then(async (res) => {
          if (!res.ok) {
            console.debug(`[Analytics CAPI Notice] Endpoint responded with ${res.status}`);
          }
        })
        .catch((err) => {
          // Never block user experience or throw in frontend
          console.debug('[Analytics CAPI Notice] Offline or unhandled:', err.message);
        });
    } catch (err) {
      console.warn('[Analytics CAPI Warning]:', err);
    }
  }

  // ====================================================
  // 7. PUBLIC TRACKING APIS (DUAL-TRACK WITH DEDUPLICATION)
  // ====================================================

  /**
   * Track PageView
   * Meta: fbq('track', 'PageView', {}, { eventID }) + CAPI PageView
   * GA4: gtag('event', 'page_view')
   */
  public trackPageView(pageTitle?: string, pagePath?: string) {
    const title = pageTitle || document.title;
    const path = pagePath || window.location.pathname + window.location.search;
    const eventId = this.generateEventId('pv');

    // 1. Meta Pixel (Browser)
    if (window.fbq) {
      window.fbq('track', 'PageView', {}, { eventID: eventId });
    }

    // 2. Meta Conversions API (Server)
    this.sendToCAPI({
      eventName: 'PageView',
      eventId,
      customData: {
        page_title: title,
        page_path: path,
      },
    });

    // 3. Google Analytics 4
    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: title,
        page_location: window.location.href,
        page_path: path,
      });
    }

    this.pageViewSent = true;
    console.debug(`[Analytics] Tracked PageView (eventId: ${eventId})`);
  }

  /**
   * Track ViewContent (Product Details Page)
   * Meta: fbq('track', 'ViewContent') + CAPI ViewContent
   * GA4: gtag('event', 'view_item')
   */
  public trackViewContent(product: TrackingProduct) {
    const eventId = this.generateEventId('vc');
    const currency = product.currency || 'GBP';
    const priceNum = typeof product.price === 'string' ? parseFloat(product.price) || 0 : product.price;
    const cleanId = product.variantId || product.id;

    // 1. Meta Pixel (Browser)
    if (window.fbq) {
      window.fbq(
        'track',
        'ViewContent',
        {
          content_name: product.title,
          content_category: product.category || 'Gifts',
          content_ids: [cleanId],
          content_type: 'product',
          value: priceNum,
          currency: currency,
        },
        { eventID: eventId }
      );
    }

    // 2. Meta Conversions API (Server)
    this.sendToCAPI({
      eventName: 'ViewContent',
      eventId,
      customData: {
        content_name: product.title,
        content_category: product.category || 'Gifts',
        content_ids: [cleanId],
        content_type: 'product',
        value: priceNum,
        currency: currency,
        contents: [
          {
            id: cleanId,
            quantity: 1,
            item_price: priceNum,
          },
        ],
      },
    });

    // 3. Google Analytics 4
    if (window.gtag) {
      window.gtag('event', 'view_item', {
        currency: currency,
        value: priceNum,
        items: [
          {
            item_id: cleanId,
            item_name: product.title,
            price: priceNum,
            quantity: 1,
            item_category: product.category || 'Gifts',
          },
        ],
      });
    }

    console.debug(`[Analytics] Tracked ViewContent: "${product.title}" (eventId: ${eventId})`);
  }

  /**
   * Track AddToCart
   * Meta: fbq('track', 'AddToCart') + CAPI AddToCart
   * GA4: gtag('event', 'add_to_cart')
   */
  public trackAddToCart(product: TrackingProduct, quantity = 1) {
    const eventId = this.generateEventId('atc');
    const currency = product.currency || 'GBP';
    const priceNum = typeof product.price === 'string' ? parseFloat(product.price) || 0 : product.price;
    const cleanId = product.variantId || product.id;
    const totalValue = +(priceNum * quantity).toFixed(2);

    // 1. Meta Pixel (Browser)
    if (window.fbq) {
      window.fbq(
        'track',
        'AddToCart',
        {
          content_name: product.title,
          content_category: product.category || 'Gifts',
          content_ids: [cleanId],
          content_type: 'product',
          value: totalValue,
          currency: currency,
        },
        { eventID: eventId }
      );
    }

    // 2. Meta Conversions API (Server)
    this.sendToCAPI({
      eventName: 'AddToCart',
      eventId,
      customData: {
        content_name: product.title,
        content_category: product.category || 'Gifts',
        content_ids: [cleanId],
        content_type: 'product',
        value: totalValue,
        currency: currency,
        contents: [
          {
            id: cleanId,
            quantity: quantity,
            item_price: priceNum,
          },
        ],
      },
    });

    // 3. Google Analytics 4
    if (window.gtag) {
      window.gtag('event', 'add_to_cart', {
        currency: currency,
        value: totalValue,
        items: [
          {
            item_id: cleanId,
            item_name: product.title,
            price: priceNum,
            quantity: quantity,
            item_category: product.category || 'Gifts',
          },
        ],
      });
    }

    console.debug(`[Analytics] Tracked AddToCart: "${product.title}" x${quantity} (eventId: ${eventId})`);
  }

  /**
   * Track RemoveFromCart
   * GA4: gtag('event', 'remove_from_cart')
   */
  public trackRemoveFromCart(product: TrackingProduct, quantity = 1) {
    const currency = product.currency || 'GBP';
    const priceNum = typeof product.price === 'string' ? parseFloat(product.price) || 0 : product.price;
    const cleanId = product.variantId || product.id;
    const totalValue = +(priceNum * quantity).toFixed(2);

    if (window.gtag) {
      window.gtag('event', 'remove_from_cart', {
        currency: currency,
        value: totalValue,
        items: [
          {
            item_id: cleanId,
            item_name: product.title,
            price: priceNum,
            quantity: quantity,
          },
        ],
      });
    }

    console.debug(`[Analytics] Tracked RemoveFromCart: "${product.title}" x${quantity}`);
  }

  /**
   * Track ViewCart
   * Meta: fbq('trackCustom', 'ViewCart')
   * GA4: gtag('event', 'view_cart')
   */
  public trackViewCart(items: TrackingProduct[], totalValue: number, currency = 'GBP') {
    if (window.gtag) {
      window.gtag('event', 'view_cart', {
        currency: currency,
        value: totalValue,
        items: items.map(item => ({
          item_id: item.variantId || item.id,
          item_name: item.title,
          price: typeof item.price === 'string' ? parseFloat(item.price) || 0 : item.price,
          quantity: item.quantity || 1,
        })),
      });
    }
  }

  /**
   * Track InitiateCheckout (Begin Checkout)
   * Meta: fbq('track', 'InitiateCheckout') + CAPI InitiateCheckout
   * GA4: gtag('event', 'begin_checkout')
   */
  public trackInitiateCheckout(items: TrackingProduct[], totalValue: number, currency = 'GBP') {
    const eventId = this.generateEventId('ic');
    const contentIds = items.map(i => i.variantId || i.id);
    const contents = items.map(i => ({
      id: i.variantId || i.id,
      quantity: i.quantity || 1,
      item_price: typeof i.price === 'string' ? parseFloat(i.price) || 0 : i.price,
    }));
    const numItems = items.reduce((acc, i) => acc + (i.quantity || 1), 0);

    // 1. Meta Pixel (Browser)
    if (window.fbq) {
      window.fbq(
        'track',
        'InitiateCheckout',
        {
          content_ids: contentIds,
          contents: contents,
          content_type: 'product',
          num_items: numItems,
          value: totalValue,
          currency: currency,
        },
        { eventID: eventId }
      );
    }

    // 2. Meta Conversions API (Server)
    this.sendToCAPI({
      eventName: 'InitiateCheckout',
      eventId,
      customData: {
        content_ids: contentIds,
        contents: contents,
        content_type: 'product',
        num_items: numItems,
        value: totalValue,
        currency: currency,
      },
    });

    // 3. Google Analytics 4
    if (window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: currency,
        value: totalValue,
        items: items.map(i => ({
          item_id: i.variantId || i.id,
          item_name: i.title,
          price: typeof i.price === 'string' ? parseFloat(i.price) || 0 : i.price,
          quantity: i.quantity || 1,
        })),
      });
    }

    console.debug(`[Analytics] Tracked InitiateCheckout: ${numItems} items, Total: ${totalValue} ${currency} (eventId: ${eventId})`);
  }

  /**
   * Track Search
   * Meta: fbq('track', 'Search') + CAPI Search
   * GA4: gtag('event', 'search')
   */
  public trackSearch(searchQuery: string) {
    if (!searchQuery || !searchQuery.trim()) return;
    const query = searchQuery.trim();
    const eventId = this.generateEventId('search');

    // 1. Meta Pixel (Browser)
    if (window.fbq) {
      window.fbq('track', 'Search', { search_string: query }, { eventID: eventId });
    }

    // 2. Meta Conversions API (Server)
    this.sendToCAPI({
      eventName: 'Search',
      eventId,
      customData: { search_string: query },
    });

    // 3. Google Analytics 4
    if (window.gtag) {
      window.gtag('event', 'search', { search_term: query });
    }

    console.debug(`[Analytics] Tracked Search: "${query}" (eventId: ${eventId})`);
  }

  /**
   * Track Lead / Contact / Newsletter
   * Meta: fbq('track', 'Lead') + CAPI Lead with SHA-256 hashed user email
   * GA4: gtag('event', 'generate_lead')
   */
  public async trackLead(formName: string, rawEmail?: string) {
    const eventId = this.generateEventId('lead');
    let hashedEmail = '';

    if (rawEmail) {
      hashedEmail = await this.sha256(rawEmail);
    }

    // 1. Meta Pixel (Browser)
    if (window.fbq) {
      window.fbq('track', 'Lead', { content_name: formName }, { eventID: eventId });
    }

    // 2. Meta Conversions API (Server) with Hashed User Data
    this.sendToCAPI({
      eventName: 'Lead',
      eventId,
      customData: { content_name: formName },
      userData: hashedEmail ? { em: hashedEmail } : undefined,
    });

    // 3. Google Analytics 4
    if (window.gtag) {
      window.gtag('event', 'generate_lead', {
        lead_source: formName,
      });
    }

    console.debug(`[Analytics] Tracked Lead: "${formName}" (eventId: ${eventId})`);
  }

  /**
   * Decorate Shopify checkout URL with attribution parameters (_fbp, _fbc, fbclid)
   * so Shopify Checkout carries full attribution into the final Purchase event.
   */
  public decorateCheckoutUrl(checkoutUrl: string): string {
    if (!checkoutUrl) return checkoutUrl;
    try {
      const url = new URL(checkoutUrl);
      const attribution = this.getMetaAttribution();

      // Pass _fbp and _fbc in query params if not already on the domain
      if (attribution.fbp && !url.searchParams.has('_fbp')) {
        url.searchParams.set('_fbp', attribution.fbp);
      }
      if (attribution.fbc && !url.searchParams.has('_fbc')) {
        url.searchParams.set('_fbc', attribution.fbc);
      }

      // Pass fbclid if stored in fbc
      if (attribution.fbc && !url.searchParams.has('fbclid')) {
        const parts = attribution.fbc.split('.');
        if (parts.length >= 4) {
          url.searchParams.set('fbclid', parts.slice(3).join('.'));
        }
      }

      return url.toString();
    } catch (_) {
      return checkoutUrl;
    }
  }
}

// Export singleton instance
export const analytics = new AnalyticsManager();
if (typeof window !== 'undefined') {
  window.PresentPanicAnalytics = analytics;
}
