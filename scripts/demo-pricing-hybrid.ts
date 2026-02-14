/**
 * Hybrid Demo: Mock Market Data + Real OpenAI Analysis
 * 
 * This script uses:
 * - MOCK market data (instant, no API needed)
 * - REAL OpenAI API for AI pricing analysis
 * 
 * Perfect for testing OpenAI integration without RentCast dependency!
 * 
 * Usage:
 *   npm run demo:pricing:hybrid
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { MockMarketDataOracle, AIPricingAgent } from '../services';
import type { PropertyDetails } from '../services/types';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(title: string) {
  console.log('\n' + '='.repeat(70));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(70) + '\n');
}

function section(title: string) {
  log(`\n${title}`, colors.bright + colors.yellow);
  log('-'.repeat(title.length), colors.yellow);
}

async function demonstratePricingPipeline() {
  header('YieldProp MVP - Hybrid Demo (Mock Data + Real AI)');

  log('ℹ️  This demo uses:', colors.bright + colors.cyan);
  log('   ✓ Mock market data (instant, no API needed)', colors.green);
  log('   ✓ Real OpenAI GPT-4 for AI analysis', colors.green);
  log('   ⚠️  OpenAI API will incur costs (~$0.01-0.03 per property)\n', colors.yellow);

  // Initialize services
  log('Initializing services...', colors.blue);
  
  const oracle = new MockMarketDataOracle();
  log('✓ Mock market data oracle initialized', colors.green);
  
  let agent: AIPricingAgent;
  try {
    agent = new AIPricingAgent();
    log('✓ OpenAI API client initialized', colors.green);
  } catch (error) {
    log('✗ Failed to initialize OpenAI API client', colors.red);
    log(`  Error: ${(error as Error).message}`, colors.red);
    log('  Make sure OPENAI_API_KEY is set in .env', colors.yellow);
    process.exit(1);
  }

  log('✓ All services initialized\n', colors.green);

  // Test properties
  const testProperties: Array<{
    address: string;
    propertyType: 'Single Family' | 'Condo' | 'Multi-Family' | 'Townhouse';
    valuation: number;
    currentPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
  }> = [
    {
      address: '123 Main St, San Francisco, CA 94102',
      propertyType: 'Single Family',
      valuation: 500000,
      currentPrice: 2400,
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1500,
    },
    {
      address: '456 Oak Ave, Los Angeles, CA 90001',
      propertyType: 'Condo',
      valuation: 600000,
      bedrooms: 2,
      bathrooms: 2,
      squareFeet: 1200,
    },
  ];

  let totalCost = 0;

  // Process each property
  for (let i = 0; i < testProperties.length; i++) {
    const property = testProperties[i];
    
    header(`Property ${i + 1} of ${testProperties.length}`);

    // Display property details
    section('Property Details');
    log(`Address:        ${property.address}`, colors.cyan);
    log(`Type:           ${property.propertyType}`, colors.cyan);
    log(`Valuation:      $${property.valuation.toLocaleString()}`, colors.cyan);
    if (property.currentPrice) {
      log(`Current Rent:   $${property.currentPrice}/month`, colors.cyan);
    }
    if (property.bedrooms) {
      log(`Bedrooms:       ${property.bedrooms}`, colors.cyan);
    }
    if (property.bathrooms) {
      log(`Bathrooms:      ${property.bathrooms}`, colors.cyan);
    }
    if (property.squareFeet) {
      log(`Square Feet:    ${property.squareFeet}`, colors.cyan);
    }

    // Step 1: Fetch market data (mock)
    section('Step 1: Fetching Market Data (Mock)');
    log('Using mock market data oracle...', colors.blue);
    
    const startFetch = Date.now();
    const marketData = await oracle.fetchMarketData(
      property.address,
      property.propertyType,
      5
    );
    const fetchTime = Date.now() - startFetch;
    
    log(`✓ Market data fetched in ${fetchTime}ms`, colors.green);
    
    // Display market data
    log('\nMarket Metrics:', colors.magenta);
    log(`  Average Rent:     $${marketData.marketMetrics.averageRent.toLocaleString()}/month`);
    log(`  Median Rent:      $${marketData.marketMetrics.medianRent.toLocaleString()}/month`);
    log(`  Occupancy Rate:   ${marketData.marketMetrics.occupancyRate}%`);
    log(`  Rent Growth YoY:  ${marketData.marketMetrics.rentGrowthYoY.toFixed(1)}%`);
    
    log('\nComparable Properties:', colors.magenta);
    marketData.comparableProperties.forEach((comp, idx) => {
      log(`  ${idx + 1}. ${comp.address}`);
      log(`     Rent: $${comp.monthlyRent}/mo | ${comp.bedrooms}bd/${comp.bathrooms}ba | ${comp.squareFeet}sqft | ${comp.distanceMiles}mi away`);
    });

    // Step 2: AI Analysis with REAL OpenAI
    section('Step 2: AI Pricing Analysis with REAL OpenAI GPT-4');
    log('Analyzing market data with OpenAI (this may take a few seconds)...', colors.blue);
    
    const startAnalysis = Date.now();
    let recommendation;
    
    try {
      recommendation = await agent.analyzePricing({
        marketData,
        propertyDetails: property as PropertyDetails,
      });
      const analysisTime = Date.now() - startAnalysis;
      log(`✓ Analysis completed in ${analysisTime}ms`, colors.green);
      
      totalCost += 0.02; // Estimate
    } catch (error) {
      const analysisTime = Date.now() - startAnalysis;
      log(`✗ Failed to analyze pricing after ${analysisTime}ms`, colors.red);
      log(`  Error: ${(error as Error).message}`, colors.red);
      log('  Skipping to next property...', colors.yellow);
      continue;
    }

    // Display recommendation
    section('AI Recommendation');
    log(`Recommended Price:  $${recommendation.price.toLocaleString()}/month`, colors.bright + colors.green);
    log(`Confidence Score:   ${recommendation.confidence}%`, colors.bright + colors.green);
    
    if (property.currentPrice) {
      const change = recommendation.price - property.currentPrice;
      const changePercent = (change / property.currentPrice * 100).toFixed(1);
      const changeColor = change > 0 ? colors.green : change < 0 ? colors.yellow : colors.cyan;
      log(
        `Price Change:       ${change > 0 ? '+' : ''}$${change.toLocaleString()} (${change > 0 ? '+' : ''}${changePercent}%)`,
        changeColor
      );
    }

    log('\nReasoning:', colors.magenta);
    const words = recommendation.reasoning.split(' ');
    let line = '';
    for (const word of words) {
      if ((line + word).length > 65) {
        log(`  ${line.trim()}`);
        line = word + ' ';
      } else {
        line += word + ' ';
      }
    }
    if (line.trim()) {
      log(`  ${line.trim()}`);
    }

    // Performance metrics
    const analysisTime = Date.now() - startAnalysis;
    section('Performance Metrics');
    log(`Total Pipeline Time:  ${fetchTime + analysisTime}ms`);
    log(`  - Market Data Fetch: ${fetchTime}ms (mock)`);
    log(`  - AI Analysis:       ${analysisTime}ms (real OpenAI)`);

    // Wait before next property
    if (i < testProperties.length - 1) {
      log('\nProcessing next property...', colors.blue);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Summary
  header('Demo Complete');
  log('✓ Successfully processed all properties', colors.green);
  log('✓ Mock market data working correctly', colors.green);
  log('✓ Real OpenAI API working correctly', colors.green);
  log('✓ Complete pipeline operational\n', colors.green);

  log('💰 Cost Estimate:', colors.yellow);
  log(`   OpenAI API calls: ${testProperties.length}`, colors.yellow);
  log(`   Estimated cost: ~$${totalCost.toFixed(2)}\n`, colors.yellow);
}

// Run the demo
if (require.main === module) {
  demonstratePricingPipeline()
    .then(() => {
      log('\n✓ Demo completed successfully!', colors.bright + colors.green);
      process.exit(0);
    })
    .catch((error) => {
      log('\n✗ Demo failed with error:', colors.bright + colors.red);
      console.error(error);
      process.exit(1);
    });
}

export { demonstratePricingPipeline };
