import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  base: "/",

  build: {
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("/react/") || id.includes("/react-dom/")) {
            return "react-vendor";
          }

          if (id.includes("maplibre") || id.includes("mapbox")) {
            return "map";
          }

          if (id.includes("@turf") || id.includes("proj4")) {
            return "geoprocessing";
          }

          if (id.includes("shpjs") || id.includes("papaparse")) {
            return "parsers";
          }

          if (id.includes("duckdb")) {
            return "duckdb-wasm";
          }

          return "vendor";
        },
      },
    },
  },
});

// export default defineConfig({
//   plugins: [
//     react(),
//     tailwindcss(),
//     visualizer({
//       open: true,
//       gzipSize: true,
//       brotliSize: true,
//       filename: 'dist/stats.html'
//     })
//   ]
// })
