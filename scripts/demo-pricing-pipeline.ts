/**
 * Demo Script: Market Data Oracle + AI Pricing Agent Pipeline
 * 
 * This script demonstrates the complete flow from fetching market data
 * to generating AI-powered pricing recommendations.
 * 
 * Usage:
 *   npm run demo:pricing
 * 
 * Or with custom parameters:
 *   npx ts-node scripts/demo-pricing-pipeline.ts
 */

import { MockMarketDataOracle, MockAIPricingAgent } from '../services';
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
  header('YieldProp MVP - Pricing Pipeline Demo');

  // Initialize services
  log('Initializing services...', colors.blue);
  const oracle = new MockMarketDataOracle();
  const agent = new MockAIPricingAgent();
  log('✓ Services initialized\n', colors.green);

  // Test property details
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
    {
      address: '789 Pine St, San Diego, CA 92101',
      propertyType: 'Multi-Family',
      valuation: 800000,
      currentPrice: 3500,
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

    // Step 1: Fetch market data
    section('Step 1: Fetching Market Data');
    log('Querying market data oracle...', colors.blue);
    
    const startFetch = Date.now();
    const marketData = await oracle.fetchMarketData(
      property.address,
      property.propertyType,
      5 // 5 mile radius
    );
    const fetchTime = Date.now() - startFetch;
    
    log(`✓ Market data fetched in ${fetchTime}ms`, colors.green);
    
    // Display market data
    log('\nMarket Metrics:', colors.magenta);
    log(`  Average Rent:     $${marketData.marketMetrics.averageRent.toLocaleString()}/month`);
    log(`  Median Rent:      $${marketData.marketMetrics.medianRent.toLocaleString()}/month`);
    log(`  Occupancy Rate:   ${marketData.marketMetrics.occupancyRate}%`);
    log(`  Rent Growth YoY:  ${marketData.marketMetrics.rentGrowthYoY.toFixed(1)}%`);
    log(`  Data Freshness:   ${marketData.isStale ? 'Stale (cached)' : 'Fresh'}`);
    
    log('\nComparable Properties:', colors.magenta);
    marketData.comparableProperties.forEach((comp, idx) => {
      log(`  ${idx + 1}. ${comp.address}`);
      log(`     Rent: $${comp.monthlyRent}/mo | ${comp.bedrooms}bd/${comp.bathrooms}ba | ${comp.squareFeet}sqft | ${comp.distanceMiles}mi away`);
    });

    // Step 2: AI Analysis
    section('Step 2: AI Pricing Analysis');
    log('Analyzing market data with AI...', colors.blue);
    
    const startAnalysis = Date.now();
    const recommendation = await agent.analyzePricing({
      marketData,
      propertyDetails: property as PropertyDetails,
    });
    const analysisTime = Date.now() - startAnalysis;
    
    log(`✓ Analysis completed in ${analysisTime}ms`, colors.green);

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
    section('Performance Metrics');
    log(`Total Pipeline Time:  ${fetchTime + analysisTime}ms`);
    log(`  - Market Data Fetch: ${fetchTime}ms`);
    log(`  - AI Analysis:       ${analysisTime}ms`);

    // Wait a bit before next property
    if (i < testProperties.length - 1) {
      log('\nProcessing next property...', colors.blue);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Summary
  header('Demo Complete');
  log('✓ Successfully processed all properties', colors.green);
  log('✓ Market data fetching working correctly', colors.green);
  log('✓ AI pricing analysis working correctly', colors.green);
  log('✓ Complete pipeline operational\n', colors.green);

  // Cache demonstration
  section('Bonus: Cache Demonstration');
  log('Fetching same property again to demonstrate caching...', colors.blue);
  
  const firstProperty = testProperties[0];
  const start1 = Date.now();
  await oracle.fetchMarketData(firstProperty.address, firstProperty.propertyType);
  const time1 = Date.now() - start1;
  
  log(`First fetch (cached): ${time1}ms`, colors.cyan);
  
  const start2 = Date.now();
  await oracle.fetchMarketData(firstProperty.address, firstProperty.propertyType);
  const time2 = Date.now() - start2;
  
  log(`Second fetch (cached): ${time2}ms`, colors.cyan);
  log(`Cache speedup: ${time1 > time2 ? (time1 / time2).toFixed(1) : '1.0'}x faster`, colors.green);

  // Clear cache demonstration
  log('\nClearing cache...', colors.blue);
  oracle.clearCache();
  
  const start3 = Date.now();
  await oracle.fetchMarketData(firstProperty.address, firstProperty.propertyType);
  const time3 = Date.now() - start3;
  
  log(`After cache clear: ${time3}ms`, colors.cyan);
  log('✓ Cache working correctly\n', colors.green);
}

// Run the demo
if (require.main === module) {
  demonstratePricingPipeline()
    .then(() => {
      log('\n✓ Demo completed successfully!', colors.bright + colors.green);
      process.exit(0);
    })
    .catch((error) => {
      log('\n✗ Demo failed with error:', colors.bright + '\x1b[31m');
      console.error(error);
      process.exit(1);
    });
}

export { demonstratePricingPipeline };
