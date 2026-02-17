#!/usr/bin/env node
/**
 * Verify Tenderly Virtual TestNet deployment
 *
 * Checks that all contracts are deployed and callable on the Tenderly VNet.
 * Runs after `npm run deploy:tenderly` to produce a verification report.
 *
 * Usage: node scripts/verify-tenderly-deployment.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const RPC_URL = process.env.TENDERLY_VIRTUAL_TESTNET_RPC;
if (!RPC_URL) {
  console.error("Error: TENDERLY_VIRTUAL_TESTNET_RPC not set in .env");
  process.exit(1);
}

async function rpcCall(method, params = []) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 });
    const url = new URL(RPC_URL);
    const mod = url.protocol === "https:" ? https : http;

    const req = mod.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.result);
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log("========================================");
  console.log("  YieldProp Tenderly Deployment Verifier");
  console.log("========================================\n");

  // Find latest tenderly deployment file
  const deploymentsDir = path.join(__dirname, "../deployments");
  const files = fs.readdirSync(deploymentsDir).filter((f) => f.startsWith("tenderly-"));
  if (files.length === 0) {
    console.error("No tenderly deployment files found in deployments/");
    console.error("Run: npm run deploy:tenderly");
    process.exit(1);
  }
  files.sort().reverse();
  const latestFile = files[0];
  const deployment = JSON.parse(fs.readFileSync(path.join(deploymentsDir, latestFile), "utf8"));

  console.log(`Deployment file: ${latestFile}`);
  console.log(`RPC URL: ${RPC_URL}\n`);

  // Check chain ID
  const chainIdHex = await rpcCall("eth_chainId");
  const chainId = parseInt(chainIdHex, 16);
  console.log(`Chain ID: ${chainId}`);

  // Check block number
  const blockHex = await rpcCall("eth_blockNumber");
  const blockNumber = parseInt(blockHex, 16);
  console.log(`Block Number: ${blockNumber}\n`);

  // Verify each contract
  const contracts = deployment.contracts || {};
  const results = [];
  let allOk = true;

  for (const [name, address] of Object.entries(contracts)) {
    process.stdout.write(`Checking ${name} (${address})... `);
    try {
      const code = await rpcCall("eth_getCode", [address, "latest"]);
      if (code && code !== "0x" && code.length > 10) {
        console.log(`OK (${Math.floor((code.length - 2) / 2)} bytes)`);
        results.push({ name, address, status: "deployed", bytecodeSize: Math.floor((code.length - 2) / 2) });
      } else {
        console.log("MISSING - no bytecode at address");
        results.push({ name, address, status: "missing" });
        allOk = false;
      }
    } catch (err) {
      console.log(`ERROR - ${err.message}`);
      results.push({ name, address, status: "error", error: err.message });
      allOk = false;
    }
  }

  // Check deployer balance
  console.log("");
  const deployerAddr = deployment.deployer;
  if (deployerAddr) {
    const balHex = await rpcCall("eth_getBalance", [deployerAddr, "latest"]);
    const balEth = parseInt(balHex, 16) / 1e18;
    console.log(`Deployer (${deployerAddr}): ${balEth.toFixed(4)} ETH`);
  }

  // Check CRE config is aligned
  console.log("\n--- CRE Config Check ---");
  const configPath = path.join(__dirname, "../cre-workflow/yieldprop-workflow/config.tenderly.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const pmOk = config.priceManagerAddress === contracts.PriceManager;
    const ydOk = config.yieldDistributorAddress === contracts.YieldDistributor;
    console.log(`PriceManager address match:       ${pmOk ? "OK" : "MISMATCH"}`);
    console.log(`YieldDistributor address match:    ${ydOk ? "OK" : "MISMATCH"}`);
    if (!pmOk || !ydOk) {
      console.log("  Run: node scripts/setup-tenderly-cre.js to fix");
      allOk = false;
    }
  } else {
    console.log("config.tenderly.json not found");
    allOk = false;
  }

  // Check project.yaml RPC URL
  const projectYamlPath = path.join(__dirname, "../cre-workflow/project.yaml");
  if (fs.existsSync(projectYamlPath)) {
    const yamlContent = fs.readFileSync(projectYamlPath, "utf8");
    const rpcInYaml = yamlContent.includes(RPC_URL);
    console.log(`project.yaml RPC URL match:        ${rpcInYaml ? "OK" : "MISMATCH"}`);
    if (!rpcInYaml) allOk = false;
  }

  // Write verification report
  const report = {
    timestamp: new Date().toISOString(),
    rpcUrl: RPC_URL,
    chainId,
    blockNumber,
    deploymentFile: latestFile,
    contracts: results,
    allContractsDeployed: allOk,
    explorerUrl: process.env.TENDERLY_EXPLORER_URL || null,
  };

  const reportPath = path.join(deploymentsDir, `tenderly-verification-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n--- Result ---`);
  console.log(allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");
  console.log(`Verification report saved: ${reportPath}\n`);

  if (allOk) {
    console.log("Next: npm run cre:simulate:tenderly");
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification failed:", err.message);
  process.exit(1);
});
