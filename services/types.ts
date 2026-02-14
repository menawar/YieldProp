/**
 * Type definitions for Market Data Oracle and AI Pricing Agent services
 */

export interface MarketData {
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
  comparableProperties: Array<{
    address: string;
    monthlyRent: number;
    bedrooms: number;
    bathrooms: number;
    squareFeet: number;
    distanceMiles: number;
  }>;
  marketMetrics: {
    averageRent: number;
    medianRent: number;
    occupancyRate: number;
    rentGrowthYoY: number;
  };
  timestamp: number;
  isStale?: boolean;
}

export interface CachedMarketData {
  data: MarketData;
  fetchedAt: number;
  expiresAt: number;
  isStale: boolean;
}

export interface RentCastResponse {
  data: {
    comparables: Array<{
      address: string;
      price: number;
      bedrooms: number;
      bathrooms: number;
      squareFeet: number;
      distance: number;
    }>;
    averageRent: number;
    medianRent: number;
    occupancyRate?: number;
    rentGrowth?: number;
  };
}

/**
 * AI Pricing Recommendation
 */
export interface PricingRecommendation {
  price: number;
  confidence: number;
  reasoning: string;
}

/**
 * Property Details for AI Analysis
 */
export interface PropertyDetails {
  address: string;
  propertyType: string;
  valuation: number;
  currentPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
}

/**
 * AI Pricing Analysis Request
 */
export interface PricingAnalysisRequest {
  marketData: MarketData;
  propertyDetails: PropertyDetails;
  currentMonth?: number;
}

/**
 * OpenAI API Response
 */
export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
