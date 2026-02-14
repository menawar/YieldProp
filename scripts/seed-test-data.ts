import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🌱 Seeding test data for YieldProp MVP...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Load deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const deploymentFiles = fs.readdirSync(deploymentsDir).filter(f => f.startsWith("sepolia-"));
  
  if (deploymentFiles.length === 0) {
    console.error("❌ No deployment found. Please run deploy script first.");
    process.exit(1);
  }

  // Get the latest deployment
  const latestDeployment = deploymentFiles.sort().reverse()[0];
  const deploymentPath = path.join(deploymentsDir, latestDeployment);
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

  console.log("📄 Using deployment:", latestDeployment);
  console.log("   PropertyToken:", deploymentInfo.contracts.PropertyToken);
  console.log("   PriceManager:", deploymentInfo.contracts.PriceManager);
  console.log("   YieldDistributor:", deploymentInfo.contracts.YieldDistributor);
  console.log("   MockUSDC:", deploymentInfo.contracts.MockUSDC, "\n");

  // Get contract instances
  const propertyToken = await ethers.getContractAt("PropertyToken", deploymentInfo.contracts.PropertyToken);
  const priceManager = await ethers.getContractAt("PriceManager", deploymentInfo.contracts.PriceManager);
  const yieldDistributor = await ethers.getContractAt("YieldDistributor", deploymentInfo.contracts.YieldDistributor);
  const mockUSDC = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.MockUSDC);

  // Step 1: Submit a price recommendation
  console.log("📊 Step 1: Submitting AI price recommendation...");
  const recommendedPrice = ethers.parseUnits("2200", 6); // $2,200 USDC
  const confidence = 85; // 85% confidence
  const reasoning = "Market analysis shows strong demand in the area. Comparable properties are renting for $2,150-$2,300. Recommend increasing rent to $2,200 to optimize yield while maintaining competitiveness.";
  
  const submitTx = await priceManager.submitRecommendation(
    recommendedPrice,
    confidence,
    reasoning
  );
  await submitTx.wait();
  console.log("✅ Price recommendation submitted");
  console.log("   - Recommended Price: $2,200");
  console.log("   - Confidence: 85%");
  console.log("   - Reasoning:", reasoning.substring(0, 50) + "...\n");

  // Step 2: Accept the recommendation (optional - comment out if you want it pending)
  console.log("📊 Step 2: Accepting price recommendation...");
  const acceptTx = await priceManager.acceptRecommendation(1);
  await acceptTx.wait();
  console.log("✅ Price recommendation accepted");
  console.log("   - New rental price: $2,200\n");

  // Step 3: Simulate rental payment
  console.log("💰 Step 3: Simulating rental payment...");
  const rentalPayment = ethers.parseUnits("2200", 6); // $2,200 USDC
  
  // Approve YieldDistributor to spend USDC
  const approveTx = await mockUSDC.approve(await yieldDistributor.getAddress(), rentalPayment);
  await approveTx.wait();
  console.log("✅ Approved YieldDistributor to spend USDC");

  // Receive rental payment
  const paymentTx = await yieldDistributor.receiveRentalPayment(rentalPayment);
  await paymentTx.wait();
  console.log("✅ Rental payment received: $2,200");
  console.log("   - Distribution pool updated\n");

  // Step 4: Distribute yields (optional)
  console.log("💸 Step 4: Distributing yields to token holders...");
  const distributeTx = await yieldDistributor.distributeYields();
  await distributeTx.wait();
  console.log("✅ Yields distributed to all token holders\n");

  // Step 5: Submit another recommendation (pending)
  console.log("📊 Step 5: Submitting another price recommendation (pending)...");
  const newRecommendedPrice = ethers.parseUnits("2300", 6); // $2,300 USDC
  const newConfidence = 78; // 78% confidence
  const newReasoning = "Seasonal demand increase detected. Market trends suggest potential for 4.5% rent increase. However, tenant retention risk should be considered.";
  
  const submitTx2 = await priceManager.submitRecommendation(
    newRecommendedPrice,
    newConfidence,
    newReasoning
  );
  await submitTx2.wait();
  console.log("✅ Second price recommendation submitted (pending review)");
  console.log("   - Recommended Price: $2,300");
  console.log("   - Confidence: 78%\n");

  // Summary
  console.log("=" .repeat(80));
  console.log("🎉 TEST DATA SEEDING COMPLETE!");
  console.log("=" .repeat(80));
  
  console.log("\n📊 Current State:");
  console.log("-".repeat(80));
  
  // Property details
  const propertyDetails = await propertyToken.getPropertyDetails();
  console.log("Property Address:  ", propertyDetails[0]);
  console.log("Property Type:     ", propertyDetails[1]);
  console.log("Valuation:         ", ethers.formatEther(propertyDetails[2]), "ETH");
  console.log("Total Tokens:      ", propertyDetails[3].toString());
  
  // Current rental price
  const currentPrice = await priceManager.currentRentalPrice();
  console.log("Current Rent:      ", ethers.formatUnits(currentPrice, 6), "USDC");
  
  // Recommendation count
  const recCount = await priceManager.recommendationCount();
  console.log("Recommendations:   ", recCount.toString());
  
  // Yield info
  const totalDistributed = await yieldDistributor.getTotalYieldsDistributed();
  const poolBalance = await yieldDistributor.getDistributionPool();
  console.log("Total Distributed: ", ethers.formatUnits(totalDistributed, 6), "USDC");
  console.log("Pool Balance:      ", ethers.formatUnits(poolBalance, 6), "USDC");
  
  console.log("-".repeat(80));

  console.log("\n💡 Dashboard should now display:");
  console.log("-".repeat(80));
  console.log("✅ Property details (address, type, valuation)");
  console.log("✅ Current rental price ($2,200)");
  console.log("✅ Latest AI recommendation (pending: $2,300)");
  console.log("✅ Yield distribution data");
  console.log("✅ Token information");
  console.log("-".repeat(80));

  console.log("\n✨ Seeding completed successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });
