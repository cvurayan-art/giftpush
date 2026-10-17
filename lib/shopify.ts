/**
 * Present Panic - Shopify Storefront API Client
 * Ultra-Fast Headless Architecture using Shopify Storefront GraphQL API
 * Features Multi-Tier SWR Caching (Memory + LocalStorage), In-Flight Request Deduplication,
 * Cross-Query Product Indexing, and Instant 0ms Pre-seeding
 */

import { getActiveCountryCode, formatCurrency } from './currency';

export interface ShopifyImage {
  url: string;
  altText?: string;
  width?: number;
  height?: number;
}

export interface ShopifyMoney {
  amount: string;
  currencyCode: string;
}

export interface ShopifySelectedOption {
  name: string;
  value: string;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  sku?: string;
  availableForSale: boolean;
  price: ShopifyMoney;
  compareAtPrice?: ShopifyMoney | null;
  selectedOptions: ShopifySelectedOption[];
  image?: ShopifyImage | null;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml?: string;
  vendor: string;
  productType: string;
  tags: string[];
  availableForSale: boolean;
  priceRange: {
    minVariantPrice: ShopifyMoney;
    maxVariantPrice: ShopifyMoney;
  };
  compareAtPriceRange?: {
    minVariantPrice: ShopifyMoney;
  } | null;
  featuredImage?: ShopifyImage | null;
  images: {
    nodes: ShopifyImage[];
  };
  variants: {
    nodes: ShopifyVariant[];
  };
  options: {
    name: string;
    values: string[];
  }[];
  _isFallback?: boolean;
}

export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  description?: string;
  image?: ShopifyImage | null;
  productsCount?: number;
}

export interface ShopifyCartLine {
  id: string;
  quantity: number;
  cost: {
    totalAmount: ShopifyMoney;
    subtotalAmount: ShopifyMoney;
  };
  merchandise: {
    id: string;
    title: string;
    product: {
      id: string;
      title: string;
      handle: string;
      featuredImage?: ShopifyImage | null;
    };
    price: ShopifyMoney;
    compareAtPrice?: ShopifyMoney | null;
    image?: ShopifyImage | null;
    selectedOptions: ShopifySelectedOption[];
  };
  attributes?: { key: string; value: string }[];
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: ShopifyMoney;
    totalAmount: ShopifyMoney;
    totalTaxAmount?: ShopifyMoney | null;
    totalDutyAmount?: ShopifyMoney | null;
  };
  discountCodes?: { code: string; applicable: boolean }[];
  discountAllocations?: { discountedAmount: ShopifyMoney }[];
  lines: {
    nodes: ShopifyCartLine[];
  };
}

// ----------------------------------------------------
// Environment Configuration
// ----------------------------------------------------
const STORE_DOMAIN = (import.meta as any).env?.VITE_SHOPIFY_STORE_DOMAIN || '';
const STOREFRONT_TOKEN = (import.meta as any).env?.VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN || '';
const API_VERSION = (import.meta as any).env?.VITE_SHOPIFY_API_VERSION || '2024-07';

export const isShopifyConfigured = (): boolean => {
  return Boolean(
    STORE_DOMAIN &&
    STOREFRONT_TOKEN &&
    !STORE_DOMAIN.includes('your-store-name') &&
    !STOREFRONT_TOKEN.includes('your_storefront_access_token')
  );
};

export function formatVariantGid(id: string): string {
  if (!id) return '';
  if (id.startsWith('gid://shopify/ProductVariant/')) return id;
  const digits = id.replace(/[^0-9]/g, '');
  if (digits) return `gid://shopify/ProductVariant/${digits}`;
  return id;
}

// ----------------------------------------------------
// Multi-Tier SWR (Stale-While-Revalidate) Cache Engine
// ----------------------------------------------------
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const MEMORY_CACHE = new Map<string, CacheItem<any>>();
const IN_FLIGHT_PROMISES = new Map<string, Promise<any>>();

const CACHE_FRESH_MS = 15 * 60 * 1000; // 15 minutes fresh
const CACHE_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days stale allowance

// Clean legacy cache keys on load
if (typeof window !== 'undefined') {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('pp_cache_v1_') || k.startsWith('pp_cache_v2_') || k.startsWith('pp_cache_v3_'))) {
        localStorage.removeItem(k);
      }
    }
  } catch (_) {}
}

export function getCachedData<T>(key: string): { data: T; isStale: boolean } | null {
  const now = Date.now();
  // 1. In-memory check (0ms)
  const mem = MEMORY_CACHE.get(key);
  if (mem) {
    const age = now - mem.timestamp;
    if (age < CACHE_FRESH_MS) return { data: mem.data, isStale: false };
    if (age < CACHE_MAX_STALE_MS) return { data: mem.data, isStale: true };
  }
  // 2. LocalStorage check (0ms)
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`pp_cache_v4_${key}`);
      if (raw) {
        const item: CacheItem<T> = JSON.parse(raw);
        MEMORY_CACHE.set(key, item);
        const age = now - item.timestamp;
        if (age < CACHE_FRESH_MS) return { data: item.data, isStale: false };
        if (age < CACHE_MAX_STALE_MS) return { data: item.data, isStale: true };
      }
    } catch (_) {}
  }
  return null;
}

export function setCachedData<T>(key: string, data: T): void {
  const item: CacheItem<T> = { data, timestamp: Date.now() };
  MEMORY_CACHE.set(key, item);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`pp_cache_v4_${key}`, JSON.stringify(item));
    } catch (_) {}
  }
}

