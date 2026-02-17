/**
 * YieldProp CRE Workflow
 *
 * AI-powered workflow that orchestrates:
 * 1. Fetch rental market data (Market Data API / Redfin adapter) - Part 2: Offchain Data
 * 2. AI pricing analysis (OpenAI GPT-4o-mini)
 * 3. Submit recommendation to PriceManager contract (Part 4)
 * 4. Check reserve health – query YieldDistributor pool, log risk when low (Phase 4)
 * 5. Optional: Confidential HTTP – API keys injected via enclave, never exposed (Phase 5)
 *
 * Use useMockRecommendation: true in config for simulation without API keys.
 * Set useConfidentialHttp: true for OpenAI to keep API keys private (Privacy track).
 * Set yieldDistributorAddress + priceManagerAddress (e.g. in config.tenderly.json) for reserve health check.
 * See: https://docs.chain.link/cre/getting-started/part-2-fetching-data-ts
 */

import {
  CronCapability,
  ConsensusAggregationByFields,
  consensusIdenticalAggregation,
  handler,
  HTTPClient,
  ConfidentialHTTPClient,
  median,
  identical,
  ok,
  json,
  Runner,
  EVMClient,
  getNetwork,
  LAST_FINALIZED_BLOCK_NUMBER,
  encodeCallMsg,
  bytesToHex,
  hexToBase64,
  type Runtime,
  type HTTPSendRequester,
  type ConfidentialHTTPSendRequester,
} from "@chainlink/cre-sdk";
import { encodeFunctionData, decodeFunctionResult, encodeAbiParameters, parseAbiParameters, zeroAddress } from "viem";
import { YieldDistributorAbi, PriceManagerAbi } from "./abi.js";

type Config = {
  schedule: string;
  useMockRecommendation: boolean;
  propertyAddress: string;
  propertyType: string;
  propertyValuation: number;
  marketDataRadiusMiles: string;
  marketDataApiUrl: string;
  openaiModel: string;
  /** Phase 5: Use Confidential HTTP – secrets injected in enclave, API keys never exposed */
  useConfidentialHttp?: boolean;
  /** Optional: for reserve health check (Phase 4). Set both to enable. */
  yieldDistributorAddress?: string;
  priceManagerAddress?: string;
  chainName?: string;
  /** Phase 4b: CRE on-chain write – RecommendationConsumer address for writeReport() */
  recommendationConsumerAddress?: string;
  /** Gas limit for writeReport transaction */
  gasLimit?: string;
};

type MarketMetrics = {
  averageRent: number;
  medianRent: number;
  occupancyRate: number;
  rentGrowthYoY: number;
};

type MarketData = {
  marketMetrics: MarketMetrics;
  comparableCount: number;
};

type OpenAIRecommendation = {
  price: number;
  confidence: number;
  reasoning: string;
};

type PriceRecommendation = {
  recommendedPrice: number;
  confidenceScore: number;
  reasoning: string;
  source: "mock" | "openai";
};

type MarketDataResponse = {
  data?: {
    comparables?: Array<{ price: number }>;
    averageRent?: number;
    medianRent?: number;
    occupancyRate?: number;
    rentGrowth?: number;
  };
};

type ReserveHealthResult = {
  poolBalance: string;
  expectedRent: string;
  poolBalanceUsd: number;
  expectedRentUsd: number;
  isHealthy: boolean;
  riskEvent?: string;
};

