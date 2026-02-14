#!/usr/bin/env node
/**
 * Sync contract addresses from latest deployment to dashboard/.env.local
 * Supports single-property (deploy.ts) and multi-property (deploy-multi.ts).
 *
 * Usage: node scripts/sync-dashboard-addresses.js
 */

const fs = require("fs");
const path = require("path");

const deploymentsDir = path.join(__dirname, "..", "deployments");
const files = fs.readdirSync(deploymentsDir).filter((f) => f.endsWith(".json"));
const latest = files.sort().reverse()[0];
if (!latest) {
  console.error("No deployment found. Run deploy.ts or deploy-multi.ts first.");
  process.exit(1);
}

const deployment = JSON.parse(
  fs.readFileSync(path.join(deploymentsDir, latest), "utf-8")
);
const envPath = path.join(__dirname, "..", "dashboard", ".env.local");
let env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    });
}

let updates = {};
const keysToRemove = new Set();

if (deployment.multiProperty && deployment.properties?.length > 0) {
  // Multi-property: write NEXT_PUBLIC_PROPERTIES_JSON
  const propsForEnv = deployment.properties.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    propertyType: p.propertyType,
    valuation: p.valuation,
    contracts: p.contracts,
  }));
  const json = JSON.stringify(propsForEnv);
  updates.NEXT_PUBLIC_PROPERTIES_JSON = json;
  // Remove single-property keys so we don't mix modes
  keysToRemove.add("NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS");
  keysToRemove.add("NEXT_PUBLIC_PRICE_MANAGER_ADDRESS");
  keysToRemove.add("NEXT_PUBLIC_YIELD_DISTRIBUTOR_ADDRESS");
  keysToRemove.add("NEXT_PUBLIC_PROPERTY_SALE_ADDRESS");
  keysToRemove.add("NEXT_PUBLIC_MOCK_USDC_ADDRESS");
  console.log("Multi-property deployment: NEXT_PUBLIC_PROPERTIES_JSON updated");
} else {
  // Single-property
  const { PropertyToken, PriceManager, YieldDistributor, PropertySale, MockUSDC } =
    deployment.contracts || {};
  updates = {
    NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS: PropertyToken,
    NEXT_PUBLIC_PRICE_MANAGER_ADDRESS: PriceManager,
    NEXT_PUBLIC_YIELD_DISTRIBUTOR_ADDRESS: YieldDistributor,
    NEXT_PUBLIC_MOCK_USDC_ADDRESS: MockUSDC,
    NEXT_PUBLIC_PROPERTY_SALE_ADDRESS: PropertySale,
  };
  keysToRemove.add("NEXT_PUBLIC_PROPERTIES_JSON");
  for (const [key, value] of Object.entries(updates)) {
    if (value) console.log(`${key}=${value}`);
  }
}

let changed = false;
for (const [key, value] of Object.entries(updates)) {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (env[key] !== str) {
    env[key] = str;
    changed = true;
  }
}
for (const key of keysToRemove) {
  if (env[key] !== undefined) {
    delete env[key];
    changed = true;
  }
}

if (!changed) {
  console.log("No address updates needed.");
  process.exit(0);
}

const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
const seen = new Set();
const lines = [];
content.split("\n").forEach((line) => {
  const m = line.match(/^([^=]+)=/);
  if (m) {
    const key = m[1].trim();
    seen.add(key);
    if (keysToRemove.has(key)) return;
    if (updates[key] !== undefined) {
      const v = updates[key];
      lines.push(`${key}=${typeof v === "string" ? v : JSON.stringify(v)}`);
    } else {
      lines.push(line);
    }
  } else {
    lines.push(line);
  }
});
for (const [key, value] of Object.entries(updates)) {
  if (!seen.has(key)) {
    lines.push(`${key}=${typeof value === "string" ? value : JSON.stringify(value)}`);
  }
}
fs.writeFileSync(envPath, lines.join("\n") + "\n");
console.log("\nUpdated dashboard/.env.local");
if (!deployment.multiProperty && !deployment.contracts?.PropertySale) {
  console.log("\n⚠️  PropertySale not in deployment. Run: npx hardhat run scripts/deploy-property-sale.ts --network sepolia");
}
