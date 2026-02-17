/**
 * Workflow Orchestrator
 * 
 * Executes workflow steps, manages state, handles errors, and implements retry logic.
 * 
 * Requirements:
 * - 2.1: Fetch rental market data at scheduled intervals
 * - 2.2: Call AI_Pricing_Agent with market data payload
 * - 2.3: Submit Price_Recommendation to on-chain smart contract
 * - 2.5: Log errors and continue operation
 * - 2.6: Trigger yield distribution after rental payment collection
 * - 11.3: Log each step execution with timestamps
 * - 13.1: Use cached data on API failure
 * - 13.2: Retry with exponential backoff
 * - 13.3: Log transaction failures
 */

import * as fs from "fs";
import * as yaml from "yaml";
import { ethers } from "ethers";
import { MarketDataOracle } from "./marketDataOracle";
import { AIPricingAgent } from "./aiPricingAgent";

import {
  WorkflowConfig,
  WorkflowState,
  WorkflowStep,
  StepExecutionResult,
  RetryConfig,
  OutputConfig
} from "./types";

/**
 * Workflow Orchestrator Class
 * Manages workflow execution, state, and error handling
 */
export class WorkflowOrchestrator {
  private config: WorkflowConfig;
  private state: WorkflowState;
  private cache: Map<string, { data: any; timestamp: number }>;
  private provider?: ethers.Provider;
  private wallet?: ethers.Wallet;
  private marketDataOracle: MarketDataOracle;
  private aiPricingAgent: AIPricingAgent;

  constructor(configPath: string) {
    // Load workflow configuration
    const configContent = fs.readFileSync(configPath, "utf8");
    this.config = yaml.parse(configContent);

    // Initialize state
    this.state = {
      workflow_id: this.config.name,
      execution_id: `exec-${Date.now()}`,
      start_time: Date.now(),
      status: "running",
      step_outputs: {},
      errors: [],
      metrics: {},
    };

    // Initialize cache
    this.cache = new Map();

    // Initialize services
    this.marketDataOracle = new MarketDataOracle();
    this.aiPricingAgent = new AIPricingAgent();

    // Initialize blockchain provider if needed
    this.initializeBlockchain();

    this.log("info", `Workflow orchestrator initialized: ${this.config.name} v${this.config.version}`);
  }

  /**
   * Initialize blockchain provider and wallet
   */
  private initializeBlockchain(): void {
    const rpcUrl = process.env.ETHEREUM_RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;

    if (rpcUrl && privateKey) {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.log("info", "Blockchain provider initialized");
    }
  }