export function dedupeRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (IN_FLIGHT_PROMISES.has(key)) {
    return IN_FLIGHT_PROMISES.get(key) as Promise<T>;
  }
  const promise = fetcher().finally(() => {
    IN_FLIGHT_PROMISES.delete(key);
  });
  IN_FLIGHT_PROMISES.set(key, promise);
  return promise;
}

/**
 * Indexes individual products from lists so PDP navigation renders in 0ms
 */
export function indexProductsInCache(products: ShopifyProduct[]): void {
  if (!products || !Array.isArray(products)) return;
  for (const p of products) {
    if (p && p.handle) {
      setCachedData(`product_handle_${p.handle}`, p);
    }
    if (p && p.id) {
      setCachedData(`product_id_${p.id}`, p);
    }
  }
}

// ----------------------------------------------------
// GraphQL Execution with 6-second timeout
// ----------------------------------------------------
export async function shopifyFetch<T>({
  query,
  variables = {},
  timeoutMs = 6000,
}: {
  query: string;
  variables?: Record<string, any>;
  timeoutMs?: number;
}): Promise<T> {
  if (!isShopifyConfigured()) {
    throw new Error('Shopify credentials not configured in environment variables.');
  }

  const endpoint = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API Error (${response.status}): ${errorText}`);
    }

    const json = await response.json();
    if (json.errors && json.errors.length > 0) {
      throw new Error(`Shopify GraphQL Error: ${json.errors[0].message}`);
    }

    return json.data as T;
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

// ----------------------------------------------------
// GraphQL Fragments
// ----------------------------------------------------

const PRODUCT_FRAGMENT = `
  id
  title
  handle
  description
  descriptionHtml
  vendor
  productType
  tags
  availableForSale
  priceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  compareAtPriceRange {
    minVariantPrice { amount currencyCode }
  }
  featuredImage {
    url
    altText
    width
    height
  }
  images(first: 8) {
    nodes {
      url
      altText
      width
      height
    }
  }
  variants(first: 30) {
    nodes {
      id
      title
      sku
      availableForSale
      price { amount currencyCode }
      compareAtPrice { amount currencyCode }
      selectedOptions { name value }
      image { url altText }
    }
  }
  options {
    name
    values
  }
`;

const CART_FRAGMENT = `
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount { amount currencyCode }
    totalAmount { amount currencyCode }
    totalTaxAmount { amount currencyCode }
  }
  discountCodes {
    code
    applicable
  }
  discountAllocations {
    discountedAmount { amount currencyCode }
  }
  lines(first: 50) {
    nodes {
      id
      quantity
      cost {
        totalAmount { amount currencyCode }
        subtotalAmount { amount currencyCode }
      }
      merchandise {
        ... on ProductVariant {
          id
          title
          sku
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          image { url altText }
          selectedOptions { name value }
          product {
            id
            title
            handle
            featuredImage { url altText }
          }
        }
      }
      attributes {
        key
        value
      }
    }
  }