/** Phase 4: Check reserve health – query YieldDistributor pool vs PriceManager expected rent */
function checkReserveHealth(runtime: Runtime<Config>, config: Config): ReserveHealthResult | null {
  const ydAddr = config.yieldDistributorAddress;
  const pmAddr = config.priceManagerAddress;
  if (!ydAddr || !pmAddr) return null;

  const chainName = config.chainName ?? "ethereum-testnet-sepolia";
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: chainName,
    isTestnet: true,
  });
  if (!network) {
    runtime.log(`Reserve health: unknown chain ${chainName}, skipping`);
    return null;
  }

  const evmClient = new EVMClient(network.chainSelector.selector);

  let poolBalance: bigint;
  let expectedRent: bigint;

  try {
    // Read distributionPool from YieldDistributor
    const poolCallData = encodeFunctionData({
      abi: YieldDistributorAbi,
      functionName: "distributionPool",
    });
    const poolCall = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: ydAddr as `0x${string}`,
          data: poolCallData,
        }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result();
    const poolHex = bytesToHex(poolCall.data);
    if (!poolHex || poolHex === "0x" || poolHex.length < 4) {
      runtime.log("Reserve health: YieldDistributor not deployed at this address, skipping");
      return null;
    }
    poolBalance = decodeFunctionResult({
      abi: YieldDistributorAbi,
      functionName: "distributionPool",
      data: poolHex,
    }) as bigint;
  } catch (err) {
    runtime.log(`Reserve health: failed to read YieldDistributor (${(err as Error).message}), skipping`);
    return null;
  }

  try {
    // Read getCurrentRentalPrice from PriceManager
    const rentCallData = encodeFunctionData({
      abi: PriceManagerAbi,
      functionName: "getCurrentRentalPrice",
    });
    const rentCall = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: pmAddr as `0x${string}`,
          data: rentCallData,
        }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result();
    const rentHex = bytesToHex(rentCall.data);
    if (!rentHex || rentHex === "0x" || rentHex.length < 4) {
      runtime.log("Reserve health: PriceManager not deployed at this address, skipping");
      return null;
    }
    expectedRent = decodeFunctionResult({
      abi: PriceManagerAbi,
      functionName: "getCurrentRentalPrice",
      data: rentHex,
    }) as bigint;
  } catch (err) {
    runtime.log(`Reserve health: failed to read PriceManager (${(err as Error).message}), skipping`);
    return null;
  }

  const poolUsd = Number(poolBalance) / 1e6;
  const rentUsd = Number(expectedRent) / 1e6;
  const isHealthy = poolBalance >= expectedRent;
  let riskEvent: string | undefined;

  if (!isHealthy) {
    riskEvent = `RESERVE_RISK: Pool balance ($${poolUsd.toFixed(2)}) below expected monthly rent ($${rentUsd.toFixed(2)})`;
    runtime.log(`⚠️ ${riskEvent}`);
  } else {
    runtime.log(`Reserve health: OK – pool $${poolUsd.toFixed(2)}, expected rent $${rentUsd.toFixed(2)}`);
  }

  return {
    poolBalance: poolBalance.toString(),
    expectedRent: expectedRent.toString(),
    poolBalanceUsd: poolUsd,
    expectedRentUsd: rentUsd,
    isHealthy,
    riskEvent,
  };
}

/** Phase 5: Market data via Confidential HTTP */
function fetchMarketDataConfidential(
  sendRequester: ConfidentialHTTPSendRequester,
  apiUrl: string,
  config: Config
): MarketData {
  const q = `address=${encodeURIComponent(config.propertyAddress)}&radius=${encodeURIComponent(config.marketDataRadiusMiles)}&propertyType=${encodeURIComponent(config.propertyType)}`;
  const urlStr = `${apiUrl.replace(/\/$/, "")}?${q}`;

  const response = sendRequester
    .sendRequest({
      vaultDonSecrets: [],
      request: {
        url: urlStr,
        method: "GET",
        multiHeaders: {
          "Content-Type": { values: ["application/json"] },
        },
        templatePublicValues: {},
      },
      encryptOutput: false,
    })
    .result();

  if (!ok(response)) {
    throw new Error(`Market Data API failed: status ${response.statusCode}`);
  }

  const body = json(response) as MarketDataResponse;
  const data = body?.data;
  const comparables = data?.comparables ?? [];
  const prices = comparables.map((c) => c.price);

  const averageRent =
    data?.averageRent ??
    (prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0);
  const medianRent =
    data?.medianRent ??
    (prices.length > 0
      ? (() => {
        const sorted = [...prices].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      })()
      : 0);

  return {
    marketMetrics: {
      averageRent,
      medianRent,
      occupancyRate: data?.occupancyRate ?? 95,
      rentGrowthYoY: data?.rentGrowth ?? 0,
    },
    comparableCount: comparables.length,
  };
}

