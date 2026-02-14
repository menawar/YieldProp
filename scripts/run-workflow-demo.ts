/**
 * Demo CRE Workflow Execution
 * 
 * Execute the YieldProp optimization workflow with fallback to mock data.
 * This demonstrates the complete end-to-end workflow even if APIs are unavailable.
 * 
 * Usage:
 *   npm run workflow:demo
 */

import { MockMarketDataOracle } from "../services/marketDataOracle";
import { MockAIPricingAgent } from "../services/aiPricingAgent";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize mock services
const marketDataOracle = new MockMarketDataOracle();
const aiPricingAgent = new MockAIPricingAgent();

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message: string) {
  console.log();
  log("═".repeat(80), colors.cyan);
  log(`  ${message}`, colors.bright + colors.cyan);
  log("═".repeat(80), colors.cyan);
  console.log();
}

function logStep(stepNum: number, stepName: string) {
  console.log();
  log(`${"─".repeat(80)}`, colors.dim);
  log(`  STEP ${stepNum}: ${stepName}`, colors.bright + colors.blue);
  log(`${"─".repeat(80)}`, colors.dim);
}

function logSuccess(message: string) {
  log(`  ✓ ${message}`, colors.green);
}

function logError(message: string) {
  log(`  ✗ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`  ⚠ ${message}`, colors.yellow);
}

function logInfo(message: string) {
  log(`  ℹ ${message}`, colors.cyan);
}

function logData(label: string, value: any) {
  log(`  ${label}: ${colors.bright}${value}${colors.reset}`, colors.dim);
}

async function runDemoWorkflow() {
  const startTime = Date.now();

  try {
    // Display workflow configuration
    logHeader("YieldProp Demo Workflow Execution");
    logInfo("Executing workflow with MOCK data for demonstration");
    logWarning("Using mock services to demonstrate complete workflow");
    console.log();

    logHeader("Workflow Configuration");
    logData("Property Address", process.env.PROPERTY_ADDRESS || "123 Main St, Austin, TX");
    logData("Property Type", process.env.PROPERTY_TYPE || "Single Family");
    logData("Property Valuation", `$${process.env.PROPERTY_VALUATION || "500000"}`);
    logData("Market Data Radius", `${process.env.MARKET_DATA_RADIUS_MILES || "5"} miles`);

    // Step 1: Fetch Market Data
    logStep(1, "Fetch Market Data from RentCast API");
    logInfo("Fetching market data (using mock service)...");
    
    const marketData = await marketDataOracle.fetchMarketData(
      process.env.PROPERTY_ADDRESS || "123 Main St, Austin, TX",
      process.env.PROPERTY_TYPE || "Single Family",
      parseInt(process.env.MARKET_DATA_RADIUS_MILES || "5")
    );
    
    logSuccess("Market data fetched successfully!");
    console.log();
    logData("  Average Rent", `$${marketData.marketMetrics.averageRent}/month`);
    logData("  Median Rent", `$${marketData.marketMetrics.medianRent}/month`);
    logData("  Comparable Properties", marketData.comparableProperties.length);
    logData("  Occupancy Rate", `${marketData.marketMetrics.occupancyRate}%`);
    logData("  Rent Growth (YoY)", `${marketData.marketMetrics.rentGrowthYoY}%`);
    logData("  Data Freshness", marketData.isStale ? "Cached" : "Fresh");
    logData("  Timestamp", new Date(marketData.timestamp).toLocaleString());

    // Step 2: AI Pricing Analysis
    logStep(2, "AI Pricing Analysis with OpenAI");
    logInfo("Analyzing pricing with AI (using mock service)...");
    
    const propertyDetails = {
      address: process.env.PROPERTY_ADDRESS || "123 Main St, Austin, TX",
      propertyType: process.env.PROPERTY_TYPE || "Single Family",
      valuation: parseInt(process.env.PROPERTY_VALUATION || "500000"),
    };

    const request = {
      marketData,
      propertyDetails,
      currentMonth: new Date().getMonth() + 1,
    };

    const recommendation = await aiPricingAgent.analyzePricing(request);
    
    logSuccess("AI recommendation generated successfully!");
    console.log();
    logData("  Recommended Price", `$${recommendation.price}/month`);
    logData("  Confidence Score", `${recommendation.confidence}%`);
    console.log();
    log(`  ${colors.bright}Reasoning:${colors.reset}`, colors.dim);
    log(`  ${recommendation.reasoning}`, colors.dim);

    // Step 3: Submit Recommendation (Simulated)
    logStep(3, "Submit Recommendation to PriceManager Contract");
    logWarning("Blockchain transaction simulated (requires deployed contracts)");
    logInfo("In production, this would:");
    logInfo(`  • Connect to Ethereum Sepolia testnet`);
    logInfo(`  • Call PriceManager.submitRecommendation()`);
    logInfo(`  • Parameters:`);
    logData("    - Price", recommendation.price);
    logData("    - Confidence", recommendation.confidence);
    logData("    - Reasoning", `"${recommendation.reasoning.substring(0, 50)}..."`);
    
    // Simulate transaction
    await new Promise(resolve => setTimeout(resolve, 1000));
    logSuccess("Transaction submitted successfully (simulated)");
    logData("  Transaction Hash", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
    logData("  Block Number", "12345678");
    logData("  Gas Used", "150,000");

    // Step 4: Check Rental Payment (Simulated)
    logStep(4, "Check Rental Payment in Distribution Pool");
    logWarning("Blockchain call simulated (requires deployed contracts)");
    logInfo("In production, this would:");
    logInfo(`  • Query YieldDistributor.getDistributionPool()`);
    logInfo(`  • Check if rental payment received`);
    
    // Simulate blockchain call
    await new Promise(resolve => setTimeout(resolve, 500));
    logSuccess("Pool balance retrieved successfully (simulated)");
    logData("  Pool Balance", "2,500 USDC");
    logData("  Pool Balance (USD)", "$2,500.00");

    // Step 5: Distribute Yields (Simulated)
    logStep(5, "Distribute Yields to Token Holders");
    logInfo("Pool balance > 0, executing distribution...");
    logInfo("In production, this would:");
    logInfo(`  • Call YieldDistributor.distributeYields()`);
    logInfo(`  • Distribute proportionally to all token holders`);
    logInfo(`  • Record distribution history`);
    
    // Simulate distribution
    await new Promise(resolve => setTimeout(resolve, 1500));
    logSuccess("Yields distributed successfully (simulated)");
    logData("  Transaction Hash", "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
    logData("  Block Number", "12345679");
    logData("  Gas Used", "450,000");
    logData("  Token Holders", "5");
    logData("  Total Distributed", "$2,500.00");

    // Workflow Summary
    const executionTime = Date.now() - startTime;
    logHeader("Workflow Summary");
    logSuccess("Workflow completed successfully!");
    console.log();
    logData("Execution Time", `${executionTime}ms`);
    logData("Steps Completed", "5/5");
    logData("API Calls Made", "2 (Market Data + AI Analysis)");
    logData("Blockchain Transactions", "2 (Submit Recommendation + Distribute Yields)");
    console.log();
    
    logInfo("Workflow execution breakdown:");
    logSuccess("  ✓ Step 1: Market data fetched");
    logSuccess("  ✓ Step 2: AI recommendation generated");
    logSuccess("  ✓ Step 3: Recommendation submitted to blockchain");
    logSuccess("  ✓ Step 4: Rental payment pool checked");
    logSuccess("  ✓ Step 5: Yields distributed to token holders");
    console.log();

    logInfo("This demonstrates the complete YieldProp workflow:");
    logInfo("  1. Automated market data collection");
    logInfo("  2. AI-powered pricing optimization");
    logInfo("  3. On-chain recommendation storage");
    logInfo("  4. Automated yield distribution");
    console.log();

    logSuccess("Demo workflow completed successfully!");
    console.log();

  } catch (error: any) {
    console.log();
    logError("Workflow execution failed!");
    logError(`Error: ${error.message}`);
    if (error.stack) {
      console.log();
      log(error.stack, colors.dim);
    }
    console.log();
    process.exit(1);
  }
}

// Run the demo workflow
runDemoWorkflow();
