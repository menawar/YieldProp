#!/usr/bin/env node
/**
 * Create a new Tenderly Virtual TestNet via REST API
 *
 * Usage:
 *   TENDERLY_ACCESS_KEY=<key> node scripts/create-tenderly-vnet.js
 *
 * Or set TENDERLY_ACCESS_KEY in your .env file.
 *
 * Generates a Sepolia-forked Virtual TestNet and prints the Admin RPC URL.
 * Automatically updates .env and cre-workflow/project.yaml with the new URL.
 *
 * Get your access key: https://dashboard.tenderly.co → Settings → API Access Tokens
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const accessKey = process.env.TENDERLY_ACCESS_KEY;
const accountSlug = process.env.TENDERLY_ACCOUNT_SLUG || "me";
const projectSlug = process.env.TENDERLY_PROJECT_SLUG || "project";

if (!accessKey) {
  console.error("Error: TENDERLY_ACCESS_KEY not set.");
  console.error("");
  console.error("Get your key:");
  console.error("  1. Go to https://dashboard.tenderly.co");
  console.error("  2. Settings → API Access Tokens → Generate Access Token");
  console.error("  3. Set in .env: TENDERLY_ACCESS_KEY=<your-key>");
  console.error("  4. Optionally set TENDERLY_ACCOUNT_SLUG and TENDERLY_PROJECT_SLUG");
  console.error("");
  console.error("Or run directly:");
  console.error("  TENDERLY_ACCESS_KEY=<key> node scripts/create-tenderly-vnet.js");
  process.exit(1);
}

const slug = `yieldprop-vnet-${Date.now()}`;
const body = JSON.stringify({
  slug,
  display_name: "YieldProp CRE TestNet",
  fork_config: {
    network_id: 11155111,
    block_number: "latest",
  },
  virtual_network_config: {
    chain_config: {
      chain_id: 11155111,
    },
  },
  sync_state_config: {
    enabled: true,
    commitment_level: "latest",
  },
  explorer_page_config: {
    enabled: true,
    verification_visibility: "bytecode",
  },
});

const url = `https://api.tenderly.co/api/v1/account/${accountSlug}/project/${projectSlug}/vnets`;

const options = {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Access-Key": accessKey,
    "Content-Length": Buffer.byteLength(body),
  },
};

console.log("Creating Tenderly Virtual TestNet (Sepolia fork)...\n");

const req = https.request(url, options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    if (res.statusCode >= 400) {
      console.error(`API error (${res.statusCode}):`, data);
      process.exit(1);
    }

    const response = JSON.parse(data);
    const adminRpc = response.rpcs?.find((r) => r.name === "Admin RPC");

    if (!adminRpc) {
      console.error("Could not find Admin RPC in response.");
      console.error("Full response:", JSON.stringify(response, null, 2));
      process.exit(1);
    }

    const rpcUrl = adminRpc.url;
    const chainId = response.virtual_network_config?.chain_config?.chain_id ?? 11155111;
    const explorerUrl = response.explorer_page_config?.url || "";

    console.log("Virtual TestNet created successfully!");
    console.log(`  RPC URL:      ${rpcUrl}`);
    console.log(`  Chain ID:     ${chainId}`);
    console.log(`  Explorer:     ${explorerUrl || "(enable in dashboard)"}`);
    console.log(`  VNet Slug:    ${slug}`);
    console.log("");

    // Update root .env
    const envPath = path.join(__dirname, "../.env");
    let envContent = fs.readFileSync(envPath, "utf8");
    envContent = envContent.replace(
      /TENDERLY_VIRTUAL_TESTNET_RPC=.*/,
      `TENDERLY_VIRTUAL_TESTNET_RPC=${rpcUrl}`
    );
    envContent = envContent.replace(
      /TENDERLY_CHAIN_ID=.*/,
      `TENDERLY_CHAIN_ID=${chainId}`
    );
    if (explorerUrl) {
      if (envContent.includes("TENDERLY_EXPLORER_URL=")) {
        envContent = envContent.replace(
          /TENDERLY_EXPLORER_URL=.*/,
          `TENDERLY_EXPLORER_URL=${explorerUrl}`
        );
      } else {
        envContent += `\nTENDERLY_EXPLORER_URL=${explorerUrl}\n`;
      }
    }
    fs.writeFileSync(envPath, envContent);
    console.log("Updated .env with new RPC URL and chain ID");

    // Update CRE project.yaml
    const projectYamlPath = path.join(__dirname, "../cre-workflow/project.yaml");
    let yaml = fs.readFileSync(projectYamlPath, "utf8");
    yaml = yaml.replace(
      /(tenderly-settings:\s*\n  rpcs:\s*\n    - chain-name: ethereum-testnet-sepolia\s*\n      url: )\S+/,
      `$1${rpcUrl}`
    );
    fs.writeFileSync(projectYamlPath, yaml);
    console.log("Updated cre-workflow/project.yaml with new RPC URL");

    console.log("\nNext steps:");
    console.log("  1. npm run deploy:tenderly");
    console.log("  2. npm run cre:simulate:tenderly");
    console.log("  3. Open explorer: " + (explorerUrl || "enable in Tenderly dashboard"));
  });
});

req.on("error", (err) => {
  console.error("Request failed:", err.message);
  process.exit(1);
});

req.write(body);
req.end();
