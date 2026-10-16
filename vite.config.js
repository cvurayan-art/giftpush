import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Local Vite plugin that emulates Vercel Serverless Functions (/api/*)
 * during `npm run dev` so Meta CAPI and Shopify endpoints work 100% locally.
 */
function vercelApiLocalDev() {
  return {
    name: 'vercel-api-local-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url.startsWith('/api/meta-capi') || req.url.startsWith('/api/shopify'))) {
          try {
            const isCapi = req.url.startsWith('/api/meta-capi');
            const handlerModule = isCapi
              ? await import('./api/meta-capi.js')
              : await import('./api/shopify.js');
            const handler = handlerModule.default;

            let body = {};
            if (req.method === 'POST') {
              const chunks = [];
              for await (const chunk of req) {
                chunks.push(chunk);
              }
              const rawBody = Buffer.concat(chunks).toString('utf-8');
              if (rawBody) {
                try {
                  body = JSON.parse(rawBody);
                } catch (_) {
                  body = rawBody;
                }
              }
            }
            req.body = body;

            // Express/Vercel compat helper methods for response
            if (!res.status) {
              res.status = function (code) {
                res.statusCode = code;
                return res;
              };
            }
            if (!res.json) {
              res.json = function (data) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return res;
              };
            }

            return await handler(req, res);
          } catch (err) {
            console.error('[Vite Local API Handler Error]:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Populate process.env for local API routes
  Object.assign(process.env, env);

  return {
    plugins: [react(), vercelApiLocalDev()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          shop: path.resolve(__dirname, 'shop.html'),
          categories: path.resolve(__dirname, 'categories.html'),
          collection: path.resolve(__dirname, 'collection.html'),
          product: path.resolve(__dirname, 'product.html'),
          cart: path.resolve(__dirname, 'cart.html'),
          about: path.resolve(__dirname, 'about.html'),
          contact: path.resolve(__dirname, 'contact.html'),
          faq: path.resolve(__dirname, 'faq.html'),
          shipping: path.resolve(__dirname, 'shipping.html'),
          returns: path.resolve(__dirname, 'returns.html'),
          privacy: path.resolve(__dirname, 'privacy.html'),
          terms: path.resolve(__dirname, 'terms.html'),
          notFound: path.resolve(__dirname, '404.html'),
        },
      },
    },
  };
});