  /**
   * Execute the complete workflow
   * Requirement 11.3: Log each step execution with timestamps
   */
  async execute(): Promise<WorkflowState> {
    this.log("info", `🚀 Starting workflow execution: ${this.state.execution_id}`);

    try {
      // Execute steps in order, respecting dependencies
      for (const step of this.config.steps) {
        await this.executeStep(step);
      }

      // Mark workflow as completed
      this.state.status = "completed";
      this.state.end_time = Date.now();
      const duration = this.state.end_time - this.state.start_time;

      this.log("info", `✅ Workflow completed successfully in ${duration}ms`);
    } catch (error) {
      // Handle workflow-level errors
      this.state.status = "failed";
      this.state.end_time = Date.now();

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log("error", `❌ Workflow failed: ${errorMessage}`);

      this.state.errors.push({
        step_id: "workflow",
        timestamp: Date.now(),
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Requirement 2.5: Continue operation (don't throw)
      if (this.config.error_handling.strategy === "continue") {
        this.log("info", "Continuing despite workflow error");
      }
    }

    return this.state;
  }

  /**
   * Execute a single workflow step
   * Requirement 2.5: Log errors and continue operation
   */
  private async executeStep(step: WorkflowStep): Promise<void> {
    const startTime = Date.now();
    this.state.current_step = step.id;

    this.log("info", `📍 Executing step: ${step.id} - ${step.name}`);

    try {
      // Check dependencies
      if (step.depends_on) {
        for (const depId of step.depends_on) {
          if (!this.state.step_outputs[depId]) {
            throw new Error(`Dependency not met: ${depId}`);
          }
        }
      }

      // Check condition
      if (step.condition && !this.evaluateCondition(step.condition)) {
        this.log("info", `⏭️  Skipping step ${step.id}: condition not met`);
        return;
      }

      // Execute step based on type
      let result: StepExecutionResult;

      switch (step.type) {
        case "http-request":
          result = await this.executeHttpRequest(step);
          break;
        case "ethereum-transaction":
          result = await this.executeEthereumTransaction(step);
          break;
        case "ethereum-call":
          result = await this.executeEthereumCall(step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      // Store step outputs
      this.state.step_outputs[step.id] = result.outputs;

      const duration = Date.now() - startTime;
      this.log("info", `✓ Step ${step.id} completed in ${duration}ms`);

      // Log outputs if configured
      if (this.config.logging.include_step_outputs) {
        this.log("debug", `Step outputs: ${JSON.stringify(result.outputs, null, 2)}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.log("error", `✗ Step ${step.id} failed after ${duration}ms: ${errorMessage}`);

      // Record error
      this.state.errors.push({
        step_id: step.id,
        timestamp: Date.now(),
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Handle error based on configuration
      if (step.on_error.action === "halt") {
        throw error;
      } else {
        this.log("info", `Continuing workflow despite step failure: ${step.id}`);
      }
    }
  }

  /**
   * Execute HTTP request step
   * Requirement 2.1: Fetch market data
   * Requirement 2.2: Call AI agent
   * Requirement 13.1: Use cached data on failure
   * Requirement 13.2: Retry with exponential backoff
   */
  private async executeHttpRequest(step: WorkflowStep): Promise<StepExecutionResult> {
    const startTime = Date.now();

    // Special handling for known endpoints
    if (step.id === "fetch-market-data") {
      return await this.executeFetchMarketData(step);
    } else if (step.id === "analyze-pricing") {
      return await this.executeAnalyzePricing(step);
    }

    // Generic HTTP request handling
    const config = step.config;
    const url = this.substituteVariables(config.url!);
    const method = config.method || "GET";

    try {
      // Check cache first
      if (config.cache?.enabled) {
        const cached = this.getFromCache(config.cache.key || step.id);
        if (cached) {
          this.log("info", `Using cached data for ${step.id}`);
          return {
            success: true,
            outputs: { data: cached, cached: true },
            duration: Date.now() - startTime,
            cached: true,
          };
        }
      }

      // Execute with retry
      const response = await this.executeWithRetry(
        async () => {
          const headers = this.substituteVariables(config.headers || {});
          const body = config.body ? this.substituteVariables(config.body) : undefined;

          const fetchOptions: RequestInit = {
            method,
            headers: headers as HeadersInit,
            body: body ? JSON.stringify(body) : undefined,
          };

          const response = await fetch(url, fetchOptions);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return await response.json();
        },
        config.retry
      );

      // Cache response if configured
      if (config.cache?.enabled) {
        this.setCache(config.cache.key || step.id, response, config.cache.ttl);
      }

      // Extract outputs
      const outputs = this.extractOutputs(response, step.outputs);

      return {
        success: true,
        outputs,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      // Try to use cached data on error
      if (config.cache?.use_on_error) {
        const cached = this.getFromCache(config.cache.key || step.id, true);
        if (cached) {
          this.log("warn", `Using stale cached data for ${step.id} due to error`);
          return {
            success: true,
            outputs: { data: cached, cached: true, stale: true },
            duration: Date.now() - startTime,
            cached: true,
          };
        }
      }

      throw error;
    }
  }

  /**
   * Execute market data fetch step
   */
  private async executeFetchMarketData(step: WorkflowStep): Promise<StepExecutionResult> {
    const startTime = Date.now();

    try {
      const marketData = await this.marketDataOracle.fetchMarketData(
        process.env.PROPERTY_ADDRESS || "",
        process.env.PROPERTY_TYPE || "",
        parseInt(process.env.MARKET_DATA_RADIUS_MILES || "5")
      );

      return {
        success: true,
        outputs: {
          market_data: marketData,
          is_cached: marketData.isStale || false,
          timestamp: marketData.timestamp,
        },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute AI pricing analysis step
   */
  private async executeAnalyzePricing(step: WorkflowStep): Promise<StepExecutionResult> {
    const startTime = Date.now();

    try {
      // Get market data from previous step
      const marketData = this.state.step_outputs["fetch-market-data"]?.market_data;

      if (!marketData) {
        throw new Error("Market data not available from previous step");
      }

      // Fetch current rental price: on-chain from PriceManager, or env fallback
      let currentPrice: number | undefined;
      const priceManagerAddr = process.env.PRICE_MANAGER_ADDRESS;

      if (this.provider && priceManagerAddr) {
        try {
          const abi = ["function getCurrentRentalPrice() view returns (uint256)"];
          const contract = new ethers.Contract(priceManagerAddr, abi, this.provider);
          const rawPrice = await contract.getCurrentRentalPrice();
          // PriceManager uses USDC decimals (6)
          currentPrice = Number(ethers.formatUnits(rawPrice, 6));
        } catch (err) {
          this.log("warn", `Could not fetch current price from PriceManager: ${err}`);
        }
      }

      if (currentPrice === undefined && process.env.PROPERTY_CURRENT_RENT) {
        currentPrice = parseInt(process.env.PROPERTY_CURRENT_RENT, 10);
      }

      // Build property details including currentPrice for accurate AI analysis
      const propertyDetails = {
        address: process.env.PROPERTY_ADDRESS || "",
        propertyType: process.env.PROPERTY_TYPE || "",
        valuation: parseInt(process.env.PROPERTY_VALUATION || "0"),
        ...(currentPrice !== undefined && !isNaN(currentPrice) && currentPrice > 0
          ? { currentPrice }
          : {}),
      };

      // Build pricing analysis request
      const request = {
        marketData,
        propertyDetails,
        currentMonth: new Date().getMonth() + 1,
      };

      // Call AI pricing agent (with fallback to rule-based on API failure)
      const recommendation = await this.aiPricingAgent.analyzePricing(request);

      return {
        success: true,
        outputs: {
          recommendation,
          recommended_price: recommendation.price,
          confidence_score: recommendation.confidence,
          reasoning: recommendation.reasoning,
        },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute Ethereum transaction step
   * Requirement 2.3: Submit recommendation to contract
   * Requirement 2.6: Distribute yields
   * Requirement 13.3: Log transaction failures
   */
  private async executeEthereumTransaction(step: WorkflowStep): Promise<StepExecutionResult> {
    const startTime = Date.now();

    if (!this.wallet || !this.provider) {
      throw new Error("Blockchain provider not initialized");
    }

    const config = step.config;
    const contractAddress = this.substituteVariables(config.contract_address!);
    const abi = JSON.parse(config.abi!);
    const functionName = config.function_name!;
    let args = config.function_args ? this.substituteVariables(config.function_args) : [];

    // PriceManager.submitRecommendation expects price in USDC (6 decimals)
    if (functionName === "submitRecommendation" && args.length >= 1) {
      const priceUsd = typeof args[0] === "number" ? args[0] : parseFloat(String(args[0]));
      if (!isNaN(priceUsd)) {
        args = [ethers.parseUnits(String(priceUsd), 6), ...args.slice(1)];
      }
    }

    try {
      // Create contract instance
      const contract = new ethers.Contract(contractAddress, abi, this.wallet);

      // Execute transaction with retry
      const tx = await this.executeWithRetry(
        async () => {
          return await contract[functionName](...args, {
            gasLimit: config.gas_limit,
            maxFeePerGas: config.max_fee_per_gas,
            maxPriorityFeePerGas: config.max_priority_fee_per_gas,
          });
        },
        config.retry
      );

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      this.log("info", `Transaction mined: ${receipt.hash}`);

      return {
        success: true,
        outputs: {
          transaction_hash: receipt.hash,
          block_number: receipt.blockNumber,
          gas_used: receipt.gasUsed.toString(),
        },
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log("error", `Transaction failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Execute Ethereum contract call (read-only)
   * Requirement 2.6: Check rental payment
   */
  private async executeEthereumCall(step: WorkflowStep): Promise<StepExecutionResult> {
    const startTime = Date.now();

    if (!this.provider) {
      throw new Error("Blockchain provider not initialized");
    }

    const config = step.config;
    const contractAddress = this.substituteVariables(config.contract_address!);
    const abi = JSON.parse(config.abi!);
    const functionName = config.function_name!;

    try {
      // Create contract instance
      const contract = new ethers.Contract(contractAddress, abi, this.provider);

      // Execute call
      const result = await contract[functionName]();

      return {
        success: true,
        outputs: {
          result: result.toString(),
          pool_balance: result.toString(),
          pool_balance_usd: Number(result) / 1e6, // Assuming USDC (6 decimals)
        },
        duration: Date.now() - startTime,
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute function with retry logic
   * Requirement 13.2: Retry with exponential backoff
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryConfig?: RetryConfig
  ): Promise<T> {
    if (!retryConfig) {
      return await fn();
    }

    let lastError: Error;
    let delay = retryConfig.initial_delay;

    for (let attempt = 1; attempt <= retryConfig.max_attempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < retryConfig.max_attempts) {
          this.log("warn", `Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * retryConfig.backoff_multiplier, retryConfig.max_delay);
        }
      }
    }

    throw new Error(`Failed after ${retryConfig.max_attempts} attempts: ${lastError!.message}`);
  }

  /**
   * Evaluate conditional expression
   */
  private evaluateCondition(condition: string): boolean {
    try {
      // Substitute variables in condition
      const evaluatedCondition = this.substituteVariables(condition);

      // Simple evaluation (in production, use a safe expression evaluator)
      // For now, just check if it contains ">" and evaluate
      if (evaluatedCondition.includes(">")) {
        const [left, right] = evaluatedCondition.split(">").map((s: string) => s.trim());
        return Number(left) > Number(right);
      }

      return Boolean(evaluatedCondition);
    } catch (error) {
      this.log("warn", `Failed to evaluate condition: ${condition}`);
      return false;
    }
  }

  /**
   * Substitute variables in strings
   */
  private substituteVariables(value: any): any {
    if (typeof value === "string") {
      // Substitute environment variables
      let result = value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        // Check if it's a step output reference
        if (varName.startsWith("steps.")) {
          const parts = varName.split(".");
          const stepId = parts[1];
          const outputPath = parts.slice(3).join(".");

          const stepOutput = this.state.step_outputs[stepId];
          if (stepOutput) {
            return this.getNestedValue(stepOutput, outputPath) || match;
          }
        }

        // Otherwise, it's an environment variable
        return process.env[varName] || match;
      });

      return result;
    } else if (Array.isArray(value)) {
      return value.map((item) => this.substituteVariables(item));
    } else if (typeof value === "object" && value !== null) {
      const result: any = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.substituteVariables(val);
      }
      return result;
    }

    return value;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  /**
   * Extract outputs from response based on output configuration
   */
  private extractOutputs(response: any, outputConfigs: Record<string, OutputConfig>): Record<string, any> {
    const outputs: Record<string, any> = {};

    for (const [key, config] of Object.entries(outputConfigs)) {
      try {
        // Extract value using path (simplified JSONPath)
        let value = response;
        if (config.path.startsWith("$.")) {
          const path = config.path.substring(2);
          value = this.getNestedValue(response, path);
        }

        // Apply transform if specified
        if (config.transform === "json_parse" && typeof value === "string") {
          value = JSON.parse(value);
        } else if (config.transform === "divide_by_1e6") {
          value = Number(value) / 1e6;
        }

        // Use default if value is undefined
        if (value === undefined && config.default !== undefined) {
          value = config.default;
        }

        outputs[key] = value;
      } catch (error) {
        this.log("warn", `Failed to extract output ${key}: ${error}`);
        if (config.default !== undefined) {
          outputs[key] = config.default;
        }
      }
    }

    return outputs;
  }

  /**
   * Cache management
   */
  private getFromCache(key: string, allowStale: boolean = false): any | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    const ttl = 86400000; // 24 hours in ms

    if (age < ttl || allowStale) {
      return cached.data;
    }

    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Logging with timestamps
   * Requirement 11.3: Log each step execution with timestamps
   */
  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      workflow: this.config.name,
      execution_id: this.state.execution_id,
      message,
    };

    if (this.config.logging.format === "json") {
      console.log(JSON.stringify(logEntry));
    } else {
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Get current workflow state
   */
  getState(): WorkflowState {
    return this.state;
  }
}

/**
 * Execute workflow from command line
 */
export async function executeWorkflow(configPath: string): Promise<WorkflowState> {
  const orchestrator = new WorkflowOrchestrator(configPath);
  return await orchestrator.execute();
}
