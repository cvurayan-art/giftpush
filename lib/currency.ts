/**
 * Present Panic - Dual-Market & Multi-Currency Engine (UK 🇬🇧 & USA 🇺🇸)
 * Handles automatic IP/Timezone country detection, instant currency conversion,
 * Shopify Markets @inContext synchronization, and persistent customer preference.
 */

export type MarketCode = 'GB' | 'US';
export type CurrencyCode = 'GBP' | 'USD';

export interface MarketConfig {
  code: MarketCode;
  countryName: string;
  currency: CurrencyCode;
  symbol: string;
  flag: string;
  rateFromGBP: number; // Conversion rate relative to GBP
}

export const MARKETS: Record<MarketCode, MarketConfig> = {
  GB: {
    code: 'GB',
    countryName: 'United Kingdom',
    currency: 'GBP',
    symbol: '£',
    flag: '🇬🇧',
    rateFromGBP: 1.0,
  },
  US: {
    code: 'US',
    countryName: 'United States',
    currency: 'USD',
    symbol: '$',
    flag: '🇺🇸',
    rateFromGBP: 1.30, // 1 GBP ≈ 1.30 USD baseline (refreshes dynamically)
  },
};

const MARKET_STORAGE_KEY = 'present_panic_selected_market';
const RATES_STORAGE_KEY = 'present_panic_fx_rates';

let activeMarketCode: MarketCode = 'GB';

/**
 * Synchronous initial market resolution (0ms, no flash)
 */
function resolveInitialMarket(): MarketCode {
  if (typeof window === 'undefined') return 'GB';

  // 1. Explicit user selection
  const saved = localStorage.getItem(MARKET_STORAGE_KEY) as MarketCode | null;
  if (saved && (saved === 'GB' || saved === 'US')) {
    return saved;
  }

  // 2. Instant timezone heuristic
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (
      tz.includes('London') ||
      tz.includes('Belfast') ||
      tz.includes('Europe/Jersey') ||
      tz.includes('Europe/Guernsey')
    ) {
      return 'GB';
    }
    if (
      tz.includes('America') ||
      tz.includes('US') ||
      tz.includes('New_York') ||
      tz.includes('Los_Angeles') ||
      tz.includes('Chicago') ||
      tz.includes('Denver') ||
      tz.includes('Honolulu') ||
      tz.includes('Anchorage')
    ) {
      return 'US';
    }
  } catch (_) {}

  // 3. Browser locale check
  try {
    const lang = (navigator.language || '').toLowerCase();
    if (lang.includes('en-gb') || lang.includes('en-uk')) {
      return 'GB';
    }
    if (lang.includes('en-us')) {
      return 'US';
    }
  } catch (_) {}

  // Default to UK base market
  return 'GB';
}

activeMarketCode = resolveInitialMarket();

// Load cached live exchange rates if available
if (typeof window !== 'undefined') {
  try {
    const cachedRates = localStorage.getItem(RATES_STORAGE_KEY);
    if (cachedRates) {
      const parsed = JSON.parse(cachedRates);
      if (parsed.USD && typeof parsed.USD === 'number') {
        MARKETS.US.rateFromGBP = parsed.USD;
      }
    }
  } catch (_) {}
}

/**
 * Asynchronously refines location via IP Geolocation in background
 */
export async function initGeoMarketDetection(): Promise<MarketCode> {
  if (typeof window === 'undefined') return activeMarketCode;

  // If user explicitly chose market previously, honor their choice
  const manualChoice = localStorage.getItem(MARKET_STORAGE_KEY);
  if (manualChoice && (manualChoice === 'GB' || manualChoice === 'US')) {
    activeMarketCode = manualChoice as MarketCode;
    refreshExchangeRates();
    return activeMarketCode;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch('https://api.country.is', { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const country = (data.country || '').toUpperCase();
      const detected: MarketCode = country === 'GB' ? 'GB' : 'US';

      if (detected !== activeMarketCode) {
        activeMarketCode = detected;
        localStorage.setItem(MARKET_STORAGE_KEY, detected);
        dispatchMarketChange();
      }
    }
  } catch (_) {
    // Fallback stays as resolved from timezone/locale
  }

  refreshExchangeRates();
  return activeMarketCode;
}

/**
 * Fetch latest GBP/USD exchange rate in background
 */
async function refreshExchangeRates() {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/GBP');
    if (res.ok) {
      const data = await res.json();
      if (data.rates && data.rates.USD) {
        MARKETS.US.rateFromGBP = data.rates.USD;
        localStorage.setItem(
          RATES_STORAGE_KEY,
          JSON.stringify({ USD: data.rates.USD, time: Date.now() })
        );
      }
    }
  } catch (_) {}
}

/**
 * Get currently active Market config (GB or US)
 */
export function getActiveMarket(): MarketConfig {
  return MARKETS[activeMarketCode] || MARKETS.GB;
}

/**
 * Get active country code for Shopify @inContext
 */
export function getActiveCountryCode(): MarketCode {
  return activeMarketCode;
}

/**
 * Switch active market (e.g. user toggles dropdown)
 */
export function setActiveMarket(market: MarketCode) {
  if (market !== 'GB' && market !== 'US') return;
  if (activeMarketCode === market) return;

  activeMarketCode = market;
  if (typeof window !== 'undefined') {
    localStorage.setItem(MARKET_STORAGE_KEY, market);
    // Clear Shopify cached products so they refresh with the new country context
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('pp_cache_') || key.startsWith('present_panic_shopify_cart'))) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}
  }

  dispatchMarketChange();
}

function dispatchMarketChange() {
  if (typeof window === 'undefined') return;
  const config = getActiveMarket();
  window.dispatchEvent(new CustomEvent('marketChange', { detail: { market: activeMarketCode, config } }));
}

/**
 * Converts and formats money according to current market
 */
export function formatCurrency(amount: number | string, sourceCurrency = 'GBP'): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || '0');
  const market = getActiveMarket();

  // If source currency is already matching active market, format directly
  if (sourceCurrency.toUpperCase() === market.currency) {
    return `${market.symbol}${num.toFixed(2)}`;
  }

  // Convert from GBP to USD
  if (sourceCurrency.toUpperCase() === 'GBP' && market.currency === 'USD') {
    const converted = num * market.rateFromGBP;
    return `${market.symbol}${converted.toFixed(2)}`;
  }

  // Convert from USD to GBP
  if (sourceCurrency.toUpperCase() === 'USD' && market.currency === 'GBP') {
    const converted = num / MARKETS.US.rateFromGBP;
    return `${market.symbol}${converted.toFixed(2)}`;
  }

  return `${market.symbol}${num.toFixed(2)}`;
}

/**
 * Converts a raw numeric amount between currencies
 */
export function convertAmount(amount: number, sourceCurrency = 'GBP'): number {
  const market = getActiveMarket();
  if (sourceCurrency.toUpperCase() === market.currency) return amount;
  if (sourceCurrency.toUpperCase() === 'GBP' && market.currency === 'USD') {
    return +(amount * market.rateFromGBP).toFixed(2);
  }
  if (sourceCurrency.toUpperCase() === 'USD' && market.currency === 'GBP') {
    return +(amount / MARKETS.US.rateFromGBP).toFixed(2);
  }
  return amount;
}
