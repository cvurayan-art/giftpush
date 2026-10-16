/**
 * Vercel Serverless Function: Meta Conversions API (CAPI) Endpoint
 * Handles server-side tracking for Meta Ads with 1:1 event deduplication (event_id matching)
 * 
 * Required Environment Variables on Vercel:
 * - META_PIXEL_ID (or VITE_META_PIXEL_ID): Your Meta Pixel / Dataset ID
 * - META_ACCESS_TOKEN: Meta Conversions API System User Access Token
 * 
 * Optional:
 * - META_TEST_EVENT_CODE: For debugging in Meta Events Manager > Test Events (e.g. TEST12345)
 */

export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check on GET
  if (req.method === 'GET') {
    const isConfigured = Boolean(
      (process.env.META_PIXEL_ID || process.env.VITE_META_PIXEL_ID) &&
      process.env.META_ACCESS_TOKEN
    );
    return res.status(200).json({
      status: 'online',
      service: 'Meta Conversions API (CAPI) Proxy',
      configured: isConfigured,
      pixelIdConfigured: Boolean(process.env.META_PIXEL_ID || process.env.VITE_META_PIXEL_ID),
      accessTokenConfigured: Boolean(process.env.META_ACCESS_TOKEN),
      testMode: Boolean(process.env.META_TEST_EVENT_CODE),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    // 2. Parse incoming payload
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { eventName, eventId, eventSourceUrl, customData, userData } = body;

    if (!eventName || !eventId) {
      return res.status(400).json({ error: 'Missing required parameters: eventName and eventId.' });
    }

    // 3. Resolve Environment Credentials
    const pixelId =
      process.env.META_PIXEL_ID ||
      process.env.VITE_META_PIXEL_ID ||
      '1569317721181690';
    const accessToken =
      process.env.META_ACCESS_TOKEN ||
      'EAATVBheZAf40BSqacJPdvMZCt4hJaZC1twZCzMUOm8ktFdcskNePmOT3KBjoyxgZCIeAHmMHAE8lrBPReZBcQMFgT2gjG3ZBVRmGcoMGxP2xgn8OkkFIUByViq12VdbGKxONEc9Sk01tajtEgmDSgUwDNsF11pfx6aetZCv6q8ttJXMVyTpqSU0cPvgu6qqjyAZDZD';
    const testEventCode = process.env.META_TEST_EVENT_CODE;

    // Graceful fallback if credentials are not yet set in environment
    if (!pixelId || !accessToken) {
      console.warn(
        `[Meta CAPI Notice] Event "${eventName}" (${eventId}) received, but META_PIXEL_ID or META_ACCESS_TOKEN is not yet set in environment.`
      );
      return res.status(200).json({
        success: true,
        simulated: true,
        message: 'Credentials not configured. Event acknowledged without dispatching to Meta.',
        eventId,
        eventName,
      });
    }

    // 4. Extract Client IP & User Agent for high Event Match Quality (EMQ)
    const rawIp =
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      '';
    const clientIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';
    const clientUserAgent = req.headers['user-agent'] || '';

    // 5. Construct Meta Conversions API Standard Payload
    const serverEvent = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId, // Deduplication key matching browser pixel fbq('track', eventName, ..., { eventID })
      event_source_url: eventSourceUrl || req.headers.referer || '',
      action_source: 'website',
      user_data: {
        client_ip_address: clientIp || undefined,
        client_user_agent: clientUserAgent || undefined,
        fbp: userData?.fbp || undefined,
        fbc: userData?.fbc || undefined,
        em: userData?.em ? [userData.em] : undefined,
        ph: userData?.ph ? [userData.ph] : undefined,
      },
      custom_data: customData || undefined,
    };

    // Clean undefined fields inside user_data
    Object.keys(serverEvent.user_data).forEach((key) => {
      if (serverEvent.user_data[key] === undefined) {
        delete serverEvent.user_data[key];
      }
    });

    const capiPayload = {
      data: [serverEvent],
      ...(testEventCode ? { test_event_code: testEventCode } : {}),
    };

    // 6. Dispatch to Meta Graph API v20.0
    const metaApiUrl = `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`;
    const metaRes = await fetch(metaApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capiPayload),
    });

    const metaData = await metaRes.json();

    if (!metaRes.ok) {
      console.error('[Meta CAPI Graph API Error]:', metaData);
      return res.status(metaRes.status).json({
        error: 'Meta Graph API responded with an error.',
        details: metaData,
        eventId,
      });
    }

    return res.status(200).json({
      success: true,
      eventId,
      eventName,
      eventsReceived: metaData.events_received,
      fbtrace_id: metaData.fbtrace_id,
    });
  } catch (err) {
    console.error('[Meta CAPI Handler Exception]:', err);
    return res.status(500).json({
      error: 'Internal server error while processing Meta CAPI event.',
      message: err.message,
    });
  }
}
