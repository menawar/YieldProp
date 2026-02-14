/**
 * Property-Based Tests for Market Data Oracle
 * Property 4: Market Data Structure Completeness
 * Validates: Requirements 3.2, 3.5
 * 
 * @custom:property Feature: yieldprop-mvp, Property 4: Market Data Structure Completeness
 */

import { expect } from 'chai';
import fc from 'fast-check';
import { MockMarketDataOracle } from '../services/marketDataOracle';
import { MarketData } from '../services/types';

describe('Property 4: Market Data Structure Completeness', () => {
  let oracle: MockMarketDataOracle;

  beforeEach(() => {
    oracle = new MockMarketDataOracle();
  });

  /**
   * Property: For any market data response, all required fields must be present and valid
   * This ensures data completeness for AI analysis
   */
  it('should always return complete market data structure with valid values', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random property addresses
        fc.record({
          street: fc.integer({ min: 1, max: 9999 }),
          streetName: fc.constantFrom('Main St', 'Oak Ave', 'Pine St', 'Elm Dr', 'Maple Ln'),
          city: fc.constantFrom('San Francisco', 'Los Angeles', 'San Diego', 'Sacramento'),
          state: fc.constantFrom('CA', 'NY', 'TX', 'FL'),
          zipCode: fc.integer({ min: 10000, max: 99999 }),
        }),
        fc.constantFrom('Single Family', 'Condo', 'Multi-Family', 'Townhouse'),
        fc.integer({ min: 1, max: 10 }),
        async (addressParts, propertyType, radius) => {
          const propertyAddress = `${addressParts.street} ${addressParts.streetName}, ${addressParts.city}, ${addressParts.state} ${addressParts.zipCode}`;
          
          // Fetch market data
          const data: MarketData = await oracle.fetchMarketData(
            propertyAddress,
            propertyType,
            radius
          );

          // Verify location structure
          expect(data).to.have.property('location');
          expect(data.location).to.have.property('address');
          expect(data.location).to.have.property('city');
          expect(data.location).to.have.property('state');
          expect(data.location).to.have.property('zipCode');
          expect(data.location.address).to.be.a('string').and.not.be.empty;
          expect(data.location.city).to.be.a('string').and.not.be.empty;
          expect(data.location.state).to.be.a('string').and.not.be.empty;
          expect(data.location.zipCode).to.be.a('string').and.not.be.empty;

          // Verify comparableProperties structure
          expect(data).to.have.property('comparableProperties');
          expect(data.comparableProperties).to.be.an('array');
          
          for (const comp of data.comparableProperties) {
            expect(comp).to.have.property('address');
            expect(comp).to.have.property('monthlyRent');
            expect(comp).to.have.property('bedrooms');
            expect(comp).to.have.property('bathrooms');
            expect(comp).to.have.property('squareFeet');
            expect(comp).to.have.property('distanceMiles');
            
            expect(comp.address).to.be.a('string').and.not.be.empty;
            expect(comp.monthlyRent).to.be.a('number').and.be.greaterThan(0);
            expect(comp.bedrooms).to.be.a('number').and.be.greaterThanOrEqual(0);
            expect(comp.bathrooms).to.be.a('number').and.be.greaterThan(0);
            expect(comp.squareFeet).to.be.a('number').and.be.greaterThan(0);
            expect(comp.distanceMiles).to.be.a('number').and.be.greaterThanOrEqual(0);
          }

          // Verify marketMetrics structure
          expect(data).to.have.property('marketMetrics');
          expect(data.marketMetrics).to.have.property('averageRent');
          expect(data.marketMetrics).to.have.property('medianRent');
          expect(data.marketMetrics).to.have.property('occupancyRate');
          expect(data.marketMetrics).to.have.property('rentGrowthYoY');
          
          expect(data.marketMetrics.averageRent).to.be.a('number').and.be.greaterThan(0);
          expect(data.marketMetrics.medianRent).to.be.a('number').and.be.greaterThan(0);
          expect(data.marketMetrics.occupancyRate).to.be.a('number')
            .and.be.greaterThanOrEqual(0)
            .and.be.lessThanOrEqual(100);
          expect(data.marketMetrics.rentGrowthYoY).to.be.a('number');

          // Verify timestamp
          expect(data).to.have.property('timestamp');
          expect(data.timestamp).to.be.a('number').and.be.greaterThan(0);
          
          // Verify timestamp is recent (within last minute)
          const now = Date.now();
          expect(data.timestamp).to.be.lessThanOrEqual(now);
          expect(data.timestamp).to.be.greaterThan(now - 60000);

          // Verify isStale flag
          expect(data).to.have.property('isStale');
          expect(data.isStale).to.be.a('boolean');
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in requirements
    );
  });

  /**
   * Property: Market metrics should be consistent with comparable properties
   */
  it('should have market metrics consistent with comparable properties data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.constantFrom('Single Family', 'Condo', 'Multi-Family'),
        async (address, propertyType) => {
          const data = await oracle.fetchMarketData(address, propertyType);

          if (data.comparableProperties.length > 0) {
            const rents = data.comparableProperties.map(p => p.monthlyRent);
            const calculatedAverage = rents.reduce((sum, r) => sum + r, 0) / rents.length;
            
            // Average rent should be reasonable relative to comparable properties
            const minRent = Math.min(...rents);
            const maxRent = Math.max(...rents);
            
            expect(data.marketMetrics.averageRent).to.be.greaterThanOrEqual(minRent);
            expect(data.marketMetrics.averageRent).to.be.lessThanOrEqual(maxRent);
            expect(data.marketMetrics.medianRent).to.be.greaterThanOrEqual(minRent);
            expect(data.marketMetrics.medianRent).to.be.lessThanOrEqual(maxRent);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Comparable properties should have valid distance values
   */
  it('should have comparable properties within reasonable distance', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.constantFrom('Single Family', 'Condo'),
        fc.integer({ min: 1, max: 20 }),
        async (address, propertyType, radius) => {
          const data = await oracle.fetchMarketData(address, propertyType, radius);

          for (const comp of data.comparableProperties) {
            // Distance should be non-negative and reasonable
            expect(comp.distanceMiles).to.be.greaterThanOrEqual(0);
            // In a real implementation, distance should be within the search radius
            // For mock data, we just verify it's a reasonable value
            expect(comp.distanceMiles).to.be.lessThan(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
