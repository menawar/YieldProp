/**
 * Type definitions for Market Data Oracle, AI Pricing Agent, and Workflow Orchestrator
 */

// --- Market Data & AI Types ---

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
 * PropertyDetails for AI Analysis
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

// --- Workflow Orchestrator Types ---

export interface WorkflowConfig {
  name: string;
  version: string;
  description: string;
  triggers: Trigger[];
  environment: Record<string, EnvironmentVariable>;
  steps: WorkflowStep[];
  error_handling: ErrorHandling;
  logging: LoggingConfig;
  monitoring?: MonitoringConfig;
  metadata: WorkflowMetadata;
}

export interface Trigger {
  type: "cron" | "manual";
  schedule?: string;
  description: string;
  enabled: boolean;
}

export interface EnvironmentVariable {
  required: boolean;
  default?: string;
  description: string;
  sensitive?: boolean;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: "http-request" | "ethereum-transaction" | "ethereum-call";
  description: string;
  depends_on?: string[];
  condition?: string;
  config: StepConfig;
  outputs: Record<string, OutputConfig>;
  on_error: ErrorConfig;
}

export interface StepConfig {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  query_params?: Record<string, any>;
  body?: any;
  timeout?: number;
  cache?: CacheConfig;
  retry?: RetryConfig;
  rpc_url?: string;
  private_key?: string;
  chain_id?: number;
  contract_address?: string;
  function_name?: string;
  abi?: string;
  function_args?: any[];
  gas_limit?: number;
  max_fee_per_gas?: number;
  max_priority_fee_per_gas?: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  use_on_error: boolean;
  key?: string;
}

export interface RetryConfig {
  max_attempts: number;
  initial_delay: number;
  backoff_multiplier: number;
  max_delay: number;
  retry_on_status?: number[];
  retry_on_timeout?: boolean;
  retry_on_revert?: boolean;
}

export interface OutputConfig {
  path: string;
  transform?: string;
  validate?: ValidationConfig;
  default?: any;
  description: string;
}

export interface ValidationConfig {
  type: string;
  min?: number;
  max?: number;
  min_length?: number;
}

export interface ErrorConfig {
  action: "continue" | "halt";
  log: boolean;
  message?: string;
}

export interface ErrorHandling {
  strategy: "continue" | "halt";
  log_errors: boolean;
  notify_on_failure: boolean;
  max_consecutive_failures?: number;
}

export interface LoggingConfig {
  level: string;
  include_timestamps: boolean;
  include_step_outputs: boolean;
  include_step_duration?: boolean;
  format: string;
  destination: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: MetricConfig[];
  alerts: AlertConfig[];
}

export interface MetricConfig {
  name: string;
  description: string;
  unit: string;
}

export interface AlertConfig {
  condition: string;
  severity?: string;
  message: string;
}

export interface WorkflowMetadata {
  author: string;
  created: string;
  updated?: string;
  version: string;
  hackathon?: string;
  category: string;
  tags: string[];
  requirements_validated?: string[];
}

export interface WorkflowState {
  workflow_id: string;
  execution_id: string;
  start_time: number;
  end_time?: number;
  status: "running" | "completed" | "failed";
  current_step?: string;
  step_outputs: Record<string, any>;
  errors: WorkflowError[];
  metrics: Record<string, any>;
}

export interface WorkflowError {
  step_id: string;
  timestamp: number;
  error: string;
  stack?: string;
}

export interface StepExecutionResult {
  success: boolean;
  outputs: Record<string, any>;
  error?: string;
  duration: number;
  cached?: boolean;
}