`;

// ----------------------------------------------------
// Currency Formatting Helper
// ----------------------------------------------------
export function formatShopifyMoney(amount: string | number, currencyCode = 'GBP'): string {
  return formatCurrency(amount, currencyCode);
}

// ----------------------------------------------------
// Public High-Speed API Methods with SWR Caching
// ----------------------------------------------------

export function prioritizeHeroProduct(products: ShopifyProduct[]): ShopifyProduct[] {
  if (!products || !Array.isArray(products)) return products;
  const list = [...products];
  const idx = list.findIndex(p => p.handle === 'diy-crochet-cat-bed-kit' || p.title.toLowerCase().includes('cat bed'));
  if (idx > 0) {
    const [catBed] = list.splice(idx, 1);
    list.unshift(catBed);
  }
  return list;
}

async function fetchProductsFromShopify(options: {
  first?: number;
  query?: string;
  sortKey?: string;
  reverse?: boolean;
}, cacheKey: string): Promise<ShopifyProduct[]> {
  const targetFirst = options.first || 250;
  const batchSize = Math.min(targetFirst, 250);

  let allNodes: ShopifyProduct[] = [];
  let hasNext = true;
  let cursor: string | null = null;

  try {
    while (hasNext && allNodes.length < targetFirst) {
      const remaining = targetFirst - allNodes.length;
      const currentBatch = Math.min(remaining, batchSize);

      const country = getActiveCountryCode();
      const query = `
        query GetProducts($first: Int!, $after: String, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean, $country: CountryCode) @inContext(country: $country) {
          products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              ${PRODUCT_FRAGMENT}
            }
          }
        }
      `;

      const data = await shopifyFetch<{
        products: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: ShopifyProduct[];
        };
      }>({
        query,
        variables: {
          first: currentBatch,
          after: cursor,
          query: options.query || null,
          sortKey: options.sortKey || 'BEST_SELLING',
          reverse: options.reverse || false,
          country,
        },
      });

      if (data.products?.nodes && data.products.nodes.length > 0) {
        allNodes.push(...data.products.nodes);
      }

      hasNext = Boolean(data.products?.pageInfo?.hasNextPage);
      cursor = data.products?.pageInfo?.endCursor || null;

      if (!cursor || !hasNext) break;
    }

    if (allNodes.length > 0) {
      const sorted = (!options.query || options.query === '') ? prioritizeHeroProduct(allNodes) : allNodes;
      setCachedData(cacheKey, sorted);
      indexProductsInCache(sorted);
      return sorted;
    }
    if (options.query) {
      return [];
    }
    return getFallbackProducts();
  } catch (err) {
    console.warn('[Shopify] Falling back to catalog:', err);
    return getFallbackProducts(options.query);
  }
}

/**
 * Fetch products list with instant SWR cache return
 */
export async function getShopifyProducts(options: {
  first?: number;
  query?: string;
  sortKey?: string;
  reverse?: boolean;
} = {}): Promise<ShopifyProduct[]> {
  const first = options.first || 250;
  const sortKey = options.sortKey || 'BEST_SELLING';
  const reverse = options.reverse || false;
  const queryFilter = options.query || '';
  const country = getActiveCountryCode();
  const cacheKey = `products_${country}_${first}_${queryFilter}_${sortKey}_${reverse}`;

  if (!isShopifyConfigured()) {
    return getFallbackProducts(options.query);
  }

  // 1. Fast Cache Hit (0ms)
  const cached = getCachedData<ShopifyProduct[]>(cacheKey);
  if (cached && cached.data && cached.data.length > 0 && !(cached.data[0] as any)?._isFallback) {
    const sorted = (!queryFilter) ? prioritizeHeroProduct(cached.data) : cached.data;
    if (cached.isStale) {
      // Revalidate in background
      dedupeRequest(cacheKey, () => fetchProductsFromShopify(options, cacheKey)).then(fresh => {
        if (fresh && fresh.length > 0) {
          window.dispatchEvent(new CustomEvent('shopify:products:updated', { detail: fresh }));
        }
      }).catch(() => {});
    }
    return sorted;
  }

  return dedupeRequest(cacheKey, () => fetchProductsFromShopify({ ...options, first }, cacheKey));
}

async function fetchProductByHandleFromShopify(handle: string, cacheKey: string): Promise<ShopifyProduct | null> {
  const country = getActiveCountryCode();
  const query = `
    query GetProductByHandle($handle: String!, $country: CountryCode) @inContext(country: $country) {
      product(handle: $handle) {
        ${PRODUCT_FRAGMENT}
      }
    }
  `;

  try {
    const data = await shopifyFetch<{ product: ShopifyProduct | null }>({
      query,
      variables: { handle, country },
    });
    if (data.product) {
      setCachedData(cacheKey, data.product);
      setCachedData(`product_id_${country}_${data.product.id}`, data.product);
      return data.product;
    }
    return getFallbackProducts().find(p => p.handle === handle) || null;
  } catch (err) {
    console.warn('[Shopify] Error fetching product by handle, using fallback:', err);
    return getFallbackProducts().find(p => p.handle === handle) || null;
  }
}

/**
 * Fetch single product details by handle with instant SWR cache return
 */
export async function getShopifyProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  if (!handle) return null;
  const country = getActiveCountryCode();
  const cacheKey = `product_handle_${country}_${handle}`;

  // 1. If Shopify is configured, fetch live product data from Shopify
  if (isShopifyConfigured()) {
    const cached = getCachedData<ShopifyProduct>(cacheKey);
    // Return immediately if cache is fresh and not fallback
    if (cached && cached.data && !cached.isStale && !(cached.data as any)._isFallback) {
      return cached.data;
    }

    try {
      const fresh = await dedupeRequest(cacheKey, () => fetchProductByHandleFromShopify(handle, cacheKey));
      if (fresh) {
        return fresh;
      }
    } catch (err) {
      console.warn('[Shopify] Error fetching product by handle, falling back:', err);
    }

    if (cached && cached.data && !(cached.data as any)._isFallback) {
      return cached.data;
    }
  }

  // 2. Fallback Catalog
  const fallbackMatch = getFallbackProducts().find(p => p.handle === handle);
  if (fallbackMatch) {
    return fallbackMatch;
  }

  return getFallbackProducts()[0] || null;
}

async function fetchCollectionsFromShopify(first: number, cacheKey: string): Promise<ShopifyCollection[]> {
  const query = `
    query GetCollections($first: Int!) {
      collections(first: $first) {
        nodes {
          id
          title
          handle
          description
          image { url altText }
        }
      }
    }
  `;

  try {
    const data = await shopifyFetch<{ collections: { nodes: ShopifyCollection[] } }>({
      query,
      variables: { first },
    });
    const valid = data.collections.nodes.filter(c => c.handle !== 'frontpage');
    const result = valid.length > 0 ? valid : data.collections.nodes;
    const finalCollections = result.length > 0 ? result : getFallbackCollections();
    setCachedData(cacheKey, finalCollections);
    return finalCollections;
  } catch (err) {
    console.warn('[Shopify] Error fetching collections, using fallback:', err);
    return getFallbackCollections();
  }
}

/**
 * Fetch collections list directly from Shopify with instant SWR cache return (0ms)
 */
export async function getShopifyCollections(first = 100): Promise<ShopifyCollection[]> {
  const cacheKey = `collections_${first}`;

  if (isShopifyConfigured()) {
    const cached = getCachedData<ShopifyCollection[]>(cacheKey);
    if (cached && cached.data && !cached.isStale && !(cached.data as any)._isFallback) {
      return cached.data;
    }

    try {
      const fresh = await dedupeRequest(cacheKey, () => fetchCollectionsFromShopify(first, cacheKey));
      if (fresh && fresh.length > 0) {
        return fresh;
      }
    } catch (err) {
      console.warn('[Shopify] Live collections fetch notice:', err);
    }

    if (cached && cached.data) {
      return cached.data;
    }
  }

  return getFallbackCollections();
}

async function fetchCollectionByHandleFromShopify(
  handle: string,
  first: number,
  cacheKey: string
): Promise<{ collection: ShopifyCollection; products: ShopifyProduct[] } | null> {
  const targetFirst = first || 250;
  const batchSize = Math.min(targetFirst, 250);

  const query = `
    query GetCollectionByHandle($handle: String!, $first: Int!) {
      collection(handle: $handle) {
        id
        title
        handle
        description
        image { url altText }
        products(first: $first) {
          nodes {
            ${PRODUCT_FRAGMENT}
          }
        }
      }
    }
  `;

  try {
    const data = await shopifyFetch<{
      collection: (ShopifyCollection & { products: { nodes: ShopifyProduct[] } }) | null;
    }>({
      query,
      variables: { handle, first: batchSize },
    });

    if (data.collection) {
      const result = {
        collection: {
          id: data.collection.id,
          title: data.collection.title,
          handle: data.collection.handle,
          description: data.collection.description,
          image: data.collection.image,
        },
        products: data.collection.products?.nodes || [],
      };
      setCachedData(cacheKey, result);
      indexProductsInCache(result.products);
      return result;
    }

    const col = getFallbackCollections().find(c => c.handle === handle);
    if (col) {
      return { collection: col, products: getFallbackProducts() };
    }
    return null;
  } catch (err) {
    console.warn('[Shopify] Error fetching collection by handle:', err);
    return null;
  }
}

/**
 * Fetch collection by handle with its products and instant SWR cache return
 */
export async function getShopifyCollectionByHandle(
  handle: string,
  first = 250
): Promise<{ collection: ShopifyCollection; products: ShopifyProduct[] } | null> {
  const cacheKey = `collection_${handle}_${first}`;

  if (isShopifyConfigured()) {
    const cached = getCachedData<{ collection: ShopifyCollection; products: ShopifyProduct[] }>(cacheKey);
    if (cached && cached.data && !cached.isStale && !(cached.data as any)._isFallback) {
      return cached.data;
    }

    try {
      const fresh = await dedupeRequest(cacheKey, () => fetchCollectionByHandleFromShopify(handle, first, cacheKey));
      if (fresh) {
        return fresh;
      }
    } catch (err) {
      console.warn('[Shopify] Live collection fetch notice:', err);
    }

    if (cached && cached.data) {
      return cached.data;
    }
  }

  // Fallback
  const col = getFallbackCollections().find(c => c.handle === handle);
  if (col) {
    return { collection: col, products: getFallbackProducts().slice(0, first) };
  }
  return null;
}

/**
 * Search products
 */
export async function searchShopifyProducts(searchQuery: string, first = 10): Promise<ShopifyProduct[]> {
  const cleanQ = searchQuery.trim();
  if (!cleanQ) return [];

  const cacheKey = `search_${cleanQ.toLowerCase()}_${first}`;
  const cached = getCachedData<ShopifyProduct[]>(cacheKey);
  if (cached && cached.data) {
    return cached.data;
  }

  if (isShopifyConfigured()) {
    const query = `
      query SearchProducts($query: String!, $first: Int!) {
        products(first: $first, query: $query) {
          nodes {
            ${PRODUCT_FRAGMENT}
          }
        }
      }
    `;

    try {
      const data = await dedupeRequest(cacheKey, () =>
        shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>({
          query,
          variables: { query: cleanQ, first },
        })
      );
      if (data?.products?.nodes && data.products.nodes.length > 0) {
        setCachedData(cacheKey, data.products.nodes);
        indexProductsInCache(data.products.nodes);
        return data.products.nodes;
      }

      // If exact query gave 0 results, try wildcard
      if (!cleanQ.includes('*')) {
        try {
          const wildcardData = await shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>({
            query,
            variables: { query: `${cleanQ}*`, first },
          });
          if (wildcardData?.products?.nodes && wildcardData.products.nodes.length > 0) {
            setCachedData(cacheKey, wildcardData.products.nodes);
            indexProductsInCache(wildcardData.products.nodes);
            return wildcardData.products.nodes;
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[Shopify] Error searching products, trying catalog fallback:', err);
    }
  }

  // Fallback to catalog filtering
  const all = getFallbackProducts();
  const q = cleanQ.toLowerCase();
  const filtered = all.filter(p =>
    p.title.toLowerCase().includes(q) ||
    (p.description && p.description.toLowerCase().includes(q)) ||
    (p.productType && p.productType.toLowerCase().includes(q)) ||
    (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
  );
  return filtered.slice(0, first);
}

/**
 * Product recommendations
 */
export async function getShopifyProductRecommendations(productId: string): Promise<ShopifyProduct[]> {
  const cacheKey = `recommendations_${productId}`;
  const cached = getCachedData<ShopifyProduct[]>(cacheKey);
  if (cached && cached.data) return cached.data;

  if (!isShopifyConfigured() || !productId.startsWith('gid://shopify/Product/')) {
    return getFallbackProducts().slice(1, 5);
  }

  const query = `
    query GetProductRecommendations($productId: ID!) {
      productRecommendations(productId: $productId) {
        ${PRODUCT_FRAGMENT}
      }
    }
  `;

  try {
    const data = await dedupeRequest(cacheKey, () =>
      shopifyFetch<{ productRecommendations: ShopifyProduct[] }>({
        query,
        variables: { productId },
      })
    );
    const recs = data.productRecommendations || getFallbackProducts().slice(1, 5);
    setCachedData(cacheKey, recs);
    indexProductsInCache(recs);
    return recs;
  } catch (err) {
    console.warn('[Shopify] Error fetching recommendations:', err);
    return getFallbackProducts().slice(1, 5);
  }
}

// ----------------------------------------------------
// Shopify Storefront Cart API
// ----------------------------------------------------

/**
 * Create a new Shopify Cart
 */
export async function shopifyCreateCart(lines: { merchandiseId: string; quantity: number; attributes?: { key: string; value: string }[] }[] = []): Promise<ShopifyCart> {
  if (!isShopifyConfigured()) {
    return createLocalCartMock(lines);
  }

  const country = getActiveCountryCode();
  const query = `
    mutation CartCreate($input: CartInput!, $country: CountryCode) @inContext(country: $country) {
      cartCreate(input: $input) {
        cart {
          ${CART_FRAGMENT}
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyFetch<{ cartCreate: { cart: ShopifyCart; userErrors: { field: string; message: string }[] } }>({
    query,
    variables: { input: { lines }, country },
  });

  if (data.cartCreate.userErrors && data.cartCreate.userErrors.length > 0) {
    throw new Error(data.cartCreate.userErrors[0].message);
  }

  return data.cartCreate.cart;
}

/**
 * Fetch an existing Shopify Cart by ID
 */
export async function shopifyGetCart(cartId: string): Promise<ShopifyCart | null> {
  if (!isShopifyConfigured()) {
    return getLocalCartMock(cartId);
  }

  const query = `
    query GetCart($cartId: ID!) {
      cart(id: $cartId) {
        ${CART_FRAGMENT}
      }
    }
  `;

  try {
    const data = await shopifyFetch<{ cart: ShopifyCart | null }>({
      query,
      variables: { cartId },
    });
    return data.cart;
  } catch (err) {
    console.warn('[Shopify] Failed to fetch cart:', err);
    return null;
  }
}

/**
 * Add items to an existing cart
 */
export async function shopifyCartLinesAdd(
  cartId: string,
  lines: { merchandiseId: string; quantity: number; attributes?: { key: string; value: string }[] }[]
): Promise<ShopifyCart> {
  if (!isShopifyConfigured()) {
    return addLocalCartLinesMock(cartId, lines);
  }

  const query = `
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          ${CART_FRAGMENT}
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyFetch<{ cartLinesAdd: { cart: ShopifyCart; userErrors: { field: string; message: string }[] } }>({
    query,
    variables: { cartId, lines },
  });

  if (data.cartLinesAdd.userErrors && data.cartLinesAdd.userErrors.length > 0) {
    throw new Error(data.cartLinesAdd.userErrors[0].message);
  }

  return data.cartLinesAdd.cart;
}

/**
 * Update quantity of lines in cart
 */
export async function shopifyCartLinesUpdate(
  cartId: string,
  lines: { id: string; quantity: number }[]
): Promise<ShopifyCart> {
  if (!isShopifyConfigured()) {
    return updateLocalCartLinesMock(cartId, lines);
  }

  const query = `
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          ${CART_FRAGMENT}
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyFetch<{ cartLinesUpdate: { cart: ShopifyCart; userErrors: { field: string; message: string }[] } }>({
    query,
    variables: { cartId, lines },
  });

  if (data.cartLinesUpdate.userErrors && data.cartLinesUpdate.userErrors.length > 0) {
    throw new Error(data.cartLinesUpdate.userErrors[0].message);
  }

  return data.cartLinesUpdate.cart;
}

/**
 * Remove lines from cart
 */
export async function shopifyCartLinesRemove(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  if (!isShopifyConfigured()) {
    return removeLocalCartLinesMock(cartId, lineIds);
  }

  const query = `
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          ${CART_FRAGMENT}
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyFetch<{ cartLinesRemove: { cart: ShopifyCart; userErrors: { field: string; message: string }[] } }>({
    query,
    variables: { cartId, lineIds },
  });

  if (data.cartLinesRemove.userErrors && data.cartLinesRemove.userErrors.length > 0) {
    throw new Error(data.cartLinesRemove.userErrors[0].message);
  }

  return data.cartLinesRemove.cart;
}

/**
 * Apply or update discount codes in cart
 */
export async function shopifyCartDiscountCodesUpdate(cartId: string, discountCodes: string[]): Promise<ShopifyCart> {
  if (!isShopifyConfigured()) {
    return applyLocalDiscountCodeMock(cartId, discountCodes);
  }

  const query = `
    mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
      cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
        cart {
          ${CART_FRAGMENT}
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyFetch<{ cartDiscountCodesUpdate: { cart: ShopifyCart; userErrors: { field: string; message: string }[] } }>({
    query,
    variables: { cartId, discountCodes },
  });

  if (data.cartDiscountCodesUpdate.userErrors && data.cartDiscountCodesUpdate.userErrors.length > 0) {
    throw new Error(data.cartDiscountCodesUpdate.userErrors[0].message);
  }

  return data.cartDiscountCodesUpdate.cart;
}

// ====================================================
// REAL STORE PRE-SEEDED DATASET (0ms Instant First Paint)
// Real collections and products from checkout.presentpanic.com
// ====================================================

export const DEFAULT_COLLECTIONS: ShopifyCollection[] = [
  {
    id: "gid://shopify/Collection/703246073937",
    title: "Handmade Gifts",
    handle: "handmade-gifts",
    description: "Curated handmade gifts made with love and unique artisan touches.",
    image: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/collections/Orange_Tabby_in_Cozy_Crochet_Cat_Cave.png?v=1791024224",
      altText: "Handmade Gifts"
    }
  },
  {
    id: "gid://shopify/Collection/703246598225",
    title: "Christmas Gifts",
    handle: "christmas-gifts",
    description: "Festive holiday presents, seasonal ornaments, and cozy winter treats.",
    image: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/collections/Se9dd434f21014d61bf2f70680f69e583P_jpg_220x220q75_jpg.jpg?v=1791025495",
      altText: "Christmas Gifts"
    }
  },
  {
    id: "gid://shopify/Collection/703246827601",
    title: "Clocks",
    handle: "clocks",
    description: "Timeless and aesthetic decorative desk and wall clocks.",
    image: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/collections/S4692b2913e1d4d24b744ba4b8307a8feX_jpg_220x220q75_jpg.jpg?v=1791026049",
      altText: "Clocks"
    }
  },
  {
    id: "gid://shopify/Collection/703246925905",
    title: "Table Lamps",
    handle: "personlized-gifts",
    description: "Warm glow ambient table lamps, crystal globes, and bedside lights.",
    image: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/collections/Sb20fe0704a9d4e309d85723c0a442e2bc_jpg_220x220q75_jpg.jpg?v=1791026180",
      altText: "Table Lamps"
    }
  },
  {
    id: "gid://shopify/Collection/703247056977",
    title: "Personalized Gifts",
    handle: "personalized-gifts",
    description: "Custom engraved and bespoke keepsake gifts tailored for your loved ones.",
    image: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/collections/Sf81211ac5cdf4ad3b79d70d6a9457bb9P_png_220x220_png.jpg?v=1791026626",
      altText: "Personalized Gifts"
    }
  },
  {
    id: "gid://shopify/Collection/703619792977",
    title: "Desk Organizers",
    handle: "desk-organizers",
    description: "Sleek bamboo organizers, catchall trays, and productivity gifts.",
    image: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/collections/Minimalist_Bamboo_Desk_Organizer_Stand.png?v=1791451648",
      altText: "Desk Organizers"
    }
  },
  {
    id: "gid://shopify/Collection/703619858513",
    title: "HomeDecor",
    handle: "homedecor",
    description: "Charming home decorations, macrame hangings, and comforting aesthetic decor.",
    image: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/collections/Pastel_Pink_Rose_Tree_Lamp.png?v=1791451726",
      altText: "HomeDecor"
    }
  },
  {
    id: "gid://shopify/Collection/703619956817",
    title: "Toys",
    handle: "toys",
    description: "Delightful music boxes, whimsical toys, and joyful gifts for all ages.",
    image: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/collections/Miniature_Wooden_Train_Music_Box.png?v=1791451769",
      altText: "Toys"
    }
  }
];

