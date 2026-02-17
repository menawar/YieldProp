/**
 * Property-Based Tests for AI Pricing Agent
 * Property 5: AI Recommendation Output Validation
 * Validates: Requirements 4.2, 4.3
 * 
 * @custom:property Feature: yieldprop-mvp, Property 5: AI Recommendation Output Validation
 */

import { expect } from 'chai';
import fc from 'fast-check';
import { MockAIPricingAgent } from '../services/__mocks__/aiPricingAgent';
import { MarketData, PropertyDetails, PricingAnalysisRequest } from '../services/types';

describe('Property 5: AI Recommendation Output Validation', () => {
  let agent: MockAIPricingAgent;

  beforeEach(() => {
    agent = new MockAIPricingAgent();
  });

  /**
   * Property: For any AI pricing analysis, the output must contain valid price, 
   * confidence score (0-100), and reasoning (minimum 100 characters)
   */
  it('should always return valid recommendation structure with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random market data
        fc.record({
          averageRent: fc.integer({ min: 1000, max: 10000 }),
          medianRent: fc.integer({ min: 1000, max: 10000 }),
          occupancyRate: fc.integer({ min: 70, max: 100 }),
          rentGrowthYoY: fc.float({ min: -10, max: 20 }),
        }),
        // Generate random property details
        fc.record({
          address: fc.string({ minLength: 10, maxLength: 100 }),
          propertyType: fc.constantFrom('Single Family', 'Condo', 'Multi-Family', 'Townhouse'),
          valuation: fc.integer({ min: 200000, max: 2000000 }),
          currentPrice: fc.option(fc.integer({ min: 1000, max: 10000 }), { nil: undefined }),
          bedrooms: fc.option(fc.integer({ min: 1, max: 6 }), { nil: undefined }),
          bathrooms: fc.option(fc.integer({ min: 1, max: 4 }), { nil: undefined }),
          squareFeet: fc.option(fc.integer({ min: 500, max: 5000 }), { nil: undefined }),
        }),
        fc.integer({ min: 1, max: 3 }), // Number of comparable properties
        async (marketMetrics, propertyDetails, numComparables) => {
          // Build market data
          const comparableProperties = Array.from({ length: numComparables }, (_, i) => ({
            address: `${100 + i * 100} Test St`,
            monthlyRent: marketMetrics.medianRent + (i - 1) * 200,
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1500,
            distanceMiles: i * 0.5,
          }));

          const marketData: MarketData = {
            location: {
              address: propertyDetails.address,
              city: 'Test City',
              state: 'CA',
              zipCode: '94102',
            },
            comparableProperties,
            marketMetrics: {
              averageRent: marketMetrics.averageRent,
              medianRent: marketMetrics.medianRent,
              occupancyRate: marketMetrics.occupancyRate,
              rentGrowthYoY: marketMetrics.rentGrowthYoY,
            },
            timestamp: Date.now(),
            isStale: false,
          };

          const request: PricingAnalysisRequest = {
            marketData,
            propertyDetails: propertyDetails as PropertyDetails,
          };

          // Analyze pricing
          const recommendation = await agent.analyzePricing(request);

          // Validate structure
          expect(recommendation).to.have.property('price');
          expect(recommendation).to.have.property('confidence');
          expect(recommendation).to.have.property('reasoning');

          // Validate price is a positive number
          expect(recommendation.price).to.be.a('number');
          expect(recommendation.price).to.be.greaterThan(0);
          expect(Number.isInteger(recommendation.price)).to.be.true;

          // Validate confidence is 0-100
          expect(recommendation.confidence).to.be.a('number');
          expect(recommendation.confidence).to.be.greaterThanOrEqual(0);
          expect(recommendation.confidence).to.be.lessThanOrEqual(100);
          expect(Number.isInteger(recommendation.confidence)).to.be.true;

          // Validate reasoning is a string with minimum 100 characters
          expect(recommendation.reasoning).to.be.a('string');
          expect(recommendation.reasoning.length).to.be.greaterThanOrEqual(100);
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified
    );
  });

  /**
   * Property: Recommended price should be within reasonable bounds relative to market data
   */
  it('should recommend prices within reasonable bounds of market data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1500, max: 5000 }),
        fc.integer({ min: 1500, max: 5000 }),
        fc.constantFrom('Single Family', 'Condo', 'Multi-Family'),
        fc.integer({ min: 300000, max: 1000000 }),
        async (averageRent, medianRent, propertyType, valuation) => {
          const marketData: MarketData = {
            location: {
              address: '123 Test St',
              city: 'San Francisco',
              state: 'CA',
              zipCode: '94102',
            },
            comparableProperties: [
              {
                address: '100 Main St',
                monthlyRent: averageRent,
                bedrooms: 3,
                bathrooms: 2,
                squareFeet: 1500,
                distanceMiles: 0.5,
              },
            ],
            marketMetrics: {
              averageRent,
              medianRent,
              occupancyRate: 95,
              rentGrowthYoY: 3.5,
            },
            timestamp: Date.now(),
            isStale: false,
          };

          const propertyDetails: PropertyDetails = {
            address: '123 Test St',
            propertyType,
            valuation,
          };

          const recommendation = await agent.analyzePricing({
            marketData,
            propertyDetails,
          });

          // Price should be within reasonable range of market averages
          const minRent = Math.min(averageRent, medianRent);
          const maxRent = Math.max(averageRent, medianRent);
          const lowerBound = minRent * 0.5; // 50% below minimum
          const upperBound = maxRent * 1.5; // 50% above maximum

          expect(recommendation.price).to.be.greaterThan(lowerBound);
          expect(recommendation.price).to.be.lessThan(upperBound);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When current price exists, recommendation should not deviate excessively
   */
  it('should not recommend excessive price changes from current price', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2000, max: 5000 }),
        fc.integer({ min: 2000, max: 5000 }),
        async (currentPrice, medianRent) => {
          const marketData: MarketData = {
            location: {
              address: '456 Test Ave',
              city: 'Los Angeles',
              state: 'CA',
              zipCode: '90001',
            },
            comparableProperties: [
              {
                address: '100 Main St',
                monthlyRent: medianRent,
                bedrooms: 3,
                bathrooms: 2,
                squareFeet: 1500,
                distanceMiles: 0.5,
              },
            ],
            marketMetrics: {
              averageRent: medianRent,
              medianRent,
              occupancyRate: 95,
              rentGrowthYoY: 3.5,
            },
            timestamp: Date.now(),
            isStale: false,
          };

          const propertyDetails: PropertyDetails = {
            address: '456 Test Ave',
            propertyType: 'Condo',
            valuation: 500000,
            currentPrice,
          };

          const recommendation = await agent.analyzePricing({
            marketData,
            propertyDetails,
          });

          // Recommendation should be within ±50% of current price
          const minPrice = currentPrice * 0.5;
          const maxPrice = currentPrice * 1.5;

          expect(recommendation.price).to.be.greaterThanOrEqual(minPrice);
          expect(recommendation.price).to.be.lessThanOrEqual(maxPrice);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Confidence should be lower with fewer comparable properties
   */
  it('should have lower confidence with fewer comparable properties', async () => {
    const propertyDetails: PropertyDetails = {
      address: '789 Test Blvd',
      propertyType: 'Single Family',
      valuation: 600000,
    };

    // Test with many comparables
    const marketDataMany: MarketData = {
      location: {
        address: '789 Test Blvd',
        city: 'San Diego',
        state: 'CA',
        zipCode: '92101',
      },
      comparableProperties: Array.from({ length: 10 }, (_, i) => ({
        address: `${100 + i * 100} Test St`,
        monthlyRent: 3000 + i * 100,
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1500,
        distanceMiles: i * 0.5,
      })),
      marketMetrics: {
        averageRent: 3500,
        medianRent: 3400,
        occupancyRate: 95,
        rentGrowthYoY: 3.5,
      },
      timestamp: Date.now(),
      isStale: false,
    };

    // Test with few comparables
    const marketDataFew: MarketData = {
      ...marketDataMany,
      comparableProperties: marketDataMany.comparableProperties.slice(0, 2),
    };

    const recommendationMany = await agent.analyzePricing({
      marketData: marketDataMany,
      propertyDetails,
    });

    const recommendationFew = await agent.analyzePricing({
      marketData: marketDataFew,
      propertyDetails,
    });

    // Confidence should be higher with more comparables
    expect(recommendationMany.confidence).to.be.greaterThan(recommendationFew.confidence);
  });

  /**
   * Property: Confidence should be lower with stale data
   */
  it('should have lower confidence with stale market data', async () => {
    const propertyDetails: PropertyDetails = {
      address: '321 Test Dr',
      propertyType: 'Townhouse',
      valuation: 450000,
    };

    const baseMarketData: MarketData = {
      location: {
        address: '321 Test Dr',
        city: 'Sacramento',
        state: 'CA',
        zipCode: '95814',
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

    const freshRecommendation = await agent.analyzePricing({
      marketData: baseMarketData,
      propertyDetails,
    });

    const staleRecommendation = await agent.analyzePricing({
      marketData: { ...baseMarketData, isStale: true },
      propertyDetails,
    });

    // Confidence should be higher with fresh data
    expect(freshRecommendation.confidence).to.be.greaterThan(staleRecommendation.confidence);
  });

  /**
   * Property: Reasoning should mention key factors
   */
  it('should include key analysis factors in reasoning', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2000, max: 5000 }),
        fc.integer({ min: 80, max: 100 }),
        fc.float({ min: -5, max: 10 }),
        async (medianRent, occupancyRate, rentGrowth) => {
          const marketData: MarketData = {
            location: {
              address: '555 Analysis Test St',
              city: 'San Francisco',
              state: 'CA',
              zipCode: '94103',
            },
            comparableProperties: [
              {
                address: '100 Main St',
                monthlyRent: medianRent,
                bedrooms: 3,
                bathrooms: 2,
                squareFeet: 1500,
                distanceMiles: 0.5,
              },
            ],
            marketMetrics: {
              averageRent: medianRent,
              medianRent,
              occupancyRate,
              rentGrowthYoY: rentGrowth,
            },
            timestamp: Date.now(),
            isStale: false,
          };

          const propertyDetails: PropertyDetails = {
            address: '555 Analysis Test St',
            propertyType: 'Condo',
            valuation: 500000,
          };

          const recommendation = await agent.analyzePricing({
            marketData,
            propertyDetails,
          });

          const reasoning = recommendation.reasoning.toLowerCase();

          // Should mention market comparison
          expect(
            reasoning.includes('market') ||
            reasoning.includes('average') ||
            reasoning.includes('median') ||
            reasoning.includes('comparable')
          ).to.be.true;

          // Should mention occupancy
          expect(
            reasoning.includes('occupancy') ||
            reasoning.includes('vacancy')
          ).to.be.true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
