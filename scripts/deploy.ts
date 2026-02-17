import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting YieldProp MVP Deployment to Sepolia Testnet...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Configuration
  const PROPERTY_ADDRESS = "123 Main St, San Francisco, CA";
  const PROPERTY_TYPE = "Single Family";
  const PROPERTY_VALUATION = ethers.parseEther("5000"); // $5,000
  const INITIAL_RENTAL_PRICE = ethers.parseUnits("200", 6); // $200 USDC (6 decimals)
  
  // Role addresses
  const PROPERTY_MANAGER = deployer.address; // Using deployer as property manager for simplicity
  const PAYMENT_PROCESSOR = deployer.address; // Using deployer as payment processor for demo
  
  // Whitelist addresses (provided by user)
  const WHITELIST_ADDRESSES = [
    "0x2330e78377A36016B99d5a1376b28dA60f54e0F1"
  ];

  // Step 1: Deploy PropertyToken
  console.log("📄 Step 1: Deploying PropertyToken...");
  const PropertyTokenFactory = await ethers.getContractFactory("PropertyToken");
  const tokenName = `YieldProp ${PROPERTY_TYPE}`;
  const tokenSymbol = `YF-${PROPERTY_ADDRESS.slice(0, 8).replace(/\s/g, "")}`;
  const propertyToken = await PropertyTokenFactory.deploy(
    PROPERTY_ADDRESS,
    PROPERTY_TYPE,
    PROPERTY_VALUATION,
    PROPERTY_MANAGER,
    tokenName,
    tokenSymbol
  );
  await propertyToken.waitForDeployment();
  const propertyTokenAddress = await propertyToken.getAddress();
  console.log("✅ PropertyToken deployed to:", propertyTokenAddress);
  console.log("   - Property:", PROPERTY_ADDRESS);
  console.log("   - Type:", PROPERTY_TYPE);
  console.log("   - Valuation:", ethers.formatEther(PROPERTY_VALUATION), "ETH\n");

  // Step 2: Deploy PriceManager
  console.log("📄 Step 2: Deploying PriceManager...");
  const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
  const priceManager = await PriceManagerFactory.deploy(
    INITIAL_RENTAL_PRICE,
    PROPERTY_MANAGER
  );
  await priceManager.waitForDeployment();
  const priceManagerAddress = await priceManager.getAddress();
  console.log("✅ PriceManager deployed to:", priceManagerAddress);
  console.log("   - Initial Price:", ethers.formatUnits(INITIAL_RENTAL_PRICE, 6), "USDC\n");

  // Step 3: Deploy Mock Stablecoin (for testnet)
  console.log("📄 Step 3: Deploying Mock USDC (testnet stablecoin)...");
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const stablecoin = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
  await stablecoin.waitForDeployment();
  const stablecoinAddress = await stablecoin.getAddress();
  console.log("✅ Mock USDC deployed to:", stablecoinAddress, "\n");

  // Step 4: Deploy YieldDistributor
  console.log("📄 Step 4: Deploying YieldDistributor...");
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
  console.log("✅ YieldDistributor deployed to:", yieldDistributorAddress, "\n");

  // Step 5: Add addresses to whitelist
  console.log("📄 Step 5: Adding addresses to whitelist...");
  for (const address of WHITELIST_ADDRESSES) {
    console.log("   Adding:", address);
    const tx = await propertyToken.addToWhitelist(address);
    await tx.wait();
  }
  console.log("✅ Whitelist addresses added successfully\n");

  // Step 6: Register holders in YieldDistributor
  console.log("📄 Step 6: Registering holders in YieldDistributor...");
  const registerTx = await yieldDistributor.registerHolders(WHITELIST_ADDRESSES);
  await registerTx.wait();
  console.log("✅ Holders registered successfully\n");

  // Step 7: Mint some test USDC to deployer for testing
  console.log("📄 Step 7: Minting test USDC...");
  const mintAmount = ethers.parseUnits("100000", 6); // 100,000 USDC
  const mintTx = await stablecoin.mint(deployer.address, mintAmount);
  await mintTx.wait();
  console.log("✅ Minted", ethers.formatUnits(mintAmount, 6), "USDC to deployer\n");

  // Step 8: Deploy PropertySale for token purchases
  console.log("📄 Step 8: Deploying PropertySale...");
  const PropertySaleFactory = await ethers.getContractFactory("PropertySale");
  const propertySale = await PropertySaleFactory.deploy(
    propertyTokenAddress,
    stablecoinAddress,
    PROPERTY_MANAGER,
    deployer.address, // token holder (deployer has all tokens)
    yieldDistributorAddress
  );
  await propertySale.waitForDeployment();
  const propertySaleAddress = await propertySale.getAddress();
  console.log("✅ PropertySale deployed to:", propertySaleAddress);

  // Allow PropertySale to auto-register buyers in YieldDistributor
  const setRegTx = await yieldDistributor.setAuthorizedRegistrar(propertySaleAddress);
  await setRegTx.wait();
  console.log("✅ PropertySale registered as authorized yield registrar");

  // Approve PropertySale to transfer tokens from deployer
  const totalSupply = await propertyToken.totalSupply();
  const approveTx = await propertyToken.approve(propertySaleAddress, totalSupply);
  await approveTx.wait();
  console.log("✅ Approved PropertySale to transfer tokens from deployer");

  // Summary
  console.log("=" .repeat(80));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(80));
  console.log("\n📋 Deployed Contract Addresses:");
  console.log("-".repeat(80));
  console.log("PropertyToken:     ", propertyTokenAddress);
  console.log("PriceManager:      ", priceManagerAddress);
  console.log("YieldDistributor:  ", yieldDistributorAddress);
  console.log("PropertySale:      ", propertySaleAddress);
  console.log("Mock USDC:         ", stablecoinAddress);
  console.log("-".repeat(80));
  
  console.log("\n👥 Role Addresses:");
  console.log("-".repeat(80));
  console.log("Property Manager:   ", PROPERTY_MANAGER);
  console.log("Payment Processor: ", PAYMENT_PROCESSOR);
  console.log("-".repeat(80));
  
  console.log("\n✅ Whitelisted Addresses:");
  console.log("-".repeat(80));
  WHITELIST_ADDRESSES.forEach((addr, i) => {
    console.log(`${i + 1}. ${addr}`);
  });
  console.log("-".repeat(80));

  console.log("\n📊 Token Distribution:");
  console.log("-".repeat(80));
  const deployerBalance = await propertyToken.balanceOf(deployer.address);
  const salePricePerToken = await propertySale.pricePerToken();
  console.log("Price per token:   ", ethers.formatUnits(salePricePerToken, 6), "USDC");
  console.log("Total Supply:      ", ethers.formatEther(totalSupply), "tokens");
  console.log("Deployer Balance:  ", ethers.formatEther(deployerBalance), "tokens");
  console.log("-".repeat(80));

  console.log("\n💡 Next Steps:");
  console.log("-".repeat(80));
  console.log("1. Update .env file with deployed contract addresses");
  console.log("2. Transfer tokens to whitelisted addresses if needed");
  console.log("3. Test the complete flow:");
  console.log("   - Submit price recommendation");
  console.log("   - Accept recommendation");
  console.log("   - Receive rental payment");
  console.log("   - Distribute yields");
  console.log("4. Build dashboard interface");
  console.log("-".repeat(80));

  // Save deployment info to file
  const deploymentInfo = {
    network: process.env.HARDHAT_NETWORK ?? "sepolia",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      PropertyToken: propertyTokenAddress,
      PriceManager: priceManagerAddress,
      YieldDistributor: yieldDistributorAddress,
      PropertySale: propertySaleAddress,
      MockUSDC: stablecoinAddress
    },
    roles: {
      propertyManager: PROPERTY_MANAGER,
      paymentProcessor: PAYMENT_PROCESSOR
    },
    whitelist: WHITELIST_ADDRESSES,
    configuration: {
      propertyAddress: PROPERTY_ADDRESS,
      propertyType: PROPERTY_TYPE,
      propertyValuation: PROPERTY_VALUATION.toString(),
      initialRentalPrice: INITIAL_RENTAL_PRICE.toString()
    }
  };

  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const networkLabel = process.env.HARDHAT_NETWORK === "tenderly" ? "tenderly" : "sepolia";
  const deploymentFile = path.join(deploymentsDir, `${networkLabel}-${Date.now()}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentFile);

  // When deploying to Tenderly, update CRE config with contract addresses
  if (process.env.HARDHAT_NETWORK === "tenderly" && priceManagerAddress && yieldDistributorAddress) {
    const configPath = path.join(__dirname, "../cre-workflow/yieldprop-workflow/config.tenderly.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.priceManagerAddress = priceManagerAddress;
      config.yieldDistributorAddress = yieldDistributorAddress;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log("📋 Updated cre-workflow/yieldprop-workflow/config.tenderly.json with contract addresses");
    }
  }

  console.log("\n✨ Deployment script completed successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