export const DEFAULT_CATALOG_PRODUCTS: ShopifyProduct[] = [
  {
    id: "gid://shopify/Product/16352296370257",
    title: "DIY Crochet Cat Bed Kit",
    handle: "diy-crochet-cat-bed-kit",
    description: "Create a cozy handmade cat hideaway with this adorable DIY crochet cat bed kit, perfect for creative pet lovers. 🧶 Fun & Creative DIY Crochet Project 🐱 Cozy Cat-Shaped Design with Cute Ears 🎁 Perfect Gift for Cat & Crochet Lovers",
    descriptionHtml: "<p>Create a cozy handmade cat hideaway with this adorable DIY crochet cat bed kit, perfect for creative pet lovers.</p>\n<ul>\n<li>🧶 Fun &amp; Creative DIY Crochet Project</li>\n<li>🐱 Cozy Cat-Shaped Design with Cute Ears</li>\n<li>🎁 Perfect Gift for Cat &amp; Crochet Lovers</li>\n</ul>",
    vendor: "Present Panic",
    productType: "Handmade & Crafts",
    tags: ["cat bed", "diy", "crochet", "pet", "handmade", "cozy", "gift", "crafts"],
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: "77.99", currencyCode: "GBP" },
      maxVariantPrice: { amount: "77.99", currencyCode: "GBP" }
    },
    compareAtPriceRange: null,
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/CozyGrayCatCavewithKitten.png?v=1791363758",
      altText: "DIY Crochet Cat Bed Kit"
    },
    images: {
      nodes: [
        { url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/CozyGrayCatCavewithKitten.png?v=1791363758", altText: "DIY Crochet Cat Bed Kit" }
      ]
    },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62833058250833",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "77.99", currencyCode: "GBP" },
          selectedOptions: [{ name: "Title", value: "Default Title" }],
          image: {
            url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/CozyGrayCatCavewithKitten.png?v=1791363758",
            altText: "DIY Crochet Cat Bed Kit"
          }
        }
      ]
    },
    options: [{ name: "Title", values: ["Default Title"] }]
  },
  {
    id: "gid://shopify/Product/16345824526417",
    title: "Personalized Crystal Ball LED Lamp",
    handle: "personlized-crystal-ball-led-lamp",
    description: "Personalized crystal ball night light with warm LED wooden base. A comforting ambient glow for desks, bedrooms, and meaningful occasions.",
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
    images: {
      nodes: [
        { url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/Celestial_Crystal_Globe_Lamp.png?v=1791453230", altText: "Personalized Crystal Ball LED Lamp" },
        { url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/Sb20fe0704a9d4e309d85723c0a442e2bc_jpg_220x220q75_jpg.jpg?v=1791026180", altText: "Lamp details" }
      ]
    },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62793929687121",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "48.99", currencyCode: "GBP" },
          selectedOptions: [{ name: "Title", value: "Default Title" }]
        }
      ]
    },
    options: [{ name: "Title", values: ["Default Title"] }]
  },
  {
    id: "gid://shopify/Product/16352140558417",
    title: "Handmade Feather Dream Catcher Wall Hanging",
    handle: "handmade-feather-dream-catcher-wall-hanging",
    description: "Boho chic feather dream catcher wall hanging with natural wooden beads and soft layered feathers.",
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
    images: {
      nodes: [
        { url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/BohemianDreamcatcherwithLayeredFeathers.png?v=1791358935", altText: "Dream Catcher" }
      ]
    },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62832114040913",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "24.00", currencyCode: "GBP" },
          selectedOptions: [{ name: "Title", value: "Default Title" }]
        }
      ]
    },
    options: [{ name: "Title", values: ["Default Title"] }]
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
    images: {
      nodes: [
        { url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/Untitled-1_adasg2.png?v=1791453230", altText: "Crochet Ornaments" }
      ]
    },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62833053171793",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "28.99", currencyCode: "GBP" },
          selectedOptions: [{ name: "Title", value: "Default Title" }]
        }
      ]
    },
    options: [{ name: "Title", values: ["Default Title"] }]
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
    images: {
      nodes: [
        { url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/CrochetRaffiaToteBag_ParisMilano.png?v=1791359674", altText: "Tote Bag" }
      ]
    },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62832270868561",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "79.99", currencyCode: "GBP" },
          selectedOptions: [{ name: "Title", value: "Default Title" }]
        }
      ]
    },
    options: [{ name: "Title", values: ["Default Title"] }]
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
    images: {
      nodes: [
        { url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/BohoMacramePhotoDisplay.png?v=1791359274", altText: "Photo Display" }
      ]
    },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62832191832145",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "28.99", currencyCode: "GBP" },
          selectedOptions: [{ name: "Title", value: "Default Title" }]
        }
      ]
    },
    options: [{ name: "Title", values: ["Default Title"] }]
  },
  {
    id: "gid://shopify/Product/16352155369553",
    title: "Boho Woven Round Wall Hanging Decor",
    handle: "boho-woven-round-wall-hanging-decor",
    description: "Artisan woven circular wall hanging handcrafted with natural fibers.",
    vendor: "Present Panic",
    productType: "Home Decor",
    tags: ["decor", "boho", "handmade", "artisan"],
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: "14.99", currencyCode: "GBP" },
      maxVariantPrice: { amount: "14.99", currencyCode: "GBP" }
    },
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/RoundBraidedJuteRugwithTassels.png?v=1791359467",
      altText: "Boho Woven Round Wall Hanging"
    },
    images: {
      nodes: [
        { url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/RoundBraidedJuteRugwithTassels.png?v=1791359467", altText: "Round Wall Hanging" }
      ]
    },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62832239902801",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "14.99", currencyCode: "GBP" },
          selectedOptions: [{ name: "Title", value: "Default Title" }]
        }
      ]
    },
    options: [{ name: "Title", values: ["Default Title"] }]
  },
  {
    id: "gid://shopify/Product/16352170082385",
    title: "Macrame Evil Eye Wall Hanging",
    handle: "macrame-evil-eye-wall-hanging",
    description: "Protection symbol woven macrame wall hanging with deep blue glass bead accent.",
    vendor: "Present Panic",
    productType: "Home Decor",
    tags: ["evil-eye", "macrame", "boho", "spiritual"],
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: "33.99", currencyCode: "GBP" },
      maxVariantPrice: { amount: "33.99", currencyCode: "GBP" }
    },
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/BlueEvilEyeMacrameWallHanging.png?v=1791359872",
      altText: "Macrame Evil Eye Wall Hanging"
    },
    images: {
      nodes: [
        { url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/BlueEvilEyeMacrameWallHanging.png?v=1791359872", altText: "Evil Eye Hanging" }
      ]
    },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62832310222929",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "33.99", currencyCode: "GBP" },
          selectedOptions: [{ name: "Title", value: "Default Title" }]
        }
      ]
    },
    options: [{ name: "Title", values: ["Default Title"] }]
  },
  {
    id: "gid://shopify/Product/16352179978321",
    title: "Boho Starfish Beaded Tassel Hanging Decor",
    handle: "boho-starfish-beaded-tassel-hanging-decor",
    description: "Coastal charm beaded tassel garland with sculpted natural starfish embellishment.",
    vendor: "Present Panic",
    productType: "Home Decor",
    tags: ["coastal", "beads", "starfish", "tassel", "boho"],
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: "14.99", currencyCode: "GBP" },
      maxVariantPrice: { amount: "14.99", currencyCode: "GBP" }
    },
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/CoastalStarfishTasselGarlandSet.png?v=1791360267",
      altText: "Boho Starfish Beaded Tassel"
    },
    images: {
      nodes: [
        { url: "https://cdn.shopify.com/s/files/1/1078/7828/5393/files/CoastalStarfishTasselGarlandSet.png?v=1791360267", altText: "Starfish Tassel" }
      ]
    },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/62832373039185",
          title: "Default Title",
          availableForSale: true,
          price: { amount: "14.99", currencyCode: "GBP" },
          selectedOptions: [{ name: "Title", value: "Default Title" }]
        }
      ]
    },
    options: [{ name: "Title", values: ["Default Title"] }]
  }
];

