import { copyFileSync, existsSync } from "node:fs";

// SPA fallback for static hosts (Wasmer, GitHub Pages, Netlify, ...).
// Copying index.html to 404.html lets the host serve the app shell on
// unknown paths so React Router can render the in-app 404 page.
if (existsSync("dist/index.html")) {
  copyFileSync("dist/index.html", "dist/404.html");
  console.log("Created dist/404.html (SPA fallback).");
}