/**
 * AI Pricing Agent Service
 * Uses OpenAI API to analyze market data and generate optimal rental price recommendations
 * Requirements: 4.1, 4.2, 4.3, 4.6, 13.2
 */

import OpenAI from 'openai';
import {
  MarketData,
  PropertyDetails,
  PricingRecommendation,
  PricingAnalysisRequest,
} from './types';

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

/**
 * Rule-based pricing recommendation. Used as fallback when OpenAI API fails,
 * and by MockAIPricingAgent for testing. Set includeFallbackNote=true only
 * when invoked as fallback (so users know AI was unavailable).
 */
function computeRuleBasedRecommendation(
  request: PricingAnalysisRequest,
  includeFallbackNote = false
): PricingRecommendation {
  const { marketData, propertyDetails } = request;
  const { averageRent, medianRent, rentGrowthYoY: rentGrowth, occupancyRate } = marketData.marketMetrics;

  let recommendedPrice = medianRent;

  if (rentGrowth > 5) recommendedPrice *= 1.05;
  else if (rentGrowth < 0) recommendedPrice *= 0.95;

  if (occupancyRate < 90) recommendedPrice *= 0.97;

  if (propertyDetails.currentPrice) {
    const maxChange = propertyDetails.currentPrice * 0.1;
    const priceDiff = recommendedPrice - propertyDetails.currentPrice;
    if (Math.abs(priceDiff) > maxChange) {
      recommendedPrice = propertyDetails.currentPrice + Math.sign(priceDiff) * maxChange;
    }
  }

  let confidence = 85;
  if (marketData.comparableProperties.length < 3) confidence -= 15;
  if (marketData.isStale) confidence -= 10;

  const priceDiff = propertyDetails.currentPrice
    ? ((recommendedPrice - propertyDetails.currentPrice) / propertyDetails.currentPrice * 100).toFixed(1)
    : '0';
  const direction = parseFloat(priceDiff) > 0 ? 'increase' : parseFloat(priceDiff) < 0 ? 'decrease' : 'maintain';

  const reasoning = `Based on comprehensive market analysis, I recommend a monthly rental price of $${Math.round(recommendedPrice).toLocaleString()} for this ${propertyDetails.propertyType} property. ` +
    `Market Comparison: ${((recommendedPrice / medianRent - 1) * 100).toFixed(1)}% ${recommendedPrice > medianRent ? 'above' : 'below'} median ($${medianRent.toLocaleString()}). ` +
    `Market Trends: ${rentGrowth > 0 ? 'Positive' : 'Negative'} growth at ${rentGrowth.toFixed(1)}% YoY. ` +
    `Occupancy: ${occupancyRate}%. ` +
    (propertyDetails.currentPrice
      ? `This is a ${Math.abs(parseFloat(priceDiff))}% ${direction} from current $${propertyDetails.currentPrice.toLocaleString()}. `
      : '') +
    (includeFallbackNote ? ' [Rule-based fallback - OpenAI API was unavailable]' : '');

  return {
    price: Math.round(recommendedPrice),
    confidence: Math.round(Math.max(0, Math.min(100, confidence))),
    reasoning,
  };
}

export class AIPricingAgent {
  private client: OpenAI;
  private model: string;
  private timeout: number;

  constructor(
    apiKey?: string,
    model: string = 'gpt-3.5-turbo',
    timeout: number = DEFAULT_TIMEOUT_MS
  ) {
    const key = apiKey !== undefined ? apiKey : process.env.OPENAI_API_KEY || '';
    if (!key || key.trim() === '') {
      throw new Error('OpenAI API key not configured');
    }

    this.client = new OpenAI({
      apiKey: key,
      timeout,
    });
    this.model = model;
    this.timeout = timeout;
  }

  /**
   * Analyzes market data and generates optimal rental price recommendation.
   * Falls back to rule-based logic when OpenAI API fails (e.g. quota, timeout).
   * Requirements: 4.1, 4.2, 4.3, 4.6
   */
  async analyzePricing(request: PricingAnalysisRequest): Promise<PricingRecommendation> {
    const { marketData, propertyDetails, currentMonth } = request;

    try {
      const prompt = this.buildPrompt(marketData, propertyDetails, currentMonth);
      const response = await this.callOpenAIWithRetry(prompt);
      return this.parseAndValidateResponse(response, propertyDetails);
    } catch (error) {
      console.warn(`OpenAI API failed, using rule-based fallback: ${(error as Error).message}`);
      return computeRuleBasedRecommendation(request, true); // Include note that AI was unavailable
    }
  }

