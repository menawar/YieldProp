/**
 * Market Data Oracle Service
 * Fetches rental market data from RentCast API with caching and fallback mechanisms
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { MarketData, CachedMarketData, RentCastResponse } from './types';

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const API_TIMEOUT_MS = 10000; // 10 seconds

export class MarketDataOracle {
  private cache: Map<string, CachedMarketData> = new Map();
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey?: string, apiUrl?: string) {
    this.apiKey = apiKey || process.env.RENTCAST_API_KEY || '';
    this.apiUrl = apiUrl || process.env.RENTCAST_API_URL || 'https://app.rentcast.io/app';
  }

  /**
   * Fetches market data for a property with caching and error handling
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   */
  async fetchMarketData(
    propertyAddress: string,
    propertyType: string,
    radius: number = 5
  ): Promise<MarketData> {
    const cacheKey = this.getCacheKey(propertyAddress, propertyType, radius);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      return cached.data;
    }

    try {
      // Attempt to fetch fresh data from API
      const data = await this.fetchFromAPI(propertyAddress, propertyType, radius);
      
      // Cache the fresh data
      this.cacheData(cacheKey, data);
      
      return data;
    } catch (error) {
      // Fallback to cached data if available (even if stale)
      if (cached) {
        console.warn('API fetch failed, using stale cached data:', error);
        const staleData = { ...cached.data, isStale: true };
        return staleData;
      }
      
      // If no cache available, throw error
      throw new Error(`Failed to fetch market data and no cache available: ${error}`);
    }
  }

  /**
   * Fetches data from RentCast API
   * Requirement: 3.1
   */
  protected async fetchFromAPI(
    propertyAddress: string,
    propertyType: string,
    radius: number
  ): Promise<MarketData> {
    if (!this.apiKey) {
      throw new Error('RentCast API key not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const url = new URL(`${this.apiUrl}/properties/comparable`);
      url.searchParams.append('address', propertyAddress);
      url.searchParams.append('radius', radius.toString());
      url.searchParams.append('propertyType', propertyType);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const apiResponse: RentCastResponse = await response.json();
      
      // Format data into standardized structure
      return this.formatMarketData(apiResponse, propertyAddress);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('API request timed out');
      }
      throw error;
    }
  }

  /**
   * Formats API response into standardized MarketData structure
   * Requirements: 3.2, 3.5
   */
  private formatMarketData(
    apiResponse: RentCastResponse,
    propertyAddress: string
  ): MarketData {
    const { data } = apiResponse;

    // Parse address components
    const addressParts = this.parseAddress(propertyAddress);

    // Format comparable properties
    const comparableProperties = (data.comparables || []).map(comp => ({
      address: comp.address,
      monthlyRent: comp.price,
      bedrooms: comp.bedrooms,
      bathrooms: comp.bathrooms,
      squareFeet: comp.squareFeet,
      distanceMiles: comp.distance,
    }));

    // Calculate market metrics
    const marketMetrics = {
      averageRent: data.averageRent || this.calculateAverage(comparableProperties.map(p => p.monthlyRent)),
      medianRent: data.medianRent || this.calculateMedian(comparableProperties.map(p => p.monthlyRent)),
      occupancyRate: data.occupancyRate || 95, // Default to 95% if not provided
      rentGrowthYoY: data.rentGrowth || 0,
    };

    return {
      location: addressParts,
      comparableProperties,
      marketMetrics,
      timestamp: Date.now(),
      isStale: false,
    };
  }

  /**
   * Parses address string into components
   */
  private parseAddress(address: string): {
    address: string;
    city: string;
    state: string;
    zipCode: string;
  } {
    // Simple parsing - in production, use a proper address parsing library
    const parts = address.split(',').map(p => p.trim());
    
    return {
      address: parts[0] || address,
      city: parts[1] || 'Unknown',
      state: parts[2]?.split(' ')[0] || 'Unknown',
      zipCode: parts[2]?.split(' ')[1] || '00000',
    };
  }

  /**
   * Calculates average of numbers
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Calculates median of numbers
   */
  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Caches market data with expiration
   * Requirement: 3.3
   */
  private cacheData(key: string, data: MarketData): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      fetchedAt: now,
      expiresAt: now + CACHE_DURATION_MS,
      isStale: false,
    });
  }

  /**
   * Checks if cached data is expired
   * Requirement: 3.4
   */
  private isCacheExpired(cached: CachedMarketData): boolean {
    return Date.now() > cached.expiresAt;
  }

  /**
   * Generates cache key from parameters
   */
  private getCacheKey(address: string, type: string, radius: number): string {
    return `${address}:${type}:${radius}`;
  }

  /**
   * Clears all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets cached data for a property (if exists)
   */
  getCachedData(
    propertyAddress: string,
    propertyType: string,
    radius: number = 5
  ): MarketData | null {
    const cacheKey = this.getCacheKey(propertyAddress, propertyType, radius);
    const cached = this.cache.get(cacheKey);
    return cached ? cached.data : null;
  }
}

/**
 * Mock Market Data Oracle for testing and development
 * Provides simulated data without external API calls
 */
export class MockMarketDataOracle extends MarketDataOracle {
  /**
   * Override to return mock data instead of calling real API
   */
  protected async fetchFromAPI(
    propertyAddress: string,
    propertyType: string,
    radius: number
  ): Promise<MarketData> {
    // Parse address
    const addressParts = this.parseAddressParts(propertyAddress);
    
    // Return mock data
    return {
      location: addressParts,
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
        {
          address: '300 Pine St',
          monthlyRent: 2400,
          bedrooms: 3,
          bathrooms: 2,
          squareFeet: 1450,
          distanceMiles: 1.8,
        },
      ],
      marketMetrics: {
        averageRent: 2533,
        medianRent: 2500,
        occupancyRate: 95,
        rentGrowthYoY: 3.5,
      },
      timestamp: Date.now(),
      isStale: false,
    };
  }

  private parseAddressParts(address: string): {
    address: string;
    city: string;
    state: string;
    zipCode: string;
  } {
    const parts = address.split(',').map(p => p.trim());
    
    return {
      address: parts[0] || address,
      city: parts[1] || 'San Francisco',
      state: parts[2]?.split(' ')[0] || 'CA',
      zipCode: parts[2]?.split(' ')[1] || '94102',
    };
  }
}
