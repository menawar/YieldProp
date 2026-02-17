import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Types
interface PropertyConfig {
  id: string;
  name: string;
  address: string;
  propertyType: string;
  valuation: string; // ETH amount as string
  initialRentalPrice: string; // USDC amount as string
  whitelist?: string[];
}

interface DeployedProperty {
  id: string;
  name: string;
  config: PropertyConfig;
  contracts: {
    PropertyToken: string;
    PriceManager: string;
    YieldDistributor: string;
    PropertySale: string;
  };
}

// Default multi-property config
const DEFAULT_MULTI_PROPERTIES: PropertyConfig[] = [
  {
    id: "prop-1",
    name: "123 Main St",
    address: "123 Main St, San Francisco, CA",
    propertyType: "Single Family",
    valuation: "5000",
    initialRentalPrice: "2000",
  },
  {
    id: "prop-2",
    name: "456 Oak Ave",
    address: "456 Oak Ave, Los Angeles, CA",
    propertyType: "Condo",
    valuation: "3500",
    initialRentalPrice: "1500",
  },
];

async function deployProperty(
  config: PropertyConfig,
  deployer: { address: string },
  stablecoinAddress: string,
  whitelistAddresses: string[]
) {
  console.log(`\n📄 Deploying property: ${config.name} (${config.propertyType})...`);

  const PROPERTY_MANAGER = process.env.PROPERTY_MANAGER_ADDRESS || deployer.address;
  const PAYMENT_PROCESSOR = deployer.address;
  const whitelist = config.whitelist ?? whitelistAddresses;

  const valuation = ethers.parseEther(config.valuation);
  const initialRentalPrice = ethers.parseUnits(config.initialRentalPrice, 6);

  // 1. PropertyToken
  const PropertyTokenFactory = await ethers.getContractFactory("PropertyToken");
  const tokenName = `YieldProp ${config.propertyType}`;
  const tokenSymbol = `YF-${config.id.replace(/-/g, "")}`;

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
  console.log(`   ✅ PropertyToken: ${propertyTokenAddress}`);

  // 2. PriceManager
  const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
  const priceManager = await PriceManagerFactory.deploy(initialRentalPrice, PROPERTY_MANAGER);
  await priceManager.waitForDeployment();
  const priceManagerAddress = await priceManager.getAddress();
  console.log(`   ✅ PriceManager: ${priceManagerAddress}`);

  // 3. YieldDistributor
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
  console.log(`   ✅ YieldDistributor: ${yieldDistributorAddress}`);

  // 4. PropertySale
  const PropertySaleFactory = await ethers.getContractFactory("PropertySale");
  const propertySale = await PropertySaleFactory.deploy(
    propertyTokenAddress,
    stablecoinAddress,
    PROPERTY_MANAGER,
    deployer.address, // token holder
    yieldDistributorAddress
  );
  await propertySale.waitForDeployment();
  const propertySaleAddress = await propertySale.getAddress();
  console.log(`   ✅ PropertySale: ${propertySaleAddress}`);

  // Post-deployment setup

  // Whitelist + register holders
  if (whitelist.length > 0) {
    console.log(`   ... Whitelisting ${whitelist.length} addresses`);
    for (const addr of whitelist) {
      await (await propertyToken.addToWhitelist(addr)).wait();
    }
    await (await yieldDistributor.registerHolders(whitelist)).wait();
  }

  // Authorize PropertySale
  await (await yieldDistributor.setAuthorizedRegistrar(propertySaleAddress)).wait();

  // Approve PropertySale
  const totalSupply = await propertyToken.totalSupply();
  await (await propertyToken.approve(propertySaleAddress, totalSupply)).wait();

  return {
    PropertyToken: propertyTokenAddress,
    PriceManager: priceManagerAddress,
    YieldDistributor: yieldDistributorAddress,
    PropertySale: propertySaleAddress,
  };
}

