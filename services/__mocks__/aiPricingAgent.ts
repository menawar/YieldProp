import { AIPricingAgent, computeRuleBasedRecommendation } from '../aiPricingAgent';
import { PricingAnalysisRequest, PricingRecommendation } from '../types';

/**
 * Mock AI Pricing Agent for testing and development
 * Uses rule-based logic without calling OpenAI API
 */
export class MockAIPricingAgent extends AIPricingAgent {
    constructor() {
        super('mock-api-key', 'gpt-4', 30000);
    }

    /**
     * Override to return rule-based recommendation without calling OpenAI
     */
    async analyzePricing(request: PricingAnalysisRequest): Promise<PricingRecommendation> {
        return computeRuleBasedRecommendation(request, false);
    }
}
