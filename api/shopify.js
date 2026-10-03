/**
 * Vercel Serverless Function: Shopify Secure Storefront & Webhook Proxy
 * Validates HMAC SHA-256 signatures and handles product/inventory update webhooks
 */

import crypto from 'crypto';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Shopify-Hmac-Sha256, X-Shopify-Topic');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const topic = req.headers['x-shopify-topic'];
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;

  // Webhook handling
  if (topic && hmac && webhookSecret) {
    try {
      const rawBody = JSON.stringify(req.body);
      const generatedHash = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody, 'utf8')
        .digest('base64');

      if (generatedHash !== hmac) {
        return res.status(401).json({ error: 'Invalid webhook signature.' });
      }

      console.log(`[Shopify Webhook] Processed ${topic}`);
      return res.status(200).json({ received: true, topic });
    } catch (err) {
      console.error('[Shopify Webhook Error]:', err);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // Health / Config verification
  const isConfigured = Boolean(
    process.env.VITE_SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN
  );

  return res.status(200).json({
    status: 'online',
    commerceBackend: 'Shopify Storefront API',
    configured: isConfigured,
    apiVersion: process.env.VITE_SHOPIFY_API_VERSION || '2024-07',
  });
}