async function main() {
  const isMulti = process.env.MULTI === "true" || process.argv.includes("--multi");
  const network = process.env.HARDHAT_NETWORK || "sepolia";

  console.log(`🚀 Starting YieldProp Deployment (` + (isMulti ? "Multi-Property" : "Single Property") + `) to ${network}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Global whitelist
  const WHITELIST_ADDRESSES = process.env.WHITELIST_ADDRESSES
    ? process.env.WHITELIST_ADDRESSES.split(",").map(a => a.trim())
    : [deployer.address];

  // Deploy Shared Mock USDC
  console.log("📄 Deploying Shared Mock USDC...");
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const stablecoin = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
  await stablecoin.waitForDeployment();
  const stablecoinAddress = await stablecoin.getAddress();
  console.log("✅ Mock USDC:", stablecoinAddress, "\n");

  // Mint test USDC
  const mintAmount = ethers.parseUnits("100000", 6);
  await (await stablecoin.mint(deployer.address, mintAmount)).wait();
  console.log("   Minted 100,000 USDC to deployer");

  // Determine Properties to Deploy
  let propertiesToDeploy: PropertyConfig[] = [];

  if (isMulti) {
    if (process.env.PROPERTIES_CONFIG) {
      const configPath = path.resolve(process.env.PROPERTIES_CONFIG);
      propertiesToDeploy = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } else {
      propertiesToDeploy = DEFAULT_MULTI_PROPERTIES;
    }
  } else {
    // Single Mode - use env vars
    propertiesToDeploy = [{
      id: "default",
      name: "Default Property",
      address: process.env.PROPERTY_ADDRESS || "123 Main St, San Francisco, CA",
      propertyType: process.env.PROPERTY_TYPE || "Single Family",
      valuation: process.env.PROPERTY_VALUATION || "5000",
      initialRentalPrice: process.env.INITIAL_RENTAL_PRICE || "200"
    }];
  }

  const deployedProperties: DeployedProperty[] = [];

  for (const config of propertiesToDeploy) {
    const contracts = await deployProperty(config, deployer, stablecoinAddress, WHITELIST_ADDRESSES);
    deployedProperties.push({
      id: config.id,
      name: config.name,
      config,
      contracts
    });
  }

  // SAVE DEPLOYMENT INFO
  const deploymentInfo = {
    network,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    MockUSDC: stablecoinAddress,
    roles: {
      propertyManager: process.env.PROPERTY_MANAGER_ADDRESS || deployer.address,
      paymentProcessor: deployer.address
    },
    // For backward compatibility with single-prop logic
    ...(!isMulti ? {
      contracts: {
        ...deployedProperties[0].contracts,
        MockUSDC: stablecoinAddress
      },
      configuration: {
        propertyAddress: deployedProperties[0].config.address,
        propertyType: deployedProperties[0].config.propertyType,
        propertyValuation: ethers.parseEther(deployedProperties[0].config.valuation).toString(),
        initialRentalPrice: ethers.parseUnits(deployedProperties[0].config.initialRentalPrice, 6).toString()
      }
    } : {}),
    // Multi-prop format
    properties: deployedProperties.map(p => ({
      id: p.id,
      name: p.name,
      address: p.config.address,
      contracts: p.contracts
    }))
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);

  const networkLabel = network === "tenderly" ? "tenderly" : "sepolia";
  const filename = `${networkLabel}-${Date.now()}.json`;
  const deploymentFile = path.join(deploymentsDir, filename);

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentFile);

  // TENDERLY SPECIFIC: Update CRE Config
  if (network === "tenderly" && deployedProperties.length > 0) {
    const p = deployedProperties[0]; // Update config with first property
    const configPath = path.join(__dirname, "../cre-workflow/yieldprop-workflow/config.tenderly.json");

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.priceManagerAddress = p.contracts.PriceManager;
      config.yieldDistributorAddress = p.contracts.YieldDistributor;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log("📋 Updated cre-workflow/.../config.tenderly.json");
    }
  }

  // DASHBOARD ENV UPDATE HINT
  console.log("\n💡 Next Steps for Dashboard:");
  console.log("Update dashboard/.env.local with:");
  if (isMulti) {
    const propsForEnv = deployedProperties.map(p => ({
      id: p.id,
      name: p.name,
      address: p.config.address,
      propertyType: p.config.propertyType,
      valuation: p.config.valuation,
      contracts: { ...p.contracts, MockUSDC: stablecoinAddress }
    }));
    console.log(`NEXT_PUBLIC_PROPERTIES_JSON='${JSON.stringify(propsForEnv)}'`);
  } else {
    const p = deployedProperties[0];
    console.log(`NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS=${p.contracts.PropertyToken}`);
    console.log(`NEXT_PUBLIC_PRICE_MANAGER_ADDRESS=${p.contracts.PriceManager}`);
    console.log(`NEXT_PUBLIC_YIELD_DISTRIBUTOR_ADDRESS=${p.contracts.YieldDistributor}`);
    console.log(`NEXT_PUBLIC_PROPERTY_SALE_ADDRESS=${p.contracts.PropertySale}`);
    console.log(`NEXT_PUBLIC_USDC_ADDRESS=${stablecoinAddress}`);
  }

  console.log("\n✨ Deployment completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
