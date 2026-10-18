import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function rewriteProxyOrigin(proxy) {
  proxy.on("proxyReq", (proxyRequest) => {
    proxyRequest.setHeader("Origin", "http://127.0.0.1:3001");
  });
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        configure: rewriteProxyOrigin,
      },
      "/health": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        configure: rewriteProxyOrigin,
      },
    },
  },
});
