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
    return data.products.nodes;
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
    return data.product || (getFallbackProducts().find(p => p.handle === handle) || null);
  } catch (err) {
    console.warn('[Shopify] Error fetching product by handle, using fallback:', err);
    return getFallbackProducts().find(p => p.handle === handle) || getFallbackProducts()[0];
  }
}

/**
 * Fetch collections list
 */
export async function getShopifyCollections(first = 16): Promise<ShopifyCollection[]> {
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
    return data.collections.nodes;
  } catch (err) {
    console.warn('[Shopify] Error fetching collections, using fallback:', err);
    return getFallbackCollections();
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
  return [
    { id: 'gid://shopify/Collection/1', title: 'Home & Decor', handle: 'home-decor', description: 'Artisan fragrances, holiday candles, and cozy accents.' },
    { id: 'gid://shopify/Collection/2', title: 'Gift Hampers', handle: 'gift-hampers', description: 'Gourmet delicacies, celebratory chocolates, and luxury holiday baskets.' },
    { id: 'gid://shopify/Collection/3', title: 'Personalized Keepsakes', handle: 'personalized-keepsakes', description: 'Solid walnut engraved heirloom keepsake gifts.' },
    { id: 'gid://shopify/Collection/4', title: 'Fashion & Wearables', handle: 'fashion-wearables', description: 'Luxury timepieces, sunglasses, and curated apparel.' },
    { id: 'gid://shopify/Collection/5', title: 'Tech & Lifestyle', handle: 'tech-lifestyle', description: 'Modern gadgets, smart watches, and home electronics.' },
    { id: 'gid://shopify/Collection/6', title: 'Beauty & Grooming', handle: 'beauty', description: 'Premium self-care and fragrance collections.' },
    { id: 'gid://shopify/Collection/7', title: 'Kids & Play', handle: 'toys-kids', description: 'Interactive toys, plushies, and holiday games.' },
    { id: 'gid://shopify/Collection/8', title: 'Daily Deals', handle: 'daily-deals', description: 'Limited-time discounts on trending holiday bestsellers.' },
  ];
}

