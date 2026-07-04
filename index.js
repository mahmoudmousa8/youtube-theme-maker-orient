import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "dist", "server", "index.mjs");

const port = process.env.PORT || 3000;
process.env.PORT = port.toString();

if (!fs.existsSync(serverPath)) {
  console.log("[YouTube Theme Launcher] dist/server/index.mjs not found. This is normal during the pre-build validation phase. Exiting with success.");
  process.exit(0);
}

console.log(`[YouTube Theme Launcher] Starting Nitro production server on port ${port}...`);

import("./dist/server/index.mjs").catch((err) => {
  console.error("Failed to start Nitro server:", err);
  process.exit(1);
});