/** Phase 5: OpenAI via Confidential HTTP – API key injected in enclave, never exposed */
function fetchOpenAIRecommendationConfidential(
  sendRequester: ConfidentialHTTPSendRequester,
  marketData: MarketData,
  config: Config
): OpenAIRecommendation {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentMonth = monthNames[new Date().getMonth()];

  const prompt = `You are an expert real estate pricing analyst. Analyze the provided market data and generate an optimal rental price recommendation.

MARKET DATA:
${JSON.stringify(marketData, null, 2)}

CURRENT PROPERTY:
- Address: ${config.propertyAddress}
- Property Type: ${config.propertyType}
- Valuation: $${config.propertyValuation.toLocaleString()}

ANALYSIS REQUIREMENTS:
1. Compare to market averages from comparable properties
2. Consider rent growth (${marketData.marketMetrics.rentGrowthYoY}% YoY) and occupancy (${marketData.marketMetrics.occupancyRate}%)
3. Account for seasonal factors (current month: ${currentMonth})
4. Prioritize stable occupancy over maximum rent
5. Be conservative with recommendations

OUTPUT FORMAT (JSON only, no other text):
{"price": <recommended monthly rent in USD as number>, "confidence": <0-100>, "reasoning": "<min 100 chars>"}

Return ONLY valid JSON.`;

  const requestBody = JSON.stringify({
    model: config.openaiModel,
    messages: [
      { role: "system", content: "Respond with valid JSON only." },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const response = sendRequester
    .sendRequest({
      vaultDonSecrets: [{ key: "OPENAI_API_KEY", namespace: "main" }],
      request: {
        url: "https://api.openai.com/v1/chat/completions",
        method: "POST",
        bodyString: requestBody,
        multiHeaders: {
          Authorization: { values: ["Bearer ${OPENAI_API_KEY}"] },
          "Content-Type": { values: ["application/json"] },
        },
        templatePublicValues: {},
      },
      encryptOutput: false,
    })
    .result();

  if (!ok(response)) {
    throw new Error(`OpenAI API failed: status ${response.statusCode}`);
  }

  const respBody = json(response) as { choices?: Array<{ message?: { content?: string } }> };
  const content = respBody?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  const parsed = JSON.parse(content) as OpenAIRecommendation;
  if (typeof parsed.price !== "number" || typeof parsed.confidence !== "number") {
    throw new Error("OpenAI response missing price or confidence");
  }

  return {
    price: Math.round(parsed.price),
    confidence: Math.min(100, Math.max(0, Math.round(parsed.confidence))),
    reasoning: String(parsed.reasoning ?? "").slice(0, 512) || "AI analysis.",
  };
}

/** Phase 4b: Submit recommendation on-chain via CRE writeReport → RecommendationConsumer → PriceManager */
function submitRecommendationOnchain(
  runtime: Runtime<Config>,
  config: Config,
  recommendation: PriceRecommendation
): string | null {
  const consumerAddr = config.recommendationConsumerAddress;
  if (!consumerAddr) return null;

  const chainName = config.chainName ?? "ethereum-testnet-sepolia";
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: chainName,
    isTestnet: true,
  });
  if (!network) {
    runtime.log(`On-chain write: unknown chain ${chainName}, skipping`);
    return null;
  }

  try {
    runtime.log(`Submitting recommendation on-chain to consumer: ${consumerAddr}`);

    const evmClient = new EVMClient(network.chainSelector.selector);

    // Price in USDC 6-decimal format (e.g. $30 → 30_000_000)
    const priceUsdc = BigInt(recommendation.recommendedPrice) * 1_000_000n;
    const confidence = BigInt(recommendation.confidenceScore);
    const reasoning = recommendation.reasoning;

    // Encode the recommendation as ABI parameters matching the consumer's abi.decode
    const reportData = encodeAbiParameters(
      parseAbiParameters("uint256 price, uint256 confidence, string reasoning"),
      [priceUsdc, confidence, reasoning]
    );

    runtime.log(
      `Writing report: price=$${recommendation.recommendedPrice} (${priceUsdc} raw), confidence=${confidence}%`
    );

    // Step 1: Generate a signed report using CRE consensus
    const reportResponse = runtime
      .report({
        encodedPayload: hexToBase64(reportData),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result();

    // Step 2: Submit the report to the consumer contract via KeystoneForwarder
    const writeResult = evmClient
      .writeReport(runtime, {
        receiver: consumerAddr,
        report: reportResponse,
        gasConfig: {
          gasLimit: config.gasLimit ?? "500000",
        },
      })
      .result();

    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
    runtime.log(`On-chain write succeeded: ${txHash}`);
    return txHash;
  } catch (err) {
    runtime.log(`On-chain write failed: ${(err as Error).message}`);
    return null;
  }
}

function getMockRecommendation(config: Config): PriceRecommendation {
  const baseRent = config.propertyValuation * 0.006;
  const recommendedPrice = Math.round(baseRent);
  return {
    recommendedPrice,
    confidenceScore: 75,
    reasoning:
      `Mock recommendation for ${config.propertyType} at ${config.propertyAddress}. ` +
      `Based on property valuation of $${config.propertyValuation.toLocaleString()}, ` +
      `suggested monthly rent: $${recommendedPrice.toLocaleString()}. ` +
      `Use real Market Data API + OpenAI for production.`,
    source: "mock",
  };
}

// Fetch market data from Market Data API (Redfin adapter)
function fetchMarketData(
  sendRequester: HTTPSendRequester,
  apiUrl: string,
  _apiKey: string,
  config: Config
): MarketData {
  const url = new URL(apiUrl);
  url.searchParams.set("address", config.propertyAddress);
  url.searchParams.set("radius", config.marketDataRadiusMiles);
  url.searchParams.set("propertyType", config.propertyType);

  const response = sendRequester
    .sendRequest({
      url: url.toString(),
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      timeout: "15s",
    })
    .result();

  if (!ok(response)) {
    throw new Error(`Market Data API failed: status ${response.statusCode}`);
  }

  const body = json(response) as MarketDataResponse;
  const data = body?.data;
  const comparables = data?.comparables ?? [];
  const prices = comparables.map((c) => c.price);

  const averageRent =
    data?.averageRent ??
    (prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0);
  const medianRent =
    data?.medianRent ??
    (prices.length > 0
      ? (() => {
        const sorted = [...prices].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      })()
      : 0);

  return {
    marketMetrics: {
      averageRent,
      medianRent,
      occupancyRate: data?.occupancyRate ?? 95,
      rentGrowthYoY: data?.rentGrowth ?? 0,
    },
    comparableCount: comparables.length,
  };
}

// Fetch AI pricing recommendation from OpenAI API
function fetchOpenAIRecommendation(
  sendRequester: HTTPSendRequester,
  apiKey: string,
  marketData: MarketData,
  config: Config
): OpenAIRecommendation {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentMonth = monthNames[new Date().getMonth()];

  const prompt = `You are an expert real estate pricing analyst. Analyze the provided market data and generate an optimal rental price recommendation.

MARKET DATA:
${JSON.stringify(marketData, null, 2)}

CURRENT PROPERTY:
- Address: ${config.propertyAddress}
- Property Type: ${config.propertyType}
- Valuation: $${config.propertyValuation.toLocaleString()}

ANALYSIS REQUIREMENTS:
1. Compare to market averages from comparable properties
2. Consider rent growth (${marketData.marketMetrics.rentGrowthYoY}% YoY) and occupancy (${marketData.marketMetrics.occupancyRate}%)
3. Account for seasonal factors (current month: ${currentMonth})
4. Prioritize stable occupancy over maximum rent
5. Be conservative with recommendations

OUTPUT FORMAT (JSON only, no other text):
{"price": <recommended monthly rent in USD as number>, "confidence": <0-100>, "reasoning": "<min 100 chars>"}

Return ONLY valid JSON.`;

  const bodyBytes = new TextEncoder().encode(
    JSON.stringify({
      model: config.openaiModel,
      messages: [
        { role: "system", content: "Respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    })
  );
  const bodyB64 = Buffer.from(bodyBytes).toString("base64");

  const response = sendRequester
    .sendRequest({
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: bodyB64,
      timeout: "30s",
    })
    .result();

  if (!ok(response)) {
    throw new Error(`OpenAI API failed: status ${response.statusCode}`);
  }

  const respBody = json(response) as { choices?: Array<{ message?: { content?: string } }> };
  const content = respBody?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  const parsed = JSON.parse(content) as OpenAIRecommendation;
  if (typeof parsed.price !== "number" || typeof parsed.confidence !== "number") {
    throw new Error("OpenAI response missing price or confidence");
  }

  return {
    price: Math.round(parsed.price),
    confidence: Math.min(100, Math.max(0, Math.round(parsed.confidence))),
    reasoning: String(parsed.reasoning ?? "").slice(0, 512) || "AI analysis.", // Matches contract MAX_REASONING_LENGTH
  };
}

const onCronTrigger = (runtime: Runtime<Config>): string => {
  runtime.log("YieldProp workflow triggered.");

  const config = runtime.config;
  let recommendation: PriceRecommendation;

  if (config.useMockRecommendation) {
    runtime.log("Using mock recommendation (no API calls).");
    recommendation = getMockRecommendation(config);
  } else if (config.useConfidentialHttp) {
    try {
      // Phase 5: Confidential HTTP – API keys injected in enclave, never exposed
      runtime.log("Using Confidential HTTP (API keys protected in enclave).");
      const confidentialHttp = new ConfidentialHTTPClient();

      const marketData = confidentialHttp
        .sendRequest(
          runtime,
          (req: ConfidentialHTTPSendRequester, url: string) =>
            fetchMarketDataConfidential(req, url, config),
          consensusIdenticalAggregation<MarketData>()
        )(config.marketDataApiUrl)
        .result();

      runtime.log(
        `Market Data: median rent $${marketData.marketMetrics.medianRent}, ${marketData.comparableCount} comparables`
      );

      const aiRec = confidentialHttp
        .sendRequest(
          runtime,
          (req: ConfidentialHTTPSendRequester, data: MarketData) =>
            fetchOpenAIRecommendationConfidential(req, data, config),
          ConsensusAggregationByFields<OpenAIRecommendation>({
            price: median,
            confidence: median,
            reasoning: identical,
          })
        )(marketData)
        .result();

      recommendation = {
        recommendedPrice: aiRec.price,
        confidenceScore: aiRec.confidence,
        reasoning: aiRec.reasoning,
        source: "openai",
      };

      runtime.log(`OpenAI: $${aiRec.price}/mo, confidence ${aiRec.confidence}%`);
    } catch (err) {
      const errMsg = (err as Error).message;
      runtime.log(`Confidential HTTP API error: ${errMsg}`);
      throw new Error(`Workflow failed (confidential mode): ${errMsg}`);
    }
  } else {
    try {
      // Standard HTTP – fetch secrets at DON level (cannot call getSecret inside runInNodeMode)
      const openaiSecret = runtime.getSecret({ id: "OPENAI_API_KEY" }).result();
      const openaiKey = openaiSecret.value ?? "";

      if (!openaiKey) {
        throw new Error("OPENAI_API_KEY not configured");
      }

      const httpClient = new HTTPClient();

      const marketData = httpClient
        .sendRequest(
          runtime,
          (req: HTTPSendRequester, url: string, key: string) =>
            fetchMarketData(req, url, key, config),
          consensusIdenticalAggregation<MarketData>()
        )(config.marketDataApiUrl, "")
        .result();

      runtime.log(
        `Market Data: median rent $${marketData.marketMetrics.medianRent}, ${marketData.comparableCount} comparables`
      );

      const aiRec = httpClient
        .sendRequest(
          runtime,
          (req: HTTPSendRequester, key: string, data: MarketData) =>
            fetchOpenAIRecommendation(req, key, data, config),
          ConsensusAggregationByFields<OpenAIRecommendation>({
            price: median,
            confidence: median,
            reasoning: identical,
          })
        )(openaiKey, marketData)
        .result();

      recommendation = {
        recommendedPrice: aiRec.price,
        confidenceScore: aiRec.confidence,
        reasoning: aiRec.reasoning,
        source: "openai",
      };

      runtime.log(`OpenAI: $${aiRec.price}/mo, confidence ${aiRec.confidence}%`);
    } catch (err) {
      const errMsg = (err as Error).message;
      runtime.log(`API error: ${errMsg}`);
      throw new Error(`Workflow failed (standard mode): ${errMsg}`);
    }
  }

  runtime.log(
    `Recommendation: $${recommendation.recommendedPrice}/mo, confidence ${recommendation.confidenceScore}%`
  );

  // Phase 4: Check reserve health when contract addresses are configured
  const reserveHealth = checkReserveHealth(runtime, config);

  // Phase 4b: Submit recommendation on-chain via CRE writeReport
  const txHash = submitRecommendationOnchain(runtime, config, recommendation);

  const output: Record<string, unknown> = {
    recommendedPrice: recommendation.recommendedPrice,
    confidenceScore: recommendation.confidenceScore,
    reasoning: recommendation.reasoning,
    source: recommendation.source,
    timestamp: new Date().toISOString(),
  };
  if (reserveHealth) {
    output.reserveHealth = reserveHealth;
  }
  if (txHash) {
    output.txHash = txHash;
  }
  return JSON.stringify(output);
};

const initWorkflow = (config: Config) => {
  const cron = new CronCapability();
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