// Pre-seed fallback cache only when Shopify credentials are not configured
if (!isShopifyConfigured()) {
  indexProductsInCache(DEFAULT_CATALOG_PRODUCTS);
}

export function getFallbackCollections(): ShopifyCollection[] {
  return DEFAULT_COLLECTIONS;
}

export function getFallbackProducts(filterQuery?: string): ShopifyProduct[] {
  if (!filterQuery) return DEFAULT_CATALOG_PRODUCTS;
  const q = filterQuery.toLowerCase().trim();
  return DEFAULT_CATALOG_PRODUCTS.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.tags.some(t => t.toLowerCase().includes(q))
  );
}

// ----------------------------------------------------
// Local Cart Mocking for Seamless Fallback
// ----------------------------------------------------
const CART_STORAGE_KEY = 'present_panic_shopify_local_cart';

function getStoredLocalCart(): ShopifyCart {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  const newCart: ShopifyCart = {
    id: `gid://shopify/Cart/local-${Date.now()}`,
    checkoutUrl: `https://${STORE_DOMAIN || 'checkout.presentpanic.com'}/checkouts/demo-${Date.now()}`,
    totalQuantity: 0,
    cost: {
      subtotalAmount: { amount: '0.00', currencyCode: 'GBP' },
      totalAmount: { amount: '0.00', currencyCode: 'GBP' },
    },
    lines: { nodes: [] },
    discountCodes: [],
    discountAllocations: [],
  };
  saveStoredLocalCart(newCart);
  return newCart;
}

