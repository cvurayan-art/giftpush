/**
 * Present Panic - Shopify Storefront API Client
 * Modern Headless Architecture using Shopify Storefront GraphQL API
 */

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

// ----------------------------------------------------
// GraphQL Execution
// ----------------------------------------------------
export async function shopifyFetch<T>({
  query,
  variables = {},
}: {
  query: string;
  variables?: Record<string, any>;
}): Promise<T> {
  if (!isShopifyConfigured()) {
    throw new Error('Shopify credentials not configured in environment variables.');
  }

  const endpoint = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify API Error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Shopify GraphQL Error: ${json.errors[0].message}`);
  }

  return json.data as T;
}

// ----------------------------------------------------
// GraphQL Queries
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
export function formatShopifyMoney(amount: string | number, currencyCode = 'USD'): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || '0');
  const symbols: Record<string, string> = {
    USD: '$',
    GBP: '£',
    EUR: '€',
    CAD: 'CA$',
    AUD: 'AU$',
    JPY: '¥',
  };
  const sym = symbols[(currencyCode || 'USD').toUpperCase()] || `${currencyCode} `;
  return `${sym}${num.toFixed(2)}`;
}

// ----------------------------------------------------
// Public API Methods
// ----------------------------------------------------

/**
 * Fetch products list with optional filtering & sorting
 */
export async function getShopifyProducts(options: {
  first?: number;
  query?: string;
  sortKey?: string;
  reverse?: boolean;
} = {}): Promise<ShopifyProduct[]> {
  if (!isShopifyConfigured()) {
    return getFallbackProducts(options.query);
  }

  const query = `
    query GetProducts($first: Int!, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
      products(first: $first, query: $query, sortKey: $sortKey, reverse: $reverse) {
        nodes {
          ${PRODUCT_FRAGMENT}
        }
      }
    }
  `;

  try {
    const data = await shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>({
      query,
      variables: {
        first: options.first || 24,
        query: options.query || null,
        sortKey: options.sortKey || 'BEST_SELLING',
        reverse: options.reverse || false,
      },
    });

    if (data.products?.nodes && data.products.nodes.length > 0) {
      return data.products.nodes;
    }
    if (options.query) {
      return [];
    }
    return getFallbackProducts();
  } catch (err) {
    console.warn('[Shopify] Falling back to default catalog:', err);
    return getFallbackProducts(options.query);
  }
}

/**
 * Fetch single product details by handle
 */
export async function getShopifyProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  if (!isShopifyConfigured()) {
    const fallback = getFallbackProducts().find(p => p.handle === handle) || getFallbackProducts()[0];
    return fallback || null;
  }

  const query = `
    query GetProductByHandle($handle: String!) {
      product(handle: $handle) {
        ${PRODUCT_FRAGMENT}
      }
    }
  `;

  try {
    const data = await shopifyFetch<{ product: ShopifyProduct | null }>({
      query,
      variables: { handle },
    });
    if (data.product) {
      return data.product;
    }
    return getFallbackProducts().find(p => p.handle === handle) || null;
  } catch (err) {
    console.warn('[Shopify] Error fetching product by handle, using fallback:', err);
    return getFallbackProducts().find(p => p.handle === handle) || null;
  }
}

/**
 * Fetch collections list directly from Shopify
 */
export async function getShopifyCollections(first = 25): Promise<ShopifyCollection[]> {
  if (!isShopifyConfigured()) {
    return getFallbackCollections();
  }

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
    // Filter out internal 'frontpage' if other collections exist
    const valid = data.collections.nodes.filter(c => c.handle !== 'frontpage');
    const result = valid.length > 0 ? valid : data.collections.nodes;
    return result.length > 0 ? result : getFallbackCollections();
  } catch (err) {
    console.warn('[Shopify] Error fetching collections, using fallback:', err);
    return getFallbackCollections();
  }
}

/**
 * Fetch collection by handle with its products
 */
export async function getShopifyCollectionByHandle(
  handle: string,
  first = 24
): Promise<{ collection: ShopifyCollection; products: ShopifyProduct[] } | null> {
  if (!isShopifyConfigured()) {
    const col = getFallbackCollections().find(c => c.handle === handle) || getFallbackCollections()[0];
    const prods = getFallbackProducts();
    return { collection: col, products: prods };
  }

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
      variables: { handle, first },
    });

    if (data.collection) {
      return {
        collection: {
          id: data.collection.id,
          title: data.collection.title,
          handle: data.collection.handle,
          description: data.collection.description,
          image: data.collection.image,
        },
        products: data.collection.products?.nodes || [],
      };
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
 * Search products
 */
export async function searchShopifyProducts(searchQuery: string, first = 10): Promise<ShopifyProduct[]> {
  if (!searchQuery.trim()) return [];

  if (!isShopifyConfigured()) {
    const q = searchQuery.toLowerCase();
    return getFallbackProducts().filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.productType.toLowerCase().includes(q)
    ).slice(0, first);
  }

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
    const data = await shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>({
      query,
      variables: { query: searchQuery, first },
    });
    return data.products.nodes;
  } catch (err) {
    console.warn('[Shopify] Error searching products, fallback search:', err);
    const q = searchQuery.toLowerCase();
    return getFallbackProducts().filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    ).slice(0, first);
  }
}

/**
 * Product recommendations
 */
export async function getShopifyProductRecommendations(productId: string): Promise<ShopifyProduct[]> {
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
    const data = await shopifyFetch<{ productRecommendations: ShopifyProduct[] }>({
      query,
      variables: { productId },
    });
    return data.productRecommendations || getFallbackProducts().slice(1, 5);
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

  const query = `
    mutation CartCreate($input: CartInput!) {
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
    variables: { input: { lines } },
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
 * Remove items from cart
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
// FALLBACK & DEMO DATASET (When Shopify keys not yet set)
// Matches exact Shopify Storefront schema so app never breaks
// ====================================================

export function getFallbackCollections(): ShopifyCollection[] {
  return [];
}

export function getFallbackProducts(filterQuery?: string): ShopifyProduct[] {
  return [];
}


// ----------------------------------------------------
// Local Cart Mocking for Seamless Initial Experience
// ----------------------------------------------------
const CART_STORAGE_KEY = 'present_panic_shopify_local_cart';

function getStoredLocalCart(): ShopifyCart {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }

  const newCart: ShopifyCart = {
    id: `gid://shopify/Cart/local-${Date.now()}`,
    checkoutUrl: `https://${STORE_DOMAIN || 'present-panic-store.myshopify.com'}/checkouts/demo-${Date.now()}`,
    totalQuantity: 0,
    cost: {
      subtotalAmount: { amount: '0.00', currencyCode: 'USD' },
      totalAmount: { amount: '0.00', currencyCode: 'USD' },
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
      subtotalAmount: { amount: lineSub.toFixed(2), currencyCode: 'USD' },
      totalAmount: { amount: lineSub.toFixed(2), currencyCode: 'USD' },
    };
    subtotal += lineSub;
    totalQty += line.quantity;
  }

  let discount = 0;
  if (cart.discountCodes && cart.discountCodes.length > 0 && cart.discountCodes[0].applicable) {
    discount = subtotal * 0.2; // 20% discount demo
    cart.discountAllocations = [{ discountedAmount: { amount: discount.toFixed(2), currencyCode: 'USD' } }];
  } else {
    cart.discountAllocations = [];
  }

  const total = Math.max(0, subtotal - discount);

  cart.totalQuantity = totalQty;
  cart.cost = {
    subtotalAmount: { amount: subtotal.toFixed(2), currencyCode: 'USD' },
    totalAmount: { amount: total.toFixed(2), currencyCode: 'USD' },
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
