import { ethers } from "hardhat";

/**
 * Deploy RecommendationConsumer to receive CRE workflow reports
 * and submit recommendations to PriceManager.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-consumer.ts --network tenderly
 *   npx hardhat run scripts/deploy-consumer.ts --network sepolia
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying RecommendationConsumer with account:", deployer.address);

  // MockForwarder on Sepolia (used by CRE simulator with --broadcast)
  const MOCK_FORWARDER = "0x15fC6ae953E024d975e77382eEeC56A9101f9F88";

  // PriceManager address — read from latest Tenderly deployment or env
  const fs = require("fs");
  const path = require("path");
  let priceManagerAddress: string;

  // Try to get from latest deployment file
  const deploymentsDir = path.join(__dirname, "../deployments");
  const networkLabel = process.env.HARDHAT_NETWORK === "tenderly" ? "tenderly" : "sepolia";
  const files = fs.readdirSync(deploymentsDir)
    .filter((f: string) => f.startsWith(networkLabel + "-") && !f.includes("verification"))
    .sort()
    .reverse();

  if (files.length > 0) {
    const deployment = JSON.parse(fs.readFileSync(path.join(deploymentsDir, files[0]), "utf8"));
    priceManagerAddress = deployment.contracts.PriceManager;
    console.log(`Using PriceManager from ${files[0]}: ${priceManagerAddress}`);
  } else {
    priceManagerAddress = process.env.PRICE_MANAGER_ADDRESS || "";
    console.log(`Using PriceManager from env: ${priceManagerAddress}`);
  }

  if (!priceManagerAddress) {
    console.error("Error: No PriceManager address found. Deploy contracts first.");
    process.exit(1);
  }

  // Deploy RecommendationConsumer
  console.log("\nDeploying RecommendationConsumer...");
  console.log("  Forwarder (MockForwarder):", MOCK_FORWARDER);
  console.log("  PriceManager:", priceManagerAddress);

  const ConsumerFactory = await ethers.getContractFactory("RecommendationConsumer");
  const consumer = await ConsumerFactory.deploy(MOCK_FORWARDER, priceManagerAddress);
  await consumer.waitForDeployment();
  const consumerAddress = await consumer.getAddress();
  console.log("RecommendationConsumer deployed to:", consumerAddress);

  // Grant PROPERTY_MANAGER_ROLE to the consumer on PriceManager
  console.log("\nGranting PROPERTY_MANAGER_ROLE to consumer...");
  const priceManager = await ethers.getContractAt("PriceManager", priceManagerAddress);
  const PROPERTY_MANAGER_ROLE = await priceManager.PROPERTY_MANAGER_ROLE();
  const grantTx = await priceManager.grantRole(PROPERTY_MANAGER_ROLE, consumerAddress);
  await grantTx.wait();
  console.log("PROPERTY_MANAGER_ROLE granted to consumer");

  // Verify role
  const hasRole = await priceManager.hasRole(PROPERTY_MANAGER_ROLE, consumerAddress);
  console.log("Consumer has PROPERTY_MANAGER_ROLE:", hasRole);

  // Update CRE config with consumer address
  if (process.env.HARDHAT_NETWORK === "tenderly") {
    const configPath = path.join(__dirname, "../cre-workflow/yieldprop-workflow/config.tenderly.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.recommendationConsumerAddress = consumerAddress;
      config.mockForwarderAddress = MOCK_FORWARDER;
      config.gasLimit = "500000";
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log("\nUpdated config.tenderly.json with consumer address");
    }
  }

  // Update deployment file
  if (files.length > 0) {
    const deploymentPath = path.join(deploymentsDir, files[0]);
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    deployment.contracts.RecommendationConsumer = consumerAddress;
    deployment.contracts.MockForwarder = MOCK_FORWARDER;
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("Updated deployment file with consumer address");
  }

  console.log("\n========================================");
  console.log("  RecommendationConsumer Ready!");
  console.log("========================================");
  console.log("Consumer:       ", consumerAddress);
  console.log("MockForwarder:  ", MOCK_FORWARDER);
  console.log("PriceManager:   ", priceManagerAddress);
  console.log("\nNext: npm run cre:simulate:tenderly -- --broadcast");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