function saveStoredLocalCart(cart: ShopifyCart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {}
}

function recalculateCart(cart: ShopifyCart): ShopifyCart {
  let subtotal = 0;
  let totalQty = 0;

  for (const line of cart.lines.nodes) {
    const unit = parseFloat(line.merchandise.price.amount);
    const lineSub = unit * line.quantity;
    line.cost = {
      subtotalAmount: { amount: lineSub.toFixed(2), currencyCode: line.merchandise.price.currencyCode },
      totalAmount: { amount: lineSub.toFixed(2), currencyCode: line.merchandise.price.currencyCode },
    };
    subtotal += lineSub;
    totalQty += line.quantity;
  }

  let discount = 0;
  if (cart.discountCodes && cart.discountCodes.length > 0 && cart.discountCodes[0].applicable) {
    discount = subtotal * 0.2; // 20% discount demo
    cart.discountAllocations = [{ discountedAmount: { amount: discount.toFixed(2), currencyCode: 'GBP' } }];
  } else {
    cart.discountAllocations = [];
  }

  const total = Math.max(0, subtotal - discount);

  cart.totalQuantity = totalQty;
  cart.cost = {
    subtotalAmount: { amount: subtotal.toFixed(2), currencyCode: 'GBP' },
    totalAmount: { amount: total.toFixed(2), currencyCode: 'GBP' },
  };

  saveStoredLocalCart(cart);
  return cart;
}

