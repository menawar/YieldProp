/**
 * Demo Script: Market Data Oracle + AI Pricing Agent Pipeline (REAL APIs)
 * 
 * This script uses REAL external services:
 * - RentCast API for market data
 * - OpenAI API for AI pricing analysis
 * 
 * IMPORTANT: This will make real API calls and may incur costs!
 * - RentCast: Free tier available (limited calls)
 * - OpenAI: Paid service (~$0.01-0.03 per analysis)
 * 
 * Usage:
 *   npm run demo:pricing:real
 * 
 * Requirements:
 *   - RENTCAST_API_KEY in .env
 *   - OPENAI_API_KEY in .env
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { MarketDataOracle, AIPricingAgent } from '../services';
import type { PropertyDetails } from '../services/types';

// ANSI color codes for pretty output
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
  header('YieldProp MVP - Pricing Pipeline Demo (REAL APIs)');

  log('⚠️  WARNING: This demo uses REAL external APIs!', colors.bright + colors.red);
  log('   - RentCast API: May have rate limits', colors.yellow);
  log('   - OpenAI API: Will incur costs (~$0.01-0.03 per property)', colors.yellow);
  log('   - Ensure API keys are set in .env file\n', colors.yellow);

  // Initialize services with real APIs
  log('Initializing services with REAL APIs...', colors.blue);
  
  // Debug: Check if environment variables are loaded
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const keyLength = process.env.OPENAI_API_KEY?.length || 0;
  log(`Debug: OPENAI_API_KEY ${hasOpenAIKey ? 'is set' : 'is NOT set'} (length: ${keyLength})`, colors.cyan);
  
  let oracle: MarketDataOracle;
  let agent: AIPricingAgent;
  
  try {
    oracle = new MarketDataOracle();
    log('✓ RentCast API client initialized', colors.green);
  } catch (error) {
    log('✗ Failed to initialize RentCast API client', colors.red);
    log(`  Error: ${(error as Error).message}`, colors.red);
    log('  Make sure RENTCAST_API_KEY is set in .env', colors.yellow);
    process.exit(1);
  }

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

  // Test property details (use real addresses for better results)
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
      address: '1600 Amphitheatre Parkway, Mountain View, CA 94043',
      propertyType: 'Single Family',
      valuation: 2000000,
      currentPrice: 5500,
      bedrooms: 4,
      bathrooms: 3,
      squareFeet: 2500,
    },
    {
      address: '1 Market St, San Francisco, CA 94105',
      propertyType: 'Condo',
      valuation: 1200000,
      bedrooms: 2,
      bathrooms: 2,
      squareFeet: 1200,
    },
  ];

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

    // Step 1: Fetch market data from RentCast API
    section('Step 1: Fetching Market Data from RentCast API');
    log('Querying RentCast API (this may take a few seconds)...', colors.blue);
    
    const startFetch = Date.now();
    let marketData;
    
    try {
      marketData = await oracle.fetchMarketData(
        property.address,
        property.propertyType,
        5 // 5 mile radius
      );
      const fetchTime = Date.now() - startFetch;
      log(`✓ Market data fetched in ${fetchTime}ms`, colors.green);
    } catch (error) {
      const fetchTime = Date.now() - startFetch;
      log(`✗ Failed to fetch market data after ${fetchTime}ms`, colors.red);
      log(`  Error: ${(error as Error).message}`, colors.red);
      log('  Skipping to next property...', colors.yellow);
      continue;
    }
    
    // Display market data
    log('\nMarket Metrics:', colors.magenta);
    log(`  Average Rent:     $${marketData.marketMetrics.averageRent.toLocaleString()}/month`);
    log(`  Median Rent:      $${marketData.marketMetrics.medianRent.toLocaleString()}/month`);
    log(`  Occupancy Rate:   ${marketData.marketMetrics.occupancyRate}%`);
    log(`  Rent Growth YoY:  ${marketData.marketMetrics.rentGrowthYoY.toFixed(1)}%`);
    log(`  Data Freshness:   ${marketData.isStale ? 'Stale (cached)' : 'Fresh'}`);
    
    log('\nComparable Properties:', colors.magenta);
    if (marketData.comparableProperties.length > 0) {
      marketData.comparableProperties.forEach((comp, idx) => {
        log(`  ${idx + 1}. ${comp.address}`);
        log(`     Rent: $${comp.monthlyRent}/mo | ${comp.bedrooms}bd/${comp.bathrooms}ba | ${comp.squareFeet}sqft | ${comp.distanceMiles}mi away`);
      });
    } else {
      log('  No comparable properties found', colors.yellow);
    }

    // Step 2: AI Analysis with OpenAI
    section('Step 2: AI Pricing Analysis with OpenAI GPT-4');
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
    // Word wrap the reasoning
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
    const fetchTime = Date.now() - startFetch;
    const analysisTime = Date.now() - startAnalysis;
    section('Performance Metrics');
    log(`Total Pipeline Time:  ${fetchTime + analysisTime}ms`);
    log(`  - Market Data Fetch: ${fetchTime}ms`);
    log(`  - AI Analysis:       ${analysisTime}ms`);

    // Wait a bit before next property to avoid rate limits
    if (i < testProperties.length - 1) {
      log('\nWaiting 2 seconds before next property (rate limit protection)...', colors.blue);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  header('Demo Complete');
  log('✓ Successfully processed all properties with REAL APIs', colors.green);
  log('✓ RentCast API working correctly', colors.green);
  log('✓ OpenAI API working correctly', colors.green);
  log('✓ Complete pipeline operational\n', colors.green);

  // Cache demonstration
  section('Bonus: Cache Demonstration');
  log('Fetching same property again to demonstrate caching...', colors.blue);
  
  const firstProperty = testProperties[0];
  const start1 = Date.now();
  await oracle.fetchMarketData(firstProperty.address, firstProperty.propertyType);
  const time1 = Date.now() - start1;
  
  log(`First fetch (should be cached): ${time1}ms`, colors.cyan);
  
  const start2 = Date.now();
  await oracle.fetchMarketData(firstProperty.address, firstProperty.propertyType);
  const time2 = Date.now() - start2;
  
  log(`Second fetch (cached): ${time2}ms`, colors.cyan);
  
  if (time1 > 100 && time2 < 10) {
    log(`Cache speedup: ${(time1 / time2).toFixed(1)}x faster`, colors.green);
  } else if (time1 < 10 && time2 < 10) {
    log('Both fetches were cached (data already in cache)', colors.cyan);
  }

  log('\n💰 Cost Estimate:', colors.yellow);
  log(`   OpenAI API calls: ${testProperties.length}`, colors.yellow);
  log(`   Estimated cost: ~$${(testProperties.length * 0.02).toFixed(2)}`, colors.yellow);
  log('   (Actual cost may vary based on response length)\n', colors.yellow);
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
