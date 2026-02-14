/**
 * Real CRE Workflow Execution
 * 
 * Execute the YieldProp optimization workflow with REAL API calls.
 * This demonstrates the complete end-to-end workflow:
 * 1. Fetch REAL market data from RentCast API
 * 2. Analyze pricing with REAL OpenAI API
 * 3. Display recommendation (blockchain calls are simulated)
 * 
 * Usage:
 *   npm run workflow:real
 * 
 * Requirements:
 *   - Valid RENTCAST_API_KEY in .env
 *   - Valid OPENAI_API_KEY in .env
 *   - All other environment variables set
 */

import { MarketDataOracle } from "../services/marketDataOracle";
import { AIPricingAgent } from "../services/aiPricingAgent";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize services
const marketDataOracle = new MarketDataOracle();
const aiPricingAgent = new AIPricingAgent();

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

async function validateEnvironment(): Promise<boolean> {
  logHeader("Environment Validation");

  const requiredVars = [
    "RENTCAST_API_KEY",
    "RENTCAST_API_URL",
    "OPENAI_API_KEY",
    "PROPERTY_ADDRESS",
    "PROPERTY_TYPE",
    "PROPERTY_VALUATION",
  ];

  let allValid = true;

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      logSuccess(`${varName}: Set`);
    } else {
      logError(`${varName}: Missing`);
      allValid = false;
    }
  }

  console.log();

  if (!allValid) {
    logError("Some required environment variables are missing!");
    logInfo("Please check your .env file and ensure all variables are set.");
    return false;
  }

  logSuccess("All required environment variables are set!");
  return true;
}

async function runRealWorkflow() {
  const startTime = Date.now();

  try {
    // Validate environment
    const envValid = await validateEnvironment();
    if (!envValid) {
      process.exit(1);
    }

    // Display workflow configuration
    logHeader("Workflow Configuration");
    logData("Property Address", process.env.PROPERTY_ADDRESS);
    logData("Property Type", process.env.PROPERTY_TYPE);
    logData("Property Valuation", `$${process.env.PROPERTY_VALUATION}`);
    logData("Market Data Radius", `${process.env.MARKET_DATA_RADIUS_MILES || "5"} miles`);

    // Step 1: Fetch Market Data
    logStep(1, "Fetch Market Data from RentCast API");
    logInfo("Calling RentCast API...");
    
    let marketData;
    try {
      marketData = await marketDataOracle.fetchMarketData(
        process.env.PROPERTY_ADDRESS!,
        process.env.PROPERTY_TYPE!,
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
    } catch (error: any) {
      logError(`Failed to fetch market data: ${error.message}`);
      logWarning("Workflow cannot continue without market data");
      process.exit(1);
    }

    // Step 2: AI Pricing Analysis
    logStep(2, "AI Pricing Analysis with OpenAI");
    logInfo("Calling OpenAI API for pricing analysis...");
    
    let recommendation;
    try {
      // Build property details
      const propertyDetails = {
        address: process.env.PROPERTY_ADDRESS!,
        propertyType: process.env.PROPERTY_TYPE!,
        valuation: parseInt(process.env.PROPERTY_VALUATION!),
      };

      // Build pricing analysis request
      const request = {
        marketData,
        propertyDetails,
        currentMonth: new Date().getMonth() + 1,
      };

      recommendation = await aiPricingAgent.analyzePricing(request);
      
      logSuccess("AI recommendation generated successfully!");
      console.log();
      logData("  Recommended Price", `$${recommendation.price}/month`);
      logData("  Confidence Score", `${recommendation.confidence}%`);
      console.log();
      log(`  ${colors.bright}Reasoning:${colors.reset}`, colors.dim);
      log(`  ${recommendation.reasoning}`, colors.dim);
    } catch (error: any) {
      logError(`Failed to generate AI recommendation: ${error.message}`);
      logWarning("Workflow cannot continue without AI analysis");
      process.exit(1);
    }

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
    logSuccess("Transaction would be submitted and confirmed");

    // Step 4: Check Rental Payment (Simulated)
    logStep(4, "Check Rental Payment in Distribution Pool");
    logWarning("Blockchain call simulated (requires deployed contracts)");
    logInfo("In production, this would:");
    logInfo(`  • Query YieldDistributor.getDistributionPool()`);
    logInfo(`  • Check if rental payment received`);
    logSuccess("Pool balance would be retrieved");

    // Step 5: Distribute Yields (Simulated)
    logStep(5, "Distribute Yields to Token Holders");
    logWarning("Step skipped: Conditional execution (pool balance = 0)");
    logInfo("In production, this would:");
    logInfo(`  • Only execute if pool balance > 0`);
    logInfo(`  • Call YieldDistributor.distributeYields()`);
    logInfo(`  • Distribute proportionally to all token holders`);

    // Workflow Summary
    const executionTime = Date.now() - startTime;
    logHeader("Workflow Summary");
    logSuccess("Workflow completed successfully!");
    console.log();
    logData("Execution Time", `${executionTime}ms`);
    logData("Steps Completed", "2/5 (real) + 3/5 (simulated)");
    logData("API Calls Made", "2 (RentCast + OpenAI)");
    logData("Blockchain Calls", "0 (simulated)");
    console.log();
    
    logInfo("Real API calls executed:");
    logSuccess("  ✓ RentCast market data fetch");
    logSuccess("  ✓ OpenAI pricing analysis");
    console.log();
    
    logInfo("Simulated steps (require deployed contracts):");
    logWarning("  ○ Submit recommendation to blockchain");
    logWarning("  ○ Check rental payment pool");
    logWarning("  ○ Distribute yields");
    console.log();

    logInfo("Next steps to enable full workflow:");
    logInfo("  1. Complete Task 7: Deploy contracts to Sepolia");
    logInfo("  2. Update .env with deployed contract addresses");
    logInfo("  3. Set up Chainlink CRE runtime");
    logInfo("  4. Configure workflow triggers");
    console.log();

    logSuccess("Real-time workflow demonstration completed!");
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

// Run the workflow
logHeader("YieldProp Real Workflow Execution");
logInfo("Executing workflow with REAL API calls");
logWarning("This will consume API credits (RentCast + OpenAI)");
console.log();

runRealWorkflow();