function createLocalCartMock(lines: { merchandiseId: string; quantity: number; attributes?: { key: string; value: string }[] }[]): ShopifyCart {
  const cart = getStoredLocalCart();
  if (lines.length > 0) {
    return addLocalCartLinesMock(cart.id, lines);
  }
  return cart;
}

function getLocalCartMock(cartId: string): ShopifyCart {
  return getStoredLocalCart();
}

function addLocalCartLinesMock(cartId: string, lines: { merchandiseId: string; quantity: number; attributes?: { key: string; value: string }[] }[]): ShopifyCart {
  const cart = getStoredLocalCart();
  const allProducts = getFallbackProducts();

  for (const l of lines) {
    let productFound: ShopifyProduct | undefined;
    let variantFound: ShopifyVariant | undefined;

    for (const p of allProducts) {
      const v = p.variants.nodes.find(v => v.id === l.merchandiseId);
      if (v) {
        productFound = p;
        variantFound = v;
        break;
      }
    }

    if (!variantFound || !productFound) {
      if (allProducts.length > 0) {
        productFound = allProducts[0];
        variantFound = productFound.variants.nodes[0];
      } else {
        continue;
      }
    }

    const existingLine = cart.lines.nodes.find(line => line.merchandise.id === variantFound!.id);
    if (existingLine) {
      existingLine.quantity += l.quantity;
      if (l.attributes) existingLine.attributes = l.attributes;
    } else {
      cart.lines.nodes.push({
        id: `gid://shopify/CartLine/${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        quantity: l.quantity,
        cost: {
          subtotalAmount: variantFound.price,
          totalAmount: variantFound.price,
        },
        merchandise: {
          id: variantFound.id,
          title: variantFound.title,
          product: {
            id: productFound.id,
            title: productFound.title,
            handle: productFound.handle,
            featuredImage: productFound.featuredImage,
          },
          price: variantFound.price,
          compareAtPrice: variantFound.compareAtPrice,
          image: variantFound.image || productFound.featuredImage,
          selectedOptions: variantFound.selectedOptions,
        },
        attributes: l.attributes || [],
      });
    }
  }

  return recalculateCart(cart);
}

function updateLocalCartLinesMock(cartId: string, lines: { id: string; quantity: number }[]): ShopifyCart {
  const cart = getStoredLocalCart();
  for (const item of lines) {
    const idx = cart.lines.nodes.findIndex(l => l.id === item.id);
    if (idx !== -1) {
      if (item.quantity <= 0) {
        cart.lines.nodes.splice(idx, 1);
      } else {
        cart.lines.nodes[idx].quantity = item.quantity;
      }
    }
  }
  return recalculateCart(cart);
}

function removeLocalCartLinesMock(cartId: string, lineIds: string[]): ShopifyCart {
  const cart = getStoredLocalCart();
  cart.lines.nodes = cart.lines.nodes.filter(l => !lineIds.includes(l.id));
  return recalculateCart(cart);
}

function applyLocalDiscountCodeMock(cartId: string, discountCodes: string[]): ShopifyCart {
  const cart = getStoredLocalCart();
  if (discountCodes.length > 0 && discountCodes[0].trim().toUpperCase() === 'GIFT20') {
    cart.discountCodes = [{ code: 'GIFT20', applicable: true }];
  } else if (discountCodes.length === 0) {
    cart.discountCodes = [];
  } else {
    throw new Error(`Discount code "${discountCodes[0]}" is invalid or expired.`);
  }
  return recalculateCart(cart);
}
