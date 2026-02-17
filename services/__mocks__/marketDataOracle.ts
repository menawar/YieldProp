import { MarketDataOracle } from '../marketDataOracle';
import { MarketData } from '../types';

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
