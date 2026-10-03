import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
});
