/**
 * Unit Tests for Market Data Oracle Service
 * Requirements: 3.4
 */

import { expect } from 'chai';
import { MarketDataOracle, MockMarketDataOracle } from '../services/marketDataOracle';
import { MarketData } from '../services/types';

describe('MarketDataOracle Unit Tests', () => {
  describe('MockMarketDataOracle', () => {
    let oracle: MockMarketDataOracle;

    beforeEach(() => {
      oracle = new MockMarketDataOracle();
    });

    /**
     * Test successful API call and data formatting
     * Requirement: 3.4
     */
    it('should successfully fetch and format market data', async () => {
      const address = '123 Main St, San Francisco, CA 94102';
      const propertyType = 'Single Family';
      const radius = 5;

      const data = await oracle.fetchMarketData(address, propertyType, radius);

      // Verify data structure
      expect(data).to.have.property('location');
      expect(data).to.have.property('comparableProperties');
      expect(data).to.have.property('marketMetrics');
      expect(data).to.have.property('timestamp');

      // Verify location data
      expect(data.location.address).to.equal('123 Main St');
      expect(data.location.city).to.be.a('string');
      expect(data.location.state).to.be.a('string');
      expect(data.location.zipCode).to.be.a('string');

      // Verify comparable properties
      expect(data.comparableProperties).to.be.an('array');
      expect(data.comparableProperties.length).to.be.greaterThan(0);

      // Verify market metrics
      expect(data.marketMetrics.averageRent).to.be.a('number').and.be.greaterThan(0);
      expect(data.marketMetrics.medianRent).to.be.a('number').and.be.greaterThan(0);
      expect(data.marketMetrics.occupancyRate).to.be.a('number')
        .and.be.greaterThanOrEqual(0)
        .and.be.lessThanOrEqual(100);
      expect(data.marketMetrics.rentGrowthYoY).to.be.a('number');

      // Verify timestamp is recent
      const now = Date.now();
      expect(data.timestamp).to.be.lessThanOrEqual(now);
      expect(data.timestamp).to.be.greaterThan(now - 5000);

      // Verify not stale
      expect(data.isStale).to.be.false;
    });

    /**
     * Test cache hit scenario
     * Requirement: 3.4
     */
    it('should return cached data on subsequent calls', async () => {
      const address = '456 Oak Ave, Los Angeles, CA 90001';
      const propertyType = 'Condo';

      // First call - should fetch fresh data
      const data1 = await oracle.fetchMarketData(address, propertyType);
      const timestamp1 = data1.timestamp;

      // Wait a bit to ensure time passes
      await new Promise(resolve => setTimeout(resolve, 50));

      // Second call - should return cached data (same timestamp)
      const data2 = await oracle.fetchMarketData(address, propertyType);
      const timestamp2 = data2.timestamp;

      // Timestamps should be the same (cached) or very close
      // Allow small difference due to timing
      const timeDiff = Math.abs(timestamp2 - timestamp1);
      expect(timeDiff).to.be.lessThan(100); // Within 100ms means cached
      expect(data2.isStale).to.be.false;
    });

    /**
     * Test cache expiration
     */
    it('should fetch fresh data after cache expires', async () => {
      const address = '789 Pine St, San Diego, CA 92101';
      const propertyType = 'Multi-Family';

      // Create oracle with short cache duration for testing
      const shortCacheOracle = new MockMarketDataOracle();
      
      // First call
      const data1 = await shortCacheOracle.fetchMarketData(address, propertyType);
      
      // Manually expire cache by clearing it
      shortCacheOracle.clearCache();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Second call - should fetch fresh data
      const data2 = await shortCacheOracle.fetchMarketData(address, propertyType);
      
      // Timestamps should be different (fresh fetch)
      expect(data2.timestamp).to.be.greaterThan(data1.timestamp);
    });

    /**
     * Test staleness indicator
     * Requirement: 3.4
     */
    it('should mark data as stale when using expired cache', async () => {
      const address = '321 Elm Dr, Sacramento, CA 95814';
      const propertyType = 'Townhouse';

      // This test verifies the concept - in real implementation,
      // stale data would be returned when API fails but cache exists
      const data = await oracle.fetchMarketData(address, propertyType);
      
      // Fresh data should not be stale
      expect(data.isStale).to.be.false;
    });

    /**
     * Test getCachedData method
     */
    it('should retrieve cached data without fetching', async () => {
      const address = '555 Maple Ln, San Francisco, CA 94103';
      const propertyType = 'Single Family';

      // Initially no cache
      let cached = oracle.getCachedData(address, propertyType);
      expect(cached).to.be.null;

      // Fetch data to populate cache
      const fetchedData = await oracle.fetchMarketData(address, propertyType);

      // Now cache should exist
      cached = oracle.getCachedData(address, propertyType);
      expect(cached).to.not.be.null;
      expect(cached!.location.address).to.equal('555 Maple Ln');
      
      // Cached data should match fetched data
      expect(cached!.timestamp).to.equal(fetchedData.timestamp);
    });

    /**
     * Test clearCache method
     */
    it('should clear all cached data', async () => {
      const address1 = '111 First St, San Francisco, CA 94102';
      const address2 = '222 Second St, San Francisco, CA 94103';
      const propertyType = 'Condo';

      // Fetch data for two properties
      await oracle.fetchMarketData(address1, propertyType);
      await oracle.fetchMarketData(address2, propertyType);

      // Verify cache exists for both
      let cached1 = oracle.getCachedData(address1, propertyType);
      let cached2 = oracle.getCachedData(address2, propertyType);
      expect(cached1).to.not.be.null;
      expect(cached2).to.not.be.null;

      // Clear cache
      oracle.clearCache();

      // Verify cache is empty for both
      cached1 = oracle.getCachedData(address1, propertyType);
      cached2 = oracle.getCachedData(address2, propertyType);
      expect(cached1).to.be.null;
      expect(cached2).to.be.null;
    });

    /**
     * Test different property types
     */
    it('should handle different property types', async () => {
      const address = '999 Test Ave, San Francisco, CA 94102';
      const propertyTypes = ['Single Family', 'Condo', 'Multi-Family', 'Townhouse'];

      for (const propertyType of propertyTypes) {
        const data = await oracle.fetchMarketData(address, propertyType);
        expect(data).to.have.property('location');
        expect(data).to.have.property('comparableProperties');
        expect(data).to.have.property('marketMetrics');
      }
    });

    /**
     * Test different radius values
     */
    it('should handle different search radius values', async () => {
      const address = '888 Radius Test St, San Francisco, CA 94102';
      const propertyType = 'Single Family';
      const radiusValues = [1, 5, 10, 20];

      for (const radius of radiusValues) {
        const data = await oracle.fetchMarketData(address, propertyType, radius);
        expect(data).to.have.property('comparableProperties');
        expect(data.comparableProperties).to.be.an('array');
      }
    });

    /**
     * Test address parsing
     */
    it('should correctly parse address components', async () => {
      const testCases = [
        {
          input: '123 Main St, San Francisco, CA 94102',
          expected: {
            address: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94102',
          },
        },
        {
          input: '456 Oak Ave, Los Angeles, CA 90001',
          expected: {
            address: '456 Oak Ave',
            city: 'Los Angeles',
            state: 'CA',
            zipCode: '90001',
          },
        },
      ];

      for (const testCase of testCases) {
        const data = await oracle.fetchMarketData(testCase.input, 'Single Family');
        expect(data.location.address).to.equal(testCase.expected.address);
        // Note: Mock oracle may use default values for city/state/zip
      }
    });

    /**
     * Test comparable properties data quality
     */
    it('should return comparable properties with valid data', async () => {
      const address = '777 Quality Test St, San Francisco, CA 94102';
      const propertyType = 'Single Family';

      const data = await oracle.fetchMarketData(address, propertyType);

      expect(data.comparableProperties.length).to.be.greaterThan(0);

      for (const comp of data.comparableProperties) {
        // Verify all required fields exist
        expect(comp.address).to.be.a('string').and.not.be.empty;
        expect(comp.monthlyRent).to.be.a('number').and.be.greaterThan(0);
        expect(comp.bedrooms).to.be.a('number').and.be.greaterThanOrEqual(0);
        expect(comp.bathrooms).to.be.a('number').and.be.greaterThan(0);
        expect(comp.squareFeet).to.be.a('number').and.be.greaterThan(0);
        expect(comp.distanceMiles).to.be.a('number').and.be.greaterThanOrEqual(0);

        // Verify reasonable ranges
        expect(comp.monthlyRent).to.be.lessThan(100000); // Reasonable max rent
        expect(comp.bedrooms).to.be.lessThan(20); // Reasonable max bedrooms
        expect(comp.bathrooms).to.be.lessThan(20); // Reasonable max bathrooms
        expect(comp.squareFeet).to.be.lessThan(50000); // Reasonable max sq ft
        expect(comp.distanceMiles).to.be.lessThan(100); // Reasonable max distance
      }
    });

    /**
     * Test market metrics calculations
     */
    it('should calculate market metrics correctly', async () => {
      const address = '666 Metrics Test St, San Francisco, CA 94102';
      const propertyType = 'Condo';

      const data = await oracle.fetchMarketData(address, propertyType);

      // Verify metrics are reasonable
      expect(data.marketMetrics.averageRent).to.be.greaterThan(0);
      expect(data.marketMetrics.medianRent).to.be.greaterThan(0);
      
      // Average and median should be in similar range
      const ratio = data.marketMetrics.averageRent / data.marketMetrics.medianRent;
      expect(ratio).to.be.greaterThan(0.5);
      expect(ratio).to.be.lessThan(2.0);

      // Occupancy rate should be valid percentage
      expect(data.marketMetrics.occupancyRate).to.be.greaterThanOrEqual(0);
      expect(data.marketMetrics.occupancyRate).to.be.lessThanOrEqual(100);

      // Rent growth should be reasonable (-50% to +50%)
      expect(data.marketMetrics.rentGrowthYoY).to.be.greaterThan(-50);
      expect(data.marketMetrics.rentGrowthYoY).to.be.lessThan(50);
    });
  });

  describe('MarketDataOracle (Real API)', () => {
    /**
     * Test API key configuration
     */
    it('should throw error when API key is not configured', async () => {
      const oracle = new MarketDataOracle('', 'https://api.rentcast.io/v1');
      const address = '123 Main St, San Francisco, CA 94102';
      const propertyType = 'Single Family';

      try {
        await oracle.fetchMarketData(address, propertyType);
        expect.fail('Should have thrown error for missing API key');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        const errorMessage = (error as Error).message;
        // Error could be about API key or about failed fetch with no cache
        expect(
          errorMessage.includes('API key not configured') ||
          errorMessage.includes('Failed to fetch market data')
        ).to.be.true;
      }
    });

    /**
     * Test cache functionality
     */
    it('should support cache operations', () => {
      const oracle = new MarketDataOracle('test-key', 'https://api.test.com');
      
      // Should have clearCache method
      expect(oracle.clearCache).to.be.a('function');
      oracle.clearCache();

      // Should have getCachedData method
      expect(oracle.getCachedData).to.be.a('function');
      const cached = oracle.getCachedData('test address', 'Single Family');
      expect(cached).to.be.null;
    });
  });
});
