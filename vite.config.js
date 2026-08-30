import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: "base" must match your GitHub repo name exactly, wrapped in slashes.
// Example: if your repo is github.com/yourname/manni-shop, set base to "/manni-shop/".
// If you rename the repo, update this and redeploy.
export default defineConfig({
  plugins: [react()],
  base: "/manni-luxury-phones/",
});
