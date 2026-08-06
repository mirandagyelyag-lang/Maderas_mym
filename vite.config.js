import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.ico",
        "favicon-64.png",
        "apple-touch-icon.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
      ],

      manifest: {
        name: "Maderas M&M",
        short_name: "Maderas M&M",
        description: "Sistema de gestión de Maderas M&M",
        id: "/inicio",
        lang: "es-CL",
        theme_color: "#171311",
        background_color: "#171311",
        display: "standalone",
        orientation: "any",
        start_url: "/inicio",
        scope: "/",

        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },

      workbox: {
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,

        maximumFileSizeToCacheInBytes:
          5 * 1024 * 1024,

        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,woff2}",
        ],

        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin ===
              "https://vvvxocbvjvsidtikqryo.supabase.co",
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ request }) =>
              request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "maderas-mm-images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds:
                  30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },

      devOptions: {
        enabled: true,
        navigateFallback: "index.html",
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(
        __dirname,
        "./src"
      ),
    },
  },
});