  /**
   * Builds the pricing analysis prompt for OpenAI
   * Requirement: 4.1
   */
  private buildPrompt(
    marketData: MarketData,
    propertyDetails: PropertyDetails,
    currentMonth?: number
  ): string {
    const month = currentMonth || new Date().getMonth() + 1;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonthName = monthNames[month - 1];

    return `You are an expert real estate pricing analyst. Analyze the provided market data and generate an optimal rental price recommendation.

MARKET DATA:
${JSON.stringify(marketData, null, 2)}

CURRENT PROPERTY:
- Address: ${propertyDetails.address}
- Current Rent: ${propertyDetails.currentPrice ? `$${propertyDetails.currentPrice}/month` : 'Not set'}
- Property Type: ${propertyDetails.propertyType}
- Valuation: $${propertyDetails.valuation.toLocaleString()}
${propertyDetails.bedrooms ? `- Bedrooms: ${propertyDetails.bedrooms}` : ''}
${propertyDetails.bathrooms ? `- Bathrooms: ${propertyDetails.bathrooms}` : ''}
${propertyDetails.squareFeet ? `- Square Feet: ${propertyDetails.squareFeet}` : ''}

ANALYSIS REQUIREMENTS:
1. Compare current price to market averages from comparable properties
2. Consider rent growth trends (${marketData.marketMetrics.rentGrowthYoY}% YoY)
3. Factor in occupancy rates (${marketData.marketMetrics.occupancyRate}% - higher occupancy may justify lower price)
4. Account for seasonal factors (current month: ${currentMonthName})
5. Provide confidence score based on data quality and market stability

PRICING STRATEGY:
- Prioritize stable occupancy over maximum rent
- Be conservative with recommendations
- Consider that vacant properties cost more than slightly lower rent
- Factor in property condition and amenities relative to comparables

OUTPUT FORMAT (JSON only, no additional text):
{
  "price": <recommended monthly rent in USD as a number>,
  "confidence": <score 0-100 as a number>,
  "reasoning": "<detailed explanation of recommendation including:
    - Market comparison analysis (how does this compare to average/median?)
    - Trend considerations (is the market growing or declining?)
    - Occupancy optimization rationale (balance between price and occupancy)
    - Seasonal factors (is this a good/bad time for rentals?)
    - Risk factors or uncertainties (data quality, market volatility, etc.)
    Minimum 100 characters.>"
}

IMPORTANT: Return ONLY valid JSON. Do not include any text before or after the JSON object.`;
  }

  /**
   * Calls OpenAI API with exponential backoff retry logic
   * Requirements: 4.6, 13.2
   */
  private async callOpenAIWithRetry(prompt: string): Promise<string> {
    let lastError: Error | null = null;
    let delay = INITIAL_RETRY_DELAY_MS;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert real estate pricing analyst. Always respond with valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.4, // Lower for more consistent pricing recommendations
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI API');
        }

        return content;
      } catch (error) {
        lastError = error as Error;
        console.warn(`OpenAI API call attempt ${attempt} failed:`, error);

        if (attempt < MAX_RETRIES) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
    }

    throw new Error(
      `OpenAI API call failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
    );
  }

  /**
   * Parses and validates the AI response
   * Requirements: 4.2, 4.3
   */
  private parseAndValidateResponse(
    response: string,
    propertyDetails: PropertyDetails
  ): PricingRecommendation {
    let parsed: any;

    try {
      parsed = JSON.parse(response);
    } catch (error) {
      throw new Error(`Failed to parse AI response as JSON: ${error}`);
    }

    // Validate required fields
    if (typeof parsed.price !== 'number') {
      throw new Error('AI response missing valid "price" field');
    }

    if (typeof parsed.confidence !== 'number') {
      throw new Error('AI response missing valid "confidence" field');
    }

    if (typeof parsed.reasoning !== 'string') {
      throw new Error('AI response missing valid "reasoning" field');
    }

    // Validate price bounds (within ±50% of current price if set, or reasonable range)
    const price = parsed.price;
    if (price <= 0) {
      throw new Error(`Invalid price: ${price} (must be positive)`);
    }

    if (propertyDetails.currentPrice) {
      const minPrice = propertyDetails.currentPrice * 0.5;
      const maxPrice = propertyDetails.currentPrice * 1.5;
      if (price < minPrice || price > maxPrice) {
        throw new Error(
          `Price ${price} outside reasonable bounds (${minPrice}-${maxPrice})`
        );
      }
    } else {
      // Without current price, validate against property valuation
      // Typical rent is 0.5-1.5% of property value per month
      const minPrice = propertyDetails.valuation * 0.003; // 0.3% monthly
      const maxPrice = propertyDetails.valuation * 0.02; // 2% monthly
      if (price < minPrice || price > maxPrice) {
        throw new Error(
          `Price ${price} outside reasonable bounds based on valuation (${minPrice}-${maxPrice})`
        );
      }
    }

    // Validate confidence score (0-100)
    const confidence = parsed.confidence;
    if (confidence < 0 || confidence > 100) {
      throw new Error(`Invalid confidence score: ${confidence} (must be 0-100)`);
    }

    // Validate reasoning length (minimum 100 characters, max 512 for on-chain storage)
    const rawReasoning = parsed.reasoning;
    if (rawReasoning.length < 100) {
      throw new Error(
        `Reasoning too short: ${rawReasoning.length} characters (minimum 100)`
      );
    }
    // Truncate to 512 bytes (contract MAX_REASONING_LENGTH) - safe for UTF-8
    const reasoning =
      rawReasoning.length > 512 ? rawReasoning.slice(0, 512) : rawReasoning;

    return {
      price: Math.round(price), // Round to nearest dollar
      confidence: Math.round(confidence), // Round to nearest integer
      reasoning,
    };
  }

  /**
   * Gets the current model being used
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Sets the model to use for analysis
   */
  setModel(model: string): void {
    this.model = model;
  }
}

/**
 * Mock AI Pricing Agent for testing and development
 * Uses rule-based logic without calling OpenAI API (same fallback as AIPricingAgent)
 */
export class MockAIPricingAgent extends AIPricingAgent {
  constructor() {
    super('mock-api-key', 'gpt-4', DEFAULT_TIMEOUT_MS);
  }

  /**
   * Override to return rule-based recommendation without calling OpenAI
   */
  async analyzePricing(request: PricingAnalysisRequest): Promise<PricingRecommendation> {
    return computeRuleBasedRecommendation(request, false); // Mock - no fallback note
  }
}
