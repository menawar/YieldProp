#!/usr/bin/env node
/**
 * Phase 6: Setup CRE project.yaml with Tenderly Virtual TestNet RPC URL
 * Loads TENDERLY_VIRTUAL_TESTNET_RPC from .env (project root)
 *
 * 1. Create Virtual TestNet at https://dashboard.tenderly.co (Virtual TestNets → Create)
 * 2. Fork Sepolia (chainId 11155111) or Mainnet
 * 3. Copy RPC URL from dashboard
 * 4. Set TENDERLY_VIRTUAL_TESTNET_RPC in .env
 * 5. Run: node scripts/setup-tenderly-cre.js
 * 6. Run: npm run cre:simulate:tenderly
 */
const fs = require("fs");
const path = require("path");

// Load .env from project root
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const rpcUrl = process.env.TENDERLY_VIRTUAL_TESTNET_RPC;
if (!rpcUrl) {
  console.error("Error: Set TENDERLY_VIRTUAL_TESTNET_RPC in your .env");
  console.error("  1. Create Virtual TestNet at https://dashboard.tenderly.co");
  console.error("  2. Copy RPC URL (e.g. https://virtual.sepolia.rpc.tenderly.co/<id>)");
  console.error("  3. Add to .env: TENDERLY_VIRTUAL_TESTNET_RPC=<your-rpc-url>");
  process.exit(1);
}

const projectYamlPath = path.join(__dirname, "../cre-workflow/project.yaml");
let yaml = fs.readFileSync(projectYamlPath, "utf8");

// Replace the url in tenderly-settings block
yaml = yaml.replace(
  /(tenderly-settings:\s*\n  rpcs:\s*\n    - chain-name: ethereum-testnet-sepolia\s*\n      url: )\S+/,
  `$1${rpcUrl}`
);

fs.writeFileSync(projectYamlPath, yaml);
console.log("Updated cre-workflow/project.yaml with Tenderly RPC URL");
console.log("Next: npm run cre:simulate:tenderly");
