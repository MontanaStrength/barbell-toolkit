import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `--mode preview` builds one self-contained HTML file with hash routing,
// for sharing a clickable preview. The normal build is the deployable site.
export default defineConfig(({ mode }) => ({
  plugins: mode === "preview" ? [react(), viteSingleFile()] : [react()],
  define: {
    __HASH_ROUTER__: JSON.stringify(mode === "preview"),
  },
}));
