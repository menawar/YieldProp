/**
 * Interactive Pricing Demo
 * 
 * This script allows you to manually test the pricing pipeline
 * with custom property details.
 * 
 * Usage:
 *   npm run demo:interactive
 */

import * as readline from 'readline';
import { MockMarketDataOracle, MockAIPricingAgent } from '../services';
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
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function runInteractiveDemo() {
  console.clear();
  log('╔════════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║     YieldProp MVP - Interactive Pricing Demo                  ║', colors.bright + colors.cyan);
  log('╚════════════════════════════════════════════════════════════════╝', colors.cyan);
  console.log();

  const oracle = new MockMarketDataOracle();
  const agent = new MockAIPricingAgent();

  while (true) {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.blue);
    log('Enter Property Details (or type "exit" to quit)', colors.bright);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.blue);

    // Get property address
    const address = await question('\n📍 Property Address (e.g., "123 Main St, San Francisco, CA 94102"): ');
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
    const valuationStr = await question('\n💰 Property Valuation (e.g., 500000): $');
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

    // Process the request
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.green);
    log('Processing...', colors.bright + colors.green);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.green);

    try {
      // Fetch market data
      log('\n⏳ Fetching market data...', colors.blue);
      const startFetch = Date.now();
      const marketData = await oracle.fetchMarketData(address, propertyType as any, 5);
      const fetchTime = Date.now() - startFetch;
      log(`✓ Market data fetched in ${fetchTime}ms`, colors.green);

      // Display market data
      log('\n📊 Market Metrics:', colors.magenta);
      console.log(`   Average Rent:     $${marketData.marketMetrics.averageRent.toLocaleString()}/month`);
      console.log(`   Median Rent:      $${marketData.marketMetrics.medianRent.toLocaleString()}/month`);
      console.log(`   Occupancy Rate:   ${marketData.marketMetrics.occupancyRate}%`);
      console.log(`   Rent Growth YoY:  ${marketData.marketMetrics.rentGrowthYoY.toFixed(1)}%`);

      log('\n🏘️  Comparable Properties:', colors.magenta);
      marketData.comparableProperties.forEach((comp, idx) => {
        console.log(`   ${idx + 1}. ${comp.address}`);
        console.log(`      $${comp.monthlyRent}/mo | ${comp.bedrooms}bd/${comp.bathrooms}ba | ${comp.squareFeet}sqft | ${comp.distanceMiles}mi`);
      });

      // AI Analysis
      log('\n🤖 Running AI analysis...', colors.blue);
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

    } catch (error) {
      log('\n✗ Error occurred:', colors.bright + '\x1b[31m');
      console.error(error);
    }

    // Ask if user wants to continue
    const continueChoice = await question('\n\nAnalyze another property? (y/n): ');
    if (continueChoice.toLowerCase() !== 'y') {
      break;
    }
  }

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
