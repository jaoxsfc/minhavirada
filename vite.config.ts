import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  // Repository Pages URL: https://jaoxsfc.github.io/minhavirada/.
  // Root-only regression tests explicitly set BASE_PATH=/.
  base: process.env.BASE_PATH || "/minhavirada/",
  plugins: [
    react(),
    tailwind(),
    {
      name: "production-security-policy",
      apply: "build",
      transformIndexHtml() {
        return [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content:
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none';",
            },
            injectTo: "head-prepend",
          },
          {
            tag: "meta",
            attrs: { name: "referrer", content: "no-referrer" },
            injectTo: "head-prepend",
          },
        ];
      },
    },
    VitePWA({
      registerType: "prompt",
      includeAssets: ["offline.html", "icons/*.png"],
      manifest: {
        name: "Minha Virada",
        short_name: "Minha Virada",
        description: "Um passo de cada vez.",
        lang: "pt-BR",
        start_url: "./",
        scope: "./",
        display: "standalone",
        theme_color: "#173E34",
        background_color: "#F6F3EB",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
