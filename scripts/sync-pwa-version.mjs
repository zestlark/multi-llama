import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const packageJsonPath = resolve(root, "package.json");
const swPath = resolve(root, "public", "sw.js");
const manifestPath = resolve(root, "public", "manifest.webmanifest");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const version = String(packageJson.version || "").trim();

if (!version) {
  throw new Error("package.json version is missing");
}

const swSource = readFileSync(swPath, "utf8");
const nextSwSource = swSource.replace(
  /const CACHE_NAME = "multi-llama-chat-v[^"]+";/,
  `const CACHE_NAME = "multi-llama-chat-v${version}";`,
);

if (nextSwSource !== swSource) {
  writeFileSync(swPath, nextSwSource, "utf8");
}

const manifestSource = readFileSync(manifestPath, "utf8");
const nextManifestSource = manifestSource.replace(
  /"start_url": "\.\/\?v[^"]*"/,
  `"start_url": "./?v=${version}"`,
);

if (nextManifestSource !== manifestSource) {
  writeFileSync(manifestPath, nextManifestSource, "utf8");
}

console.log(`[pwa] synced version ${version}`);
