/**
 * Multi-property deployment for YieldProp
 * Deploys multiple property stacks sharing one MockUSDC.
 * Output: deployments/sepolia-multi-{timestamp}.json with properties array.
 *
 * Usage: PROPERTIES_CONFIG=./properties-config.json npx hardhat run scripts/deploy-multi.ts --network sepolia
 * Or: npx hardhat run scripts/deploy-multi.ts --network sepolia
 *     (uses default 2-property config)
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface PropertyConfig {
  id: string;
  name: string;
  address: string;
  propertyType: string;
  valuation: string; // e.g. "500000"
  initialRentalPrice: string; // e.g. "2000" (USDC)
  whitelist?: string[];
}

const DEFAULT_PROPERTIES: PropertyConfig[] = [
  {
    id: "prop-1",
    name: "123 Main St",
    address: "123 Main St, San Francisco, CA",
    propertyType: "Single Family",
    valuation: "500000",
    initialRentalPrice: "2000",
  },
  {
    id: "prop-2",
    name: "456 Oak Ave",
    address: "456 Oak Ave, Los Angeles, CA",
    propertyType: "Condo",
    valuation: "350000",
    initialRentalPrice: "1500",
  },
];

async function deployProperty(
  config: PropertyConfig,
  deployer: { address: string },
  stablecoinAddress: string,
  whitelistAddresses: string[]
): Promise<{
  PropertyToken: string;
  PriceManager: string;
  YieldDistributor: string;
  PropertySale: string;
}> {
  const PROPERTY_MANAGER = deployer.address;
  const PAYMENT_PROCESSOR = deployer.address;
  const whitelist = config.whitelist ?? whitelistAddresses;

  const valuation = ethers.parseEther(config.valuation);
  const initialRentalPrice = ethers.parseUnits(config.initialRentalPrice, 6);

  // PropertyToken
  const PropertyTokenFactory = await ethers.getContractFactory("PropertyToken");
  const tokenName = `YieldProp ${config.propertyType}`;
  const tokenSymbol = `YF-${config.id}`;
  const propertyToken = await PropertyTokenFactory.deploy(
    config.address,
    config.propertyType,
    valuation,
    PROPERTY_MANAGER,
    tokenName,
    tokenSymbol
  );
  await propertyToken.waitForDeployment();
  const propertyTokenAddress = await propertyToken.getAddress();

  // PriceManager
  const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
  const priceManager = await PriceManagerFactory.deploy(initialRentalPrice, PROPERTY_MANAGER);
  await priceManager.waitForDeployment();
  const priceManagerAddress = await priceManager.getAddress();

  // YieldDistributor
  const YieldDistributorFactory = await ethers.getContractFactory("YieldDistributor");
  const yieldDistributor = await YieldDistributorFactory.deploy(
    propertyTokenAddress,
    stablecoinAddress,
    PROPERTY_MANAGER,
    PAYMENT_PROCESSOR,
    priceManagerAddress
  );
  await yieldDistributor.waitForDeployment();
  const yieldDistributorAddress = await yieldDistributor.getAddress();

  // Whitelist + register holders
  for (const addr of whitelist) {
    const tx = await propertyToken.addToWhitelist(addr);
    await tx.wait();
  }
  await yieldDistributor.registerHolders(whitelist);

  // PropertySale
  const PropertySaleFactory = await ethers.getContractFactory("PropertySale");
  const propertySale = await PropertySaleFactory.deploy(
    propertyTokenAddress,
    stablecoinAddress,
    PROPERTY_MANAGER,
    deployer.address,
    yieldDistributorAddress
  );
  await propertySale.waitForDeployment();
  const propertySaleAddress = await propertySale.getAddress();

  // Allow PropertySale to auto-register buyers in YieldDistributor
  await (await yieldDistributor.setAuthorizedRegistrar(propertySaleAddress)).wait();

  const totalSupply = await propertyToken.totalSupply();
  await propertyToken.approve(propertySaleAddress, totalSupply);

  return {
    PropertyToken: propertyTokenAddress,
    PriceManager: priceManagerAddress,
    YieldDistributor: yieldDistributorAddress,
    PropertySale: propertySaleAddress,
  };
}

async function main() {
  console.log("🚀 YieldProp Multi-Property Deployment to Sepolia\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const whitelistAddresses = [
    "0x2330e78377A36016B99d5a1376b28dA60f54e0F1",
    "0x166e4bDEfFbCB59B96Ef4c2460C42C60daD0e3f1",
  ];

  let propertiesConfig: PropertyConfig[] = DEFAULT_PROPERTIES;
  const configPath = process.env.PROPERTIES_CONFIG;
  if (configPath) {
    try {
      const raw = fs.readFileSync(path.resolve(configPath), "utf-8");
      propertiesConfig = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to load PROPERTIES_CONFIG:", e);
      process.exit(1);
    }
  }

  // Deploy shared MockUSDC
  console.log("📄 Deploying shared Mock USDC...");
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const stablecoin = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
  await stablecoin.waitForDeployment();
  const stablecoinAddress = await stablecoin.getAddress();
  const mintAmount = ethers.parseUnits("100000", 6);
  await stablecoin.mint(deployer.address, mintAmount);
  console.log("✅ MockUSDC:", stablecoinAddress, "\n");

  const properties: Array<{
    id: string;
    name: string;
    config: PropertyConfig;
    contracts: Record<string, string>;
  }> = [];

  for (let i = 0; i < propertiesConfig.length; i++) {
    const config = propertiesConfig[i];
    console.log(`📄 Deploying property ${i + 1}/${propertiesConfig.length}: ${config.name}...`);
    const contracts = await deployProperty(config, deployer, stablecoinAddress, whitelistAddresses);
    properties.push({
      id: config.id,
      name: config.name,
      config,
      contracts: {
        ...contracts,
        MockUSDC: stablecoinAddress,
      },
    });
    console.log(`   Token: ${contracts.PropertyToken}`);
    console.log(`   PriceManager: ${contracts.PriceManager}`);
    console.log(`   YieldDistributor: ${contracts.YieldDistributor}`);
    console.log(`   PropertySale: ${contracts.PropertySale}\n`);
  }

  const deploymentInfo = {
    network: "sepolia",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    multiProperty: true,
    MockUSDC: stablecoinAddress,
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.config.address,
      propertyType: p.config.propertyType,
      valuation: p.config.valuation,
      contracts: p.contracts,
    })),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);
  const outPath = path.join(deploymentsDir, `sepolia-multi-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Saved:", outPath);

  // Output NEXT_PUBLIC_PROPERTIES_JSON for dashboard
  const propsForEnv = properties.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.config.address,
    propertyType: p.config.propertyType,
    valuation: p.config.valuation,
    contracts: p.contracts,
  }));
  console.log("\n📋 Add to dashboard/.env.local:\n");
  console.log(`NEXT_PUBLIC_PROPERTIES_JSON='${JSON.stringify(propsForEnv)}'`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
