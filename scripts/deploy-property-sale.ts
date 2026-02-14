/**
 * Deploy PropertySale to an existing YieldProp deployment.
 * Use when you have already deployed PropertyToken, MockUSDC etc. and need PropertySale.
 *
 * Usage: npx hardhat run scripts/deploy-property-sale.ts --network sepolia
 *
 * Requires in .env or deployment file:
 *   PropertyToken, MockUSDC addresses
 *   Property manager address (receives USDC from sales)
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying PropertySale from:", deployer.address);

  // Load latest deployment
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const files = fs.readdirSync(deploymentsDir).filter((f) => f.endsWith(".json"));
  const latest = files.sort().reverse()[0];
  if (!latest) {
    throw new Error("No deployment found. Run deploy.ts first.");
  }

  const deployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, latest), "utf-8")
  );
  const contracts = deployment.contracts || deployment.properties?.[0]?.contracts;
  const { PropertyToken, MockUSDC, YieldDistributor } = contracts || {};
  const propertyManager = deployment.roles?.propertyManager || deployer.address;

  if (!PropertyToken || !MockUSDC) {
    throw new Error("Deployment missing PropertyToken or MockUSDC");
  }

  console.log("PropertyToken:", PropertyToken);
  console.log("MockUSDC:", MockUSDC);
  console.log("YieldDistributor:", YieldDistributor || "(none – auto-register disabled)");
  console.log("Property Manager:", propertyManager);

  const PropertySaleFactory = await ethers.getContractFactory("PropertySale");
  const propertySale = await PropertySaleFactory.deploy(
    PropertyToken,
    MockUSDC,
    propertyManager,
    deployer.address,
    YieldDistributor || ethers.ZeroAddress
  );
  await propertySale.waitForDeployment();
  const propertySaleAddress = await propertySale.getAddress();
  console.log("\nPropertySale deployed to:", propertySaleAddress);

  // Approve PropertySale to transfer tokens
  const propertyToken = await ethers.getContractAt("PropertyToken", PropertyToken);
  const totalSupply = await propertyToken.totalSupply();
  await (await propertyToken.approve(propertySaleAddress, totalSupply)).wait();
  console.log("Approved PropertySale to transfer tokens");

  // Wire PropertySale as authorized registrar when YieldDistributor exists
  if (YieldDistributor) {
    const yieldDist = await ethers.getContractAt("YieldDistributor", YieldDistributor);
    await (await yieldDist.setAuthorizedRegistrar(propertySaleAddress)).wait();
    console.log("PropertySale set as authorized yield registrar");
  }

  // Update deployment file
  if (deployment.contracts) {
    deployment.contracts.PropertySale = propertySaleAddress;
  }
  if (deployment.properties?.[0]?.contracts) {
    deployment.properties[0].contracts.PropertySale = propertySaleAddress;
  }
  fs.writeFileSync(
    path.join(deploymentsDir, latest),
    JSON.stringify(deployment, null, 2)
  );
  console.log("\nUpdated", latest);

  console.log("\nAdd to dashboard .env.local:");
  console.log("NEXT_PUBLIC_PROPERTY_SALE_ADDRESS=" + propertySaleAddress);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