export function getFallbackProducts(filterQuery?: string): ShopifyProduct[] {
  const products: ShopifyProduct[] = [
    {
      id: 'gid://shopify/Product/101',
      title: 'Engraved Family Keepsake Box',
      handle: 'engraved-family-keepsake-box',
      vendor: 'Present Panic Heirloom',
      productType: 'Personalized Keepsakes',
      tags: ['Bestseller', 'Engraved', 'Wood', 'Holiday Pick'],
      availableForSale: true,
      description: 'Handcrafted from sustainable solid American walnut, lined in plush jewelry-grade velvet, and laser-engraved with your family name, established date, or personal dedication message. Designed to be treasured for generations.',
      priceRange: {
        minVariantPrice: { amount: '49.00', currencyCode: 'USD' },
        maxVariantPrice: { amount: '49.00', currencyCode: 'USD' },
      },
      compareAtPriceRange: {
        minVariantPrice: { amount: '59.00', currencyCode: 'USD' },
      },
      featuredImage: {
        url: '/images/personalized_box.jpg',
        altText: 'Engraved Family Keepsake Box in solid walnut wood',
      },
      images: {
        nodes: [
          { url: '/images/personalized_box.jpg', altText: 'Solid Walnut Engraved Box' },
          { url: '/images/personalized_showcase.jpg', altText: 'Keepsake Box Holiday Setting' },
          { url: '/images/holiday_journal.jpg', altText: 'Wood grain craftsmanship' },
          { url: '/images/cozy_mug.jpg', altText: 'Holiday gift pairing' },
        ],
      },
      options: [
        { name: 'Wood Finish', values: ['Heritage Walnut', 'Warm Cherry', 'Nordic Natural Oak'] },
        { name: 'Velvet Lining', values: ['Emerald Forest Velvet', 'Burgundy Wine Velvet', 'Midnight Onyx Velvet'] },
      ],
      variants: {
        nodes: [
          {
            id: 'gid://shopify/ProductVariant/1011',
            title: 'Heritage Walnut / Emerald Forest Velvet',
            sku: 'PP-BOX-WAL-EM',
            availableForSale: true,
            price: { amount: '49.00', currencyCode: 'USD' },
            compareAtPrice: { amount: '59.00', currencyCode: 'USD' },
            selectedOptions: [
              { name: 'Wood Finish', value: 'Heritage Walnut' },
              { name: 'Velvet Lining', value: 'Emerald Forest Velvet' },
            ],
            image: { url: '/images/personalized_box.jpg', altText: 'Walnut / Emerald' },
          },
          {
            id: 'gid://shopify/ProductVariant/1012',
            title: 'Heritage Walnut / Burgundy Wine Velvet',
            sku: 'PP-BOX-WAL-BG',
            availableForSale: true,
            price: { amount: '49.00', currencyCode: 'USD' },
            compareAtPrice: { amount: '59.00', currencyCode: 'USD' },
            selectedOptions: [
              { name: 'Wood Finish', value: 'Heritage Walnut' },
              { name: 'Velvet Lining', value: 'Burgundy Wine Velvet' },
            ],
            image: { url: '/images/personalized_box.jpg', altText: 'Walnut / Burgundy' },
          },
          {
            id: 'gid://shopify/ProductVariant/1013',
            title: 'Warm Cherry / Emerald Forest Velvet',
            sku: 'PP-BOX-CHR-EM',
            availableForSale: true,
            price: { amount: '54.00', currencyCode: 'USD' },
            compareAtPrice: { amount: '64.00', currencyCode: 'USD' },
            selectedOptions: [
              { name: 'Wood Finish', value: 'Warm Cherry' },
              { name: 'Velvet Lining', value: 'Emerald Forest Velvet' },
            ],
            image: { url: '/images/personalized_showcase.jpg', altText: 'Cherry / Emerald' },
          },
          {
            id: 'gid://shopify/ProductVariant/1014',
            title: 'Nordic Natural Oak / Midnight Onyx Velvet',
            sku: 'PP-BOX-OAK-OX',
            availableForSale: true,
            price: { amount: '52.00', currencyCode: 'USD' },
            compareAtPrice: { amount: '62.00', currencyCode: 'USD' },
            selectedOptions: [
              { name: 'Wood Finish', value: 'Nordic Natural Oak' },
              { name: 'Velvet Lining', value: 'Midnight Onyx Velvet' },
            ],
            image: { url: '/images/personalized_showcase.jpg', altText: 'Oak / Onyx' },
          },
        ],
      },
    },
    {
      id: 'gid://shopify/Product/102',
      title: 'Pinkfong Baby Shark Official Song Cube',
      handle: 'pinkfong-baby-shark-song-cube',
      vendor: 'Pinkfong',
      productType: 'Kids & Play',
      tags: ['Flash Deal', 'Toy', 'Kids'],
      availableForSale: true,
      description: 'Squeeze to hear the viral official song! Soft plush cube designed for toddlers and children holiday play.',
      priceRange: {
        minVariantPrice: { amount: '15.00', currencyCode: 'USD' },
        maxVariantPrice: { amount: '15.00', currencyCode: 'USD' },
      },
      compareAtPriceRange: {
        minVariantPrice: { amount: '22.00', currencyCode: 'USD' },
      },
      featuredImage: {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAAbpL3DDBevdG7mICAKmSPCEMvSxy1REopIlTY-lDRKUU6SCucxpdwA4dukABgDgYKb6_BQviOaWJlspcSEWn5cEY7PM6d4GRFLQtMzsZLGZECskQF0ZhYejULGLBJxBVoaAFV_TFs63AxQvQSPAe_u27W5DSqemKH4JQizwZdWxaSvukw19YAUP9AmpbUFm2yuGSQKLF_mJlQPhy0zHh3BrvvACmOGAlFPJx7c10LAwKwp4DLwE-w',
        altText: 'Baby Shark Cube',
      },
      images: {
        nodes: [
          { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAAbpL3DDBevdG7mICAKmSPCEMvSxy1REopIlTY-lDRKUU6SCucxpdwA4dukABgDgYKb6_BQviOaWJlspcSEWn5cEY7PM6d4GRFLQtMzsZLGZECskQF0ZhYejULGLBJxBVoaAFV_TFs63AxQvQSPAe_u27W5DSqemKH4JQizwZdWxaSvukw19YAUP9AmpbUFm2yuGSQKLF_mJlQPhy0zHh3BrvvACmOGAlFPJx7c10LAwKwp4DLwE-w', altText: 'Baby Shark Cube' }
        ]
      },
      options: [{ name: 'Character', values: ['Baby Shark Yellow', 'Mommy Shark Pink', 'Daddy Shark Blue'] }],
      variants: {
        nodes: [
          {
            id: 'gid://shopify/ProductVariant/1021',
            title: 'Baby Shark Yellow',
            sku: 'PP-TOY-SHK-YEL',
            availableForSale: true,
            price: { amount: '15.00', currencyCode: 'USD' },
            compareAtPrice: { amount: '22.00', currencyCode: 'USD' },
            selectedOptions: [{ name: 'Character', value: 'Baby Shark Yellow' }],
          },
        ],
      },
    },
    {
      id: 'gid://shopify/Product/103',
      title: 'Smart Keyboard Folio 12.9 Pro',
      handle: 'smart-keyboard-folio-12-9-pro',
      vendor: 'Apple Authorized',
      productType: 'Tech & Lifestyle',
      tags: ['Electronics', 'Apple', 'Flash Deal'],
      availableForSale: true,
      description: 'The Smart Keyboard Folio delivers a comfortable typing experience whenever you need it, and full front and back protection when you don’t.',
      priceRange: {
        minVariantPrice: { amount: '1099.00', currencyCode: 'USD' },
        maxVariantPrice: { amount: '1099.00', currencyCode: 'USD' },
      },
      compareAtPriceRange: {
        minVariantPrice: { amount: '1299.00', currencyCode: 'USD' },
      },
      featuredImage: {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuApDPK8TWzUOizUU3LAPphRFXsUMewmF5Kacm5vCHqKZRSXz4QojncX5nOWXwOXX85aDy7K_qGT_9uOUR9EMhljJHdFH7ON1SNvYSuJSBATh6e4rvdYKJGTc6F_hXfg0VEGzMUGnKAd1ZX5Lc9qt3uADP90lhIihyp3eYX07bVSOLf7JG_AM0rYZzIpehvcxNAlUA0gy6Gm11i9eaPZDhCm_etpv-UDzn2mVsKy5DE-1ba9tnQifJdN',
        altText: 'Smart Keyboard Folio',
      },
      images: {
        nodes: [
          { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuApDPK8TWzUOizUU3LAPphRFXsUMewmF5Kacm5vCHqKZRSXz4QojncX5nOWXwOXX85aDy7K_qGT_9uOUR9EMhljJHdFH7ON1SNvYSuJSBATh6e4rvdYKJGTc6F_hXfg0VEGzMUGnKAd1ZX5Lc9qt3uADP90lhIihyp3eYX07bVSOLf7JG_AM0rYZzIpehvcxNAlUA0gy6Gm11i9eaPZDhCm_etpv-UDzn2mVsKy5DE-1ba9tnQifJdN', altText: 'Smart Keyboard Folio' }
        ]
      },
      options: [{ name: 'Language', values: ['US English', 'UK English'] }],
      variants: {
        nodes: [
          {
            id: 'gid://shopify/ProductVariant/1031',
            title: 'US English',
            sku: 'PP-APL-KYB-US',
            availableForSale: true,
            price: { amount: '1099.00', currencyCode: 'USD' },
            compareAtPrice: { amount: '1299.00', currencyCode: 'USD' },
            selectedOptions: [{ name: 'Language', value: 'US English' }],
          },
        ],
      },
    },
    {
      id: 'gid://shopify/Product/104',
      title: 'High Classic Timepiece Watch',
      handle: 'high-classic-timepiece-watch',
      vendor: 'Chronos Heritage',
      productType: 'Fashion & Wearables',
      tags: ['Bestseller', 'Watch', 'Luxury'],
      availableForSale: true,
      description: 'Hand-assembled quartz mechanism encased in polished stainless steel with genuine calfskin leather strap.',
      priceRange: {
        minVariantPrice: { amount: '59.00', currencyCode: 'USD' },
        maxVariantPrice: { amount: '59.00', currencyCode: 'USD' },
      },
      compareAtPriceRange: {
        minVariantPrice: { amount: '89.00', currencyCode: 'USD' },
      },
      featuredImage: {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnpL9X2PdsU17yVff1Vwdiv3MVz4ClBXzs8n0X0vyAC5pvWtbY9cqQF0jUq5aEJp7Srq6AN5rUQ9xCLx7ZqyQU5ri-7VbiriD3Mlnxo60KCWTsuQcjTEQra1IXzAeNW5r2jwduxDJdIoJqXcZrO1KXFiyNybd8CNL0qQeItveHvE1DNifceswRv7LFpFz_PPpIDNvRAUVbiBzJ9pzQpWqBLP58tnqMYaML0PsphowFIMzDThVMyoQf',
        altText: 'Watch',
      },
      images: {
        nodes: [
          { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnpL9X2PdsU17yVff1Vwdiv3MVz4ClBXzs8n0X0vyAC5pvWtbY9cqQF0jUq5aEJp7Srq6AN5rUQ9xCLx7ZqyQU5ri-7VbiriD3Mlnxo60KCWTsuQcjTEQra1IXzAeNW5r2jwduxDJdIoJqXcZrO1KXFiyNybd8CNL0qQeItveHvE1DNifceswRv7LFpFz_PPpIDNvRAUVbiBzJ9pzQpWqBLP58tnqMYaML0PsphowFIMzDThVMyoQf', altText: 'Watch' }
        ]
      },
      options: [{ name: 'Dial Color', values: ['Onyx Black', 'Pure White', 'Emerald Green'] }],
      variants: {
        nodes: [
          {
            id: 'gid://shopify/ProductVariant/1041',
            title: 'Onyx Black',
            sku: 'PP-WCH-BLK',
            availableForSale: true,
            price: { amount: '59.00', currencyCode: 'USD' },
            compareAtPrice: { amount: '89.00', currencyCode: 'USD' },
            selectedOptions: [{ name: 'Dial Color', value: 'Onyx Black' }],
          },
        ],
      },
    },
    {
      id: 'gid://shopify/Product/105',
      title: 'Artisan Cinnamon & Pine Holiday Candle',
      handle: 'artisan-cinnamon-pine-holiday-candle',
      vendor: 'Present Panic Home',
      productType: 'Home & Decor',
      tags: ['Home', 'Candle', 'Holiday Fragrance'],
      availableForSale: true,
      description: 'Poured in small batches using 100% soy wax, organic wood wick, and rich notes of spicy cinnamon, crushed fir needles, and sweet vanilla amber.',
      priceRange: {
        minVariantPrice: { amount: '28.00', currencyCode: 'USD' },
        maxVariantPrice: { amount: '28.00', currencyCode: 'USD' },
      },
      compareAtPriceRange: {
        minVariantPrice: { amount: '36.00', currencyCode: 'USD' },
      },
      featuredImage: {
        url: '/images/cinnamon_candle.jpg',
        altText: 'Cinnamon & Pine Candle',
      },
      images: {
        nodes: [
          { url: '/images/cinnamon_candle.jpg', altText: 'Cinnamon Candle' }
        ]
      },
      options: [{ name: 'Size', values: ['8 oz Jar', '14 oz 3-Wick Luxury Bowl'] }],
      variants: {
        nodes: [
          {
            id: 'gid://shopify/ProductVariant/1051',
            title: '8 oz Jar',
            sku: 'PP-CNDL-8OZ',
            availableForSale: true,
            price: { amount: '28.00', currencyCode: 'USD' },
            compareAtPrice: { amount: '36.00', currencyCode: 'USD' },
            selectedOptions: [{ name: 'Size', value: '8 oz Jar' }],
          },
        ],
      },
    },
    {
      id: 'gid://shopify/Product/106',
      title: 'Grand Holiday Gourmet Gift Hamper',
      handle: 'grand-holiday-gourmet-gift-hamper',
      vendor: 'Present Panic Pantry',
      productType: 'Gift Hampers',
      tags: ['Hamper', 'Bestseller', 'Gourmet'],
      availableForSale: true,
      description: 'A lavish wicker basket brimming with artisan sourdough crackers, French truffles, reserve vintage red wine, Scottish shortbread, and cured holiday meats.',
      priceRange: {
        minVariantPrice: { amount: '89.00', currencyCode: 'USD' },
        maxVariantPrice: { amount: '89.00', currencyCode: 'USD' },
      },
      compareAtPriceRange: {
        minVariantPrice: { amount: '120.00', currencyCode: 'USD' },
      },
      featuredImage: {
        url: '/images/gift_hamper.jpg',
        altText: 'Gourmet Holiday Gift Hamper',
      },
      images: {
        nodes: [
          { url: '/images/gift_hamper.jpg', altText: 'Gift Hamper' }
        ]
      },
      options: [{ name: 'Edition', values: ['Classic Deluxe', 'Signature Champagne Edition'] }],
      variants: {
        nodes: [
          {
            id: 'gid://shopify/ProductVariant/1061',
            title: 'Classic Deluxe',
            sku: 'PP-HMP-DLX',
            availableForSale: true,
            price: { amount: '89.00', currencyCode: 'USD' },
            compareAtPrice: { amount: '120.00', currencyCode: 'USD' },
            selectedOptions: [{ name: 'Edition', value: 'Classic Deluxe' }],
          },
        ],
      },
    },
    {
      id: 'gid://shopify/Product/107',
      title: 'AF 1 Shadow Premium Sneakers',
      handle: 'af-1-shadow-premium-sneakers',
      vendor: 'Nike Authorized',
      productType: 'Fashion & Wearables',
      tags: ['Footwear', 'Sneakers', 'Trending'],
      availableForSale: true,
      description: 'Layered look, doubled branding, and an exaggerated foam midsole. Premium gift packaging ready for sneaker lovers.',
      priceRange: {
        minVariantPrice: { amount: '129.00', currencyCode: 'USD' },
        maxVariantPrice: { amount: '129.00', currencyCode: 'USD' },
      },
      compareAtPriceRange: {
        minVariantPrice: { amount: '160.00', currencyCode: 'USD' },
      },
      featuredImage: {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHV4-RM3vwWL16QXa83HDLqh8Arh5kn8rL6tIbeZR4jChdQaZgy0BHK8anl1SEzFcRSXpGqhaYEoRD-wB3R16Bf52kzrXyhyjWHjCQYu-mHviUSXe5df9Ksoalg2Y1j9O71osy0DIMJqDLzO59VYn44-sy76ZL2ao8F833_YiGV9EMXRLDn-X7MrcHGoLTncBWHzw6WRrO6zu8ushYLqHWfy3ddWV8LtSJ0rmtBGc3S97EH7kho6ga',
        altText: 'AF 1 Shadow Sneakers',
      },
      images: {
        nodes: [
          { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHV4-RM3vwWL16QXa83HDLqh8Arh5kn8rL6tIbeZR4jChdQaZgy0BHK8anl1SEzFcRSXpGqhaYEoRD-wB3R16Bf52kzrXyhyjWHjCQYu-mHviUSXe5df9Ksoalg2Y1j9O71osy0DIMJqDLzO59VYn44-sy76ZL2ao8F833_YiGV9EMXRLDn-X7MrcHGoLTncBWHzw6WRrO6zu8ushYLqHWfy3ddWV8LtSJ0rmtBGc3S97EH7kho6ga', altText: 'AF 1 Shadow Sneakers' }
        ]
      },
      options: [{ name: 'Size', values: ['US 7', 'US 8', 'US 9', 'US 10', 'US 11'] }],
      variants: {
        nodes: [
          {
            id: 'gid://shopify/ProductVariant/1071',
            title: 'US 9',
            sku: 'PP-SNK-US9',
            availableForSale: true,
            price: { amount: '129.00', currencyCode: 'USD' },
            compareAtPrice: { amount: '160.00', currencyCode: 'USD' },
            selectedOptions: [{ name: 'Size', value: 'US 9' }],
          },
        ],
      },
    },
    {
      id: 'gid://shopify/Product/108',
      title: 'Retro Italian Espresso Machine',
      handle: 'retro-italian-espresso-machine',
      vendor: 'Present Panic Living',
      productType: 'Home & Decor',
      tags: ['Home', 'Kitchen', 'Espresso'],
      availableForSale: true,
      description: 'Vintage chrome design with 15-bar professional pressure pump and dual temperature control for barista-grade espresso at home.',
      priceRange: {
        minVariantPrice: { amount: '229.00', currencyCode: 'USD' },
        maxVariantPrice: { amount: '229.00', currencyCode: 'USD' },
      },
      compareAtPriceRange: {
        minVariantPrice: { amount: '279.00', currencyCode: 'USD' },
      },
      featuredImage: {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDCC2ZQ_M4SyGUXrLeJVZWFta13x96nqu8p5_ZBwZehIpgg0fgU78DEv4Kd88z3Qh728mPgQ7pqiE52PkZ5IdztMW_v6oFkW3XMkjYZZvncCcLL4MEO9rzwpfJ1Qiql2iOeo1EDzKVUmZ_D71BEhbNP37Dn9EGcnOX7i93hgrSq1jiZ390uvDPXoZ9AiuiOWBJqYhThtEBQrTGmcp72ld63M7rn0zXXGFd3LedMJxwTUsNncpAITJsd',
        altText: 'Retro Espresso Machine',
      },
      images: {
        nodes: [
          { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDCC2ZQ_M4SyGUXrLeJVZWFta13x96nqu8p5_ZBwZehIpgg0fgU78DEv4Kd88z3Qh728mPgQ7pqiE52PkZ5IdztMW_v6oFkW3XMkjYZZvncCcLL4MEO9rzwpfJ1Qiql2iOeo1EDzKVUmZ_D71BEhbNP37Dn9EGcnOX7i93hgrSq1jiZ390uvDPXoZ9AiuiOWBJqYhThtEBQrTGmcp72ld63M7rn0zXXGFd3LedMJxwTUsNncpAITJsd', altText: 'Espresso Machine' }
        ]
      },
      options: [{ name: 'Color', values: ['Vintage Cream', 'Ruby Red', 'Midnight Black'] }],
      variants: {
        nodes: [
          {
            id: 'gid://shopify/ProductVariant/1081',
            title: 'Vintage Cream',
            sku: 'PP-ESP-CRM',
            availableForSale: true,
            price: { amount: '229.00', currencyCode: 'USD' },
            compareAtPrice: { amount: '279.00', currencyCode: 'USD' },
            selectedOptions: [{ name: 'Color', value: 'Vintage Cream' }],
          },
        ],
      },
    },
  ];

  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    return products.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  return products;
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
      productFound = allProducts[0];
      variantFound = productFound.variants.nodes[0];
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
