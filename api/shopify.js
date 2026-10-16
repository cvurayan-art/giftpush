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

      // Forward Purchase event to Meta Conversions API (CAPI) if order was created or paid
      if (topic === 'orders/create' || topic === 'orders/paid') {
        const pixelId =
          process.env.META_PIXEL_ID ||
          process.env.VITE_META_PIXEL_ID ||
          '1569317721181690';
        const accessToken =
          process.env.META_ACCESS_TOKEN ||
          'EAATVBheZAf40BSqacJPdvMZCt4hJaZC1twZCzMUOm8ktFdcskNePmOT3KBjoyxgZCIeAHmMHAE8lrBPReZBcQMFgT2gjG3ZBVRmGcoMGxP2xgn8OkkFIUByViq12VdbGKxONEc9Sk01tajtEgmDSgUwDNsF11pfx6aetZCv6q8ttJXMVyTpqSU0cPvgu6qqjyAZDZD';
        const order = req.body;

        if (pixelId && accessToken && order && order.id) {
          try {
            // Deduplication event_id: order_<order_id> (matches browser Purchase pixel if Shopify web pixel configured)
            const eventId = `order_${order.id}`;
            const value = parseFloat(order.total_price || order.current_total_price || '0');
            const currency = order.currency || 'GBP';
            const contents = (order.line_items || []).map((li) => ({
              id: String(li.variant_id || li.product_id),
              quantity: li.quantity || 1,
              item_price: parseFloat(li.price || '0'),
            }));

            // Hash email/phone if present
            let em = undefined;
            if (order.email) {
              em = crypto.createHash('sha256').update(order.email.trim().toLowerCase()).digest('hex');
            }
            let ph = undefined;
            if (order.phone) {
              ph = crypto.createHash('sha256').update(order.phone.trim().replace(/[^\d+]/g, '')).digest('hex');
            }

            const serverEvent = {
              event_name: 'Purchase',
              event_time: Math.floor(new Date(order.created_at || Date.now()).getTime() / 1000),
              event_id: eventId,
              action_source: 'website',
              event_source_url:
                order.order_status_url ||
                `https://${process.env.VITE_SHOPIFY_STORE_DOMAIN || 'checkout.presentpanic.com'}`,
              user_data: {
                client_ip_address: order.browser_ip || undefined,
                client_user_agent: order.client_details?.user_agent || undefined,
                em: em ? [em] : undefined,
                ph: ph ? [ph] : undefined,
              },
              custom_data: {
                currency,
                value,
                content_type: 'product',
                contents,
                num_items: contents.reduce((acc, c) => acc + c.quantity, 0),
                order_id: String(order.id),
              },
            };

            await fetch(`https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: [serverEvent] }),
            });
            console.log(`[Shopify Webhook -> Meta CAPI] Processed Purchase for order ${order.id}`);
          } catch (capiErr) {
            console.error('[Shopify Webhook -> Meta CAPI Error]:', capiErr);
          }
        }
      }

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
