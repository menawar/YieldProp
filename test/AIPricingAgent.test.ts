/**
 * Unit Tests for AI Pricing Agent Service
 * Requirements: 4.2, 4.3, 13.2
 */

import { expect } from 'chai';
import { MockAIPricingAgent, AIPricingAgent } from '../services/aiPricingAgent';
import { MarketData, PropertyDetails, PricingAnalysisRequest } from '../services/types';

describe('AIPricingAgent Unit Tests', () => {
  describe('MockAIPricingAgent', () => {
    let agent: MockAIPricingAgent;

    beforeEach(() => {
      agent = new MockAIPricingAgent();
    });

    /**
     * Test successful analysis with valid market data
     * Requirement: 4.2, 4.3
     */
    it('should successfully analyze pricing with valid market data', async () => {
      const marketData: MarketData = {
        location: {
          address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
        },
        comparableProperties: [
          {
            address: '100 Main St',
            monthlyRent: 2500,
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1500,
            distanceMiles: 0.5,
          },
          {
            address: '200 Oak Ave',
            monthlyRent: 2700,
            bedrooms: 3,
            bathrooms: 2.5,
            squareFeet: 1600,
            distanceMiles: 1.2,
          },
        ],
        marketMetrics: {
          averageRent: 2600,
          medianRent: 2500,
          occupancyRate: 95,
          rentGrowthYoY: 3.5,
        },
        timestamp: Date.now(),
        isStale: false,
      };

      const propertyDetails: PropertyDetails = {
        address: '123 Main St',
        propertyType: 'Single Family',
        valuation: 500000,
        currentPrice: 2400,
      };

      const recommendation = await agent.analyzePricing({
        marketData,
        propertyDetails,
      });

      // Verify structure
      expect(recommendation).to.have.property('price');
      expect(recommendation).to.have.property('confidence');
      expect(recommendation).to.have.property('reasoning');

      // Verify types and ranges
      expect(recommendation.price).to.be.a('number').and.be.greaterThan(0);
      expect(recommendation.confidence).to.be.a('number')
        .and.be.greaterThanOrEqual(0)
        .and.be.lessThanOrEqual(100);
      expect(recommendation.reasoning).to.be.a('string')
        .and.have.length.greaterThanOrEqual(100);
    });

    /**
     * Test response parsing and validation
     * Requirement: 4.2, 4.3
     */
    it('should return properly formatted recommendation', async () => {
      const marketData: MarketData = {
        location: {
          address: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001',
        },
        comparableProperties: [
          {
            address: '100 Test St',
            monthlyRent: 3000,
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1500,
            distanceMiles: 0.5,
          },
        ],
        marketMetrics: {
          averageRent: 3000,
          medianRent: 3000,
          occupancyRate: 92,
          rentGrowthYoY: 5.0,
        },
        timestamp: Date.now(),
        isStale: false,
      };

      const propertyDetails: PropertyDetails = {
        address: '456 Oak Ave',
        propertyType: 'Condo',
        valuation: 600000,
      };

      const recommendation = await agent.analyzePricing({
        marketData,
        propertyDetails,
      });

      // Price should be an integer (rounded)
      expect(Number.isInteger(recommendation.price)).to.be.true;

      // Confidence should be an integer
      expect(Number.isInteger(recommendation.confidence)).to.be.true;

      // Reasoning should be substantial
      expect(recommendation.reasoning.length).to.be.greaterThan(200);
    });

    /**
     * Test with different property types
     */
    it('should handle different property types', async () => {
      const propertyTypes = ['Single Family', 'Condo', 'Multi-Family', 'Townhouse'];

      for (const propertyType of propertyTypes) {
        const marketData: MarketData = {
          location: {
            address: '789 Test Ave',
            city: 'San Diego',
            state: 'CA',
            zipCode: '92101',
          },
          comparableProperties: [
            {
              address: '100 Main St',
              monthlyRent: 2800,
              bedrooms: 3,
              bathrooms: 2,
              squareFeet: 1500,
              distanceMiles: 0.5,
            },
          ],
          marketMetrics: {
            averageRent: 2800,
            medianRent: 2800,
            occupancyRate: 95,
            rentGrowthYoY: 3.5,
          },
          timestamp: Date.now(),
          isStale: false,
        };

        const propertyDetails: PropertyDetails = {
          address: '789 Test Ave',
          propertyType,
          valuation: 500000,
        };

        const recommendation = await agent.analyzePricing({
          marketData,
          propertyDetails,
        });

        expect(recommendation.price).to.be.greaterThan(0);
        expect(recommendation.confidence).to.be.greaterThanOrEqual(0);
        expect(recommendation.reasoning).to.include(propertyType);
      }
    });

    /**
     * Test with high rent growth
     */
    it('should recommend higher prices in growing markets', async () => {
      const baseMarketData: MarketData = {
        location: {
          address: '111 Growth St',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
        },
        comparableProperties: [
          {
            address: '100 Main St',
            monthlyRent: 3000,
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1500,
            distanceMiles: 0.5,
          },
        ],
        marketMetrics: {
          averageRent: 3000,
          medianRent: 3000,
          occupancyRate: 95,
          rentGrowthYoY: 10.0, // High growth
        },
        timestamp: Date.now(),
        isStale: false,
      };

      const propertyDetails: PropertyDetails = {
        address: '111 Growth St',
        propertyType: 'Single Family',
        valuation: 600000,
      };

      const highGrowthRec = await agent.analyzePricing({
        marketData: baseMarketData,
        propertyDetails,
      });

      // Compare with low growth scenario
      const lowGrowthRec = await agent.analyzePricing({
        marketData: {
          ...baseMarketData,
          marketMetrics: {
            ...baseMarketData.marketMetrics,
            rentGrowthYoY: -2.0, // Negative growth
          },
        },
        propertyDetails,
      });

      // High growth should recommend higher price
      expect(highGrowthRec.price).to.be.greaterThan(lowGrowthRec.price);
    });

    /**
     * Test with low occupancy rates
     */
    it('should recommend lower prices in low occupancy markets', async () => {
      const baseMarketData: MarketData = {
        location: {
          address: '222 Occupancy St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001',
        },
        comparableProperties: [
          {
            address: '100 Main St',
            monthlyRent: 2500,
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1500,
            distanceMiles: 0.5,
          },
        ],
        marketMetrics: {
          averageRent: 2500,
          medianRent: 2500,
          occupancyRate: 85, // Low occupancy
          rentGrowthYoY: 3.5,
        },
        timestamp: Date.now(),
        isStale: false,
      };

      const propertyDetails: PropertyDetails = {
        address: '222 Occupancy St',
        propertyType: 'Condo',
        valuation: 500000,
      };

      const lowOccupancyRec = await agent.analyzePricing({
        marketData: baseMarketData,
        propertyDetails,
      });

      // Compare with high occupancy scenario
      const highOccupancyRec = await agent.analyzePricing({
        marketData: {
          ...baseMarketData,
          marketMetrics: {
            ...baseMarketData.marketMetrics,
            occupancyRate: 98, // High occupancy
          },
        },
        propertyDetails,
      });

      // Low occupancy should recommend lower or equal price
      expect(lowOccupancyRec.price).to.be.lessThanOrEqual(highOccupancyRec.price);
    });

    /**
     * Test with current price constraint
     */
    it('should not deviate too much from current price', async () => {
      const marketData: MarketData = {
        location: {
          address: '333 Current Price St',
          city: 'San Diego',
          state: 'CA',
          zipCode: '92101',
        },
        comparableProperties: [
          {
            address: '100 Main St',
            monthlyRent: 5000, // Much higher than current
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1500,
            distanceMiles: 0.5,
          },
        ],
        marketMetrics: {
          averageRent: 5000,
          medianRent: 5000,
          occupancyRate: 95,
          rentGrowthYoY: 3.5,
        },
        timestamp: Date.now(),
        isStale: false,
      };

      const propertyDetails: PropertyDetails = {
        address: '333 Current Price St',
        propertyType: 'Single Family',
        valuation: 500000,
        currentPrice: 2000, // Much lower than market
      };

      const recommendation = await agent.analyzePricing({
        marketData,
        propertyDetails,
      });

      // Should not jump too high from current price
      const maxIncrease = propertyDetails.currentPrice * 1.2; // 20% max increase
      expect(recommendation.price).to.be.lessThanOrEqual(maxIncrease);
    });

    /**
     * Test confidence with few comparables
     */
    it('should have lower confidence with fewer comparable properties', async () => {
      const propertyDetails: PropertyDetails = {
        address: '444 Confidence St',
        propertyType: 'Townhouse',
        valuation: 450000,
      };

      // Many comparables
      const manyComparables = await agent.analyzePricing({
        marketData: {
          location: {
            address: '444 Confidence St',
            city: 'Sacramento',
            state: 'CA',
            zipCode: '95814',
          },
          comparableProperties: Array.from({ length: 10 }, (_, i) => ({
            address: `${100 + i * 100} Test St`,
            monthlyRent: 2500 + i * 50,
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1500,
            distanceMiles: i * 0.5,
          })),
          marketMetrics: {
            averageRent: 2750,
            medianRent: 2700,
            occupancyRate: 95,
            rentGrowthYoY: 3.5,
          },
          timestamp: Date.now(),
          isStale: false,
        },
        propertyDetails,
      });

      // Few comparables
      const fewComparables = await agent.analyzePricing({
        marketData: {
          location: {
            address: '444 Confidence St',
            city: 'Sacramento',
            state: 'CA',
            zipCode: '95814',
          },
          comparableProperties: [
            {
              address: '100 Test St',
              monthlyRent: 2700,
              bedrooms: 3,
              bathrooms: 2,
              squareFeet: 1500,
              distanceMiles: 0.5,
            },
          ],
          marketMetrics: {
            averageRent: 2700,
            medianRent: 2700,
            occupancyRate: 95,
            rentGrowthYoY: 3.5,
          },
          timestamp: Date.now(),
          isStale: false,
        },
        propertyDetails,
      });

      expect(manyComparables.confidence).to.be.greaterThan(fewComparables.confidence);
    });

    /**
     * Test confidence with stale data
     */
    it('should have lower confidence with stale data', async () => {
      const propertyDetails: PropertyDetails = {
        address: '555 Stale Data St',
        propertyType: 'Condo',
        valuation: 500000,
      };

      const baseMarketData: MarketData = {
        location: {
          address: '555 Stale Data St',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94103',
        },
        comparableProperties: [
          {
            address: '100 Main St',
            monthlyRent: 3000,
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1500,
            distanceMiles: 0.5,
          },
        ],
        marketMetrics: {
          averageRent: 3000,
          medianRent: 3000,
          occupancyRate: 95,
          rentGrowthYoY: 3.5,
        },
        timestamp: Date.now(),
        isStale: false,
      };

      const freshRec = await agent.analyzePricing({
        marketData: baseMarketData,
        propertyDetails,
      });

      const staleRec = await agent.analyzePricing({
        marketData: { ...baseMarketData, isStale: true },
        propertyDetails,
      });

      expect(freshRec.confidence).to.be.greaterThan(staleRec.confidence);
    });

    /**
     * Test reasoning content
     */
    it('should include comprehensive reasoning', async () => {
      const marketData: MarketData = {
        location: {
          address: '666 Reasoning St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001',
        },
        comparableProperties: [
          {
            address: '100 Main St',
            monthlyRent: 2800,
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1500,
            distanceMiles: 0.5,
          },
        ],
        marketMetrics: {
          averageRent: 2800,
          medianRent: 2800,
          occupancyRate: 95,
          rentGrowthYoY: 4.5,
        },
        timestamp: Date.now(),
        isStale: false,
      };

      const propertyDetails: PropertyDetails = {
        address: '666 Reasoning St',
        propertyType: 'Single Family',
        valuation: 550000,
        currentPrice: 2700,
      };

      const recommendation = await agent.analyzePricing({
        marketData,
        propertyDetails,
      });

      const reasoning = recommendation.reasoning.toLowerCase();

      // Should mention key factors
      expect(reasoning).to.satisfy((r: string) =>
        r.includes('market') || r.includes('comparable')
      );
      expect(reasoning).to.satisfy((r: string) =>
        r.includes('occupancy') || r.includes('vacancy')
      );
      expect(reasoning).to.satisfy((r: string) =>
        r.includes('growth') || r.includes('trend')
      );
    });

    /**
     * Test model getter/setter
     */
    it('should support model configuration', () => {
      expect(agent.getModel()).to.equal('gpt-4');

      agent.setModel('gpt-3.5-turbo');
      expect(agent.getModel()).to.equal('gpt-3.5-turbo');
    });
  });

  describe('AIPricingAgent (Real API)', () => {
    /**
     * Test API key configuration
     * Requirement: 13.2
     */
    it('should throw error when API key is explicitly empty', () => {
      // Empty string should throw
      expect(() => {
        new AIPricingAgent('', 'gpt-4');
      }).to.throw('OpenAI API key not configured');
    });

    /**
     * Test that constructor works with environment variable
     */
    it('should initialize from environment variable', () => {
      // If OPENAI_API_KEY is set in env, this should work
      if (process.env.OPENAI_API_KEY) {
        const agent = new AIPricingAgent();
        expect(agent).to.be.instanceOf(AIPricingAgent);
      }
    });

    /**
     * Test constructor with valid API key
     */
    it('should initialize with valid API key', () => {
      const agent = new AIPricingAgent('test-api-key');
      expect(agent).to.be.instanceOf(AIPricingAgent);
      expect(agent.getModel()).to.equal('gpt-3.5-turbo'); // default model
    });

    /**
     * Test custom model configuration
     */
    it('should support custom model configuration', () => {
      const agent = new AIPricingAgent('test-api-key', 'gpt-3.5-turbo');
      expect(agent.getModel()).to.equal('gpt-3.5-turbo');
    });

    /**
     * Test custom timeout configuration
     */
    it('should support custom timeout configuration', () => {
      const agent = new AIPricingAgent('test-api-key', 'gpt-4', 60000);
      expect(agent).to.be.instanceOf(AIPricingAgent);
    });
  });
});
