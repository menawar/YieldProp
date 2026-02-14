/**
 * Interactive Pricing Demo (REAL APIs)
 * 
 * This script uses REAL external services:
 * - RentCast API for market data
 * - OpenAI API for AI pricing analysis
 * 
 * IMPORTANT: This will make real API calls and may incur costs!
 * 
 * Usage:
 *   npm run demo:interactive:real
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import * as readline from 'readline';
import { MarketDataOracle, AIPricingAgent } from '../services';
import type { PropertyDetails } from '../services/types';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

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

async function runInteractiveDemo() {
  console.clear();
  log('╔════════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║   YieldProp MVP - Interactive Pricing Demo (REAL APIs)        ║', colors.bright + colors.cyan);
  log('╚════════════════════════════════════════════════════════════════╝', colors.cyan);
  console.log();

  log('⚠️  WARNING: This demo uses REAL external APIs!', colors.bright + colors.red);
  log('   - RentCast API: May have rate limits', colors.yellow);
  log('   - OpenAI API: Will incur costs (~$0.01-0.03 per analysis)', colors.yellow);
  console.log();

  // Initialize services
  log('Initializing services...', colors.blue);
  
  let oracle: MarketDataOracle;
  let agent: AIPricingAgent;
  
  try {
    oracle = new MarketDataOracle();
    log('✓ RentCast API client initialized', colors.green);
  } catch (error) {
    log('✗ Failed to initialize RentCast API', colors.red);
    log(`  Error: ${(error as Error).message}`, colors.red);
    log('  Make sure RENTCAST_API_KEY is set in .env', colors.yellow);
    rl.close();
    process.exit(1);
  }

  try {
    agent = new AIPricingAgent();
    log('✓ OpenAI API client initialized', colors.green);
  } catch (error) {
    log('✗ Failed to initialize OpenAI API', colors.red);
    log(`  Error: ${(error as Error).message}`, colors.red);
    log('  Make sure OPENAI_API_KEY is set in .env', colors.yellow);
    rl.close();
    process.exit(1);
  }

  let totalCost = 0;
  let propertiesAnalyzed = 0;

  while (true) {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.blue);
    log('Enter Property Details (or type "exit" to quit)', colors.bright);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.blue);

    // Get property address
    const address = await question('\n📍 Property Address (full address for best results): ');
    if (address.toLowerCase() === 'exit') break;

    // Get property type
    log('\n🏠 Property Type:', colors.yellow);
    log('  1. Single Family');
    log('  2. Condo');
    log('  3. Multi-Family');
    log('  4. Townhouse');
    const typeChoice = await question('Select (1-4): ');
    const propertyTypes = ['Single Family', 'Condo', 'Multi-Family', 'Townhouse'];
    const propertyType = propertyTypes[parseInt(typeChoice) - 1] || 'Single Family';

    // Get valuation
    const valuationStr = await question('\n💰 Property Valuation: $');
    const valuation = parseInt(valuationStr) || 500000;

    // Get current price (optional)
    const currentPriceStr = await question('\n💵 Current Monthly Rent (press Enter to skip): $');
    const currentPrice = currentPriceStr ? parseInt(currentPriceStr) : undefined;

    // Get bedrooms (optional)
    const bedroomsStr = await question('\n🛏️  Bedrooms (press Enter to skip): ');
    const bedrooms = bedroomsStr ? parseInt(bedroomsStr) : undefined;

    // Get bathrooms (optional)
    const bathroomsStr = await question('\n🚿 Bathrooms (press Enter to skip): ');
    const bathrooms = bathroomsStr ? parseFloat(bathroomsStr) : undefined;

    // Get square feet (optional)
    const squareFeetStr = await question('\n📐 Square Feet (press Enter to skip): ');
    const squareFeet = squareFeetStr ? parseInt(squareFeetStr) : undefined;

    // Get search radius
    const radiusStr = await question('\n📏 Search Radius in miles (default 5): ');
    const radius = radiusStr ? parseInt(radiusStr) : 5;

    // Process the request
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.green);
    log('Processing with REAL APIs...', colors.bright + colors.green);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.green);

    try {
      // Fetch market data from RentCast
      log('\n⏳ Fetching market data from RentCast API...', colors.blue);
      log('   (This may take a few seconds)', colors.cyan);
      const startFetch = Date.now();
      const marketData = await oracle.fetchMarketData(address, propertyType as any, radius);
      const fetchTime = Date.now() - startFetch;
      log(`✓ Market data fetched in ${fetchTime}ms`, colors.green);

      // Display market data
      log('\n📊 Market Metrics:', colors.magenta);
      console.log(`   Average Rent:     $${marketData.marketMetrics.averageRent.toLocaleString()}/month`);
      console.log(`   Median Rent:      $${marketData.marketMetrics.medianRent.toLocaleString()}/month`);
      console.log(`   Occupancy Rate:   ${marketData.marketMetrics.occupancyRate}%`);
      console.log(`   Rent Growth YoY:  ${marketData.marketMetrics.rentGrowthYoY.toFixed(1)}%`);
      console.log(`   Data Freshness:   ${marketData.isStale ? 'Stale (cached)' : 'Fresh'}`);

      log('\n🏘️  Comparable Properties:', colors.magenta);
      if (marketData.comparableProperties.length > 0) {
        marketData.comparableProperties.slice(0, 5).forEach((comp, idx) => {
          console.log(`   ${idx + 1}. ${comp.address}`);
          console.log(`      $${comp.monthlyRent}/mo | ${comp.bedrooms}bd/${comp.bathrooms}ba | ${comp.squareFeet}sqft | ${comp.distanceMiles}mi`);
        });
        if (marketData.comparableProperties.length > 5) {
          console.log(`   ... and ${marketData.comparableProperties.length - 5} more`);
        }
      } else {
        log('   No comparable properties found', colors.yellow);
      }

      // AI Analysis with OpenAI
      log('\n🤖 Running AI analysis with OpenAI GPT-4...', colors.blue);
      log('   (This may take a few seconds)', colors.cyan);
      const startAnalysis = Date.now();
      const recommendation = await agent.analyzePricing({
        marketData,
        propertyDetails: {
          address,
          propertyType: propertyType as any,
          valuation,
          currentPrice,
          bedrooms,
          bathrooms,
          squareFeet,
        },
      });
      const analysisTime = Date.now() - startAnalysis;
      log(`✓ Analysis completed in ${analysisTime}ms`, colors.green);

      // Estimate cost
      const estimatedCost = 0.02; // Rough estimate per analysis
      totalCost += estimatedCost;
      propertiesAnalyzed++;

      // Display recommendation
      log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.bright + colors.green);
      log('🎯 AI RECOMMENDATION', colors.bright + colors.green);
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.bright + colors.green);
      
      log(`\n💵 Recommended Price: $${recommendation.price.toLocaleString()}/month`, colors.bright + colors.green);
      log(`📈 Confidence Score: ${recommendation.confidence}%`, colors.bright + colors.green);

      if (currentPrice) {
        const change = recommendation.price - currentPrice;
        const changePercent = (change / currentPrice * 100).toFixed(1);
        const changeColor = change > 0 ? colors.green : change < 0 ? colors.yellow : colors.cyan;
        log(
          `📊 Price Change: ${change > 0 ? '+' : ''}$${change.toLocaleString()} (${change > 0 ? '+' : ''}${changePercent}%)`,
          changeColor
        );
      }

      log('\n📝 Reasoning:', colors.magenta);
      console.log();
      const words = recommendation.reasoning.split(' ');
      let line = '   ';
      for (const word of words) {
        if ((line + word).length > 65) {
          console.log(line.trim());
          line = '   ' + word + ' ';
        } else {
          line += word + ' ';
        }
      }
      if (line.trim()) {
        console.log(line.trim());
      }

      log('\n⚡ Performance:', colors.cyan);
      console.log(`   Total Time: ${fetchTime + analysisTime}ms`);
      console.log(`   Market Data: ${fetchTime}ms`);
      console.log(`   AI Analysis: ${analysisTime}ms`);

      log('\n💰 Cost Estimate:', colors.yellow);
      console.log(`   This analysis: ~$${estimatedCost.toFixed(2)}`);
      console.log(`   Session total: ~$${totalCost.toFixed(2)} (${propertiesAnalyzed} ${propertiesAnalyzed === 1 ? 'property' : 'properties'})`);

    } catch (error) {
      log('\n✗ Error occurred:', colors.bright + colors.red);
      console.error(error);
      log('\nPossible issues:', colors.yellow);
      log('  - Invalid address format', colors.yellow);
      log('  - API rate limit exceeded', colors.yellow);
      log('  - Network connectivity issues', colors.yellow);
      log('  - Invalid API keys', colors.yellow);
    }

    // Ask if user wants to continue
    const continueChoice = await question('\n\nAnalyze another property? (y/n): ');
    if (continueChoice.toLowerCase() !== 'y') {
      break;
    }

    // Rate limit protection
    log('\nWaiting 2 seconds (rate limit protection)...', colors.blue);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
  log('Session Summary', colors.bright + colors.cyan);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
  log(`\nProperties Analyzed: ${propertiesAnalyzed}`, colors.green);
  log(`Estimated Total Cost: ~$${totalCost.toFixed(2)}`, colors.yellow);
  log('\n✓ Thank you for using YieldProp MVP!', colors.bright + colors.green);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', colors.cyan);
  
  rl.close();
}

// Run the interactive demo
if (require.main === module) {
  runInteractiveDemo()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { runInteractiveDemo };
