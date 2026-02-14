/**
 * Integration Tests for Market Data Oracle + AI Pricing Agent
 * Demonstrates the complete flow from data fetching to AI analysis
 */

import { expect } from 'chai';
import { MockMarketDataOracle, MockAIPricingAgent } from '../services';

describe('Market Data + AI Pricing Integration', () => {
  let oracle: MockMarketDataOracle;
  let agent: MockAIPricingAgent;

  beforeEach(() => {
    oracle = new MockMarketDataOracle();
    agent = new MockAIPricingAgent();
  });

  /**
   * Test complete flow: fetch market data → analyze pricing
   */
  it('should complete full flow from market data to pricing recommendation', async () => {
    // Step 1: Fetch market data
    const propertyAddress = '123 Main St, San Francisco, CA 94102';
    const propertyType = 'Single Family';
    
    const marketData = await oracle.fetchMarketData(propertyAddress, propertyType);

    // Verify market data
    expect(marketData).to.have.property('location');
    expect(marketData).to.have.property('comparableProperties');
    expect(marketData).to.have.property('marketMetrics');

    // Step 2: Analyze pricing with AI
    const recommendation = await agent.analyzePricing({
      marketData,
      propertyDetails: {
        address: propertyAddress,
        propertyType,
        valuation: 500000,
        currentPrice: 2400,
      },
    });

    // Verify recommendation
    expect(recommendation).to.have.property('price');
    expect(recommendation).to.have.property('confidence');
    expect(recommendation).to.have.property('reasoning');

    // Verify recommendation is reasonable relative to market data
    const { averageRent, medianRent } = marketData.marketMetrics;
    const minExpected = Math.min(averageRent, medianRent) * 0.7;
    const maxExpected = Math.max(averageRent, medianRent) * 1.3;

    expect(recommendation.price).to.be.greaterThan(minExpected);
    expect(recommendation.price).to.be.lessThan(maxExpected);
  });

  /**
   * Test that AI considers market data in reasoning
   */
  it('should reference market data in AI reasoning', async () => {
    const marketData = await oracle.fetchMarketData(
      '456 Oak Ave, Los Angeles, CA 90001',
      'Condo'
    );

    const recommendation = await agent.analyzePricing({
      marketData,
      propertyDetails: {
        address: '456 Oak Ave',
        propertyType: 'Condo',
        valuation: 600000,
      },
    });

    const reasoning = recommendation.reasoning.toLowerCase();

    // Should mention market metrics
    expect(reasoning).to.satisfy((r: string) =>
      r.includes('market') ||
      r.includes('average') ||
      r.includes('median') ||
      r.includes('comparable')
    );

    // Should mention occupancy
    expect(reasoning).to.satisfy((r: string) =>
      r.includes('occupancy') || r.includes('vacancy')
    );
  });

  /**
   * Test with stale market data
   */
  it('should handle stale market data appropriately', async () => {
    const marketData = await oracle.fetchMarketData(
      '789 Pine St, San Diego, CA 92101',
      'Multi-Family'
    );

    // Fresh data recommendation
    const freshRec = await agent.analyzePricing({
      marketData,
      propertyDetails: {
        address: '789 Pine St',
        propertyType: 'Multi-Family',
        valuation: 800000,
      },
    });

    // Stale data recommendation
    const staleRec = await agent.analyzePricing({
      marketData: { ...marketData, isStale: true },
      propertyDetails: {
        address: '789 Pine St',
        propertyType: 'Multi-Family',
        valuation: 800000,
      },
    });

    // Confidence should be lower with stale data
    expect(staleRec.confidence).to.be.lessThan(freshRec.confidence);
  });

  /**
   * Test caching behavior with multiple analyses
   */
  it('should use cached market data for multiple analyses', async () => {
    const propertyAddress = '321 Elm Dr, Sacramento, CA 95814';
    const propertyType = 'Townhouse';

    // First fetch
    const marketData1 = await oracle.fetchMarketData(propertyAddress, propertyType);
    const timestamp1 = marketData1.timestamp;

    // Second fetch (should be cached)
    const marketData2 = await oracle.fetchMarketData(propertyAddress, propertyType);
    const timestamp2 = marketData2.timestamp;

    // Timestamps should be very close (cached)
    expect(Math.abs(timestamp2 - timestamp1)).to.be.lessThan(100);

    // Both should work with AI
    const rec1 = await agent.analyzePricing({
      marketData: marketData1,
      propertyDetails: {
        address: propertyAddress,
        propertyType,
        valuation: 450000,
      },
    });

    const rec2 = await agent.analyzePricing({
      marketData: marketData2,
      propertyDetails: {
        address: propertyAddress,
        propertyType,
        valuation: 450000,
      },
    });

    // Recommendations should be similar (same market data)
    expect(Math.abs(rec1.price - rec2.price)).to.be.lessThan(rec1.price * 0.05); // Within 5%
  });

  /**
   * Test different property types through complete flow
   */
  it('should handle different property types end-to-end', async () => {
    const propertyTypes = ['Single Family', 'Condo', 'Multi-Family', 'Townhouse'];
    const baseAddress = '555 Test St';

    for (const propertyType of propertyTypes) {
      const address = `${baseAddress}, San Francisco, CA 94102`;
      
      // Fetch market data
      const marketData = await oracle.fetchMarketData(address, propertyType);
      
      // Get AI recommendation
      const recommendation = await agent.analyzePricing({
        marketData,
        propertyDetails: {
          address: baseAddress,
          propertyType,
          valuation: 500000,
        },
      });

      // Verify valid recommendation
      expect(recommendation.price).to.be.greaterThan(0);
      expect(recommendation.confidence).to.be.greaterThanOrEqual(0);
      expect(recommendation.confidence).to.be.lessThanOrEqual(100);
      expect(recommendation.reasoning).to.include(propertyType);
    }
  });

  /**
   * Test that recommendations adapt to market conditions
   */
  it('should adapt recommendations to different market conditions', async () => {
    const propertyDetails = {
      address: '666 Market Test St',
      propertyType: 'Single Family' as const,
      valuation: 500000,
    };

    // Hot market (high growth, high occupancy)
    const hotMarketData = await oracle.fetchMarketData(
      propertyDetails.address,
      propertyDetails.propertyType
    );
    hotMarketData.marketMetrics.rentGrowthYoY = 10;
    hotMarketData.marketMetrics.occupancyRate = 98;

    const hotMarketRec = await agent.analyzePricing({
      marketData: hotMarketData,
      propertyDetails,
    });

    // Cold market (negative growth, low occupancy)
    const coldMarketData = await oracle.fetchMarketData(
      propertyDetails.address,
      propertyDetails.propertyType
    );
    coldMarketData.marketMetrics.rentGrowthYoY = -3;
    coldMarketData.marketMetrics.occupancyRate = 85;

    const coldMarketRec = await agent.analyzePricing({
      marketData: coldMarketData,
      propertyDetails,
    });

    // Hot market should recommend higher price
    expect(hotMarketRec.price).to.be.greaterThan(coldMarketRec.price);
  });
});
