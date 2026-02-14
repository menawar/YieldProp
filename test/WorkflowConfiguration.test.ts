import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

/**
 * Unit Tests for CRE Workflow Configuration
 * 
 * Tests workflow YAML parsing, environment variable substitution,
 * and step dependency resolution.
 * 
 * Requirements: 11.1 - Workflow configurable via YAML
 */

describe("Workflow Configuration Tests", function () {
  let workflowConfig: any;
  const workflowPath = path.join(__dirname, "../workflows/yieldprop-optimization.yaml");

  before(function () {
    // Load and parse workflow YAML
    const workflowContent = fs.readFileSync(workflowPath, "utf8");
    workflowConfig = yaml.parse(workflowContent);
  });

  describe("Workflow YAML Parsing", function () {
    it("should successfully parse workflow YAML file", function () {
      expect(workflowConfig).to.not.be.undefined;
      expect(workflowConfig).to.be.an("object");
    });

    it("should have required top-level fields", function () {
      expect(workflowConfig).to.have.property("name");
      expect(workflowConfig).to.have.property("version");
      expect(workflowConfig).to.have.property("description");
      expect(workflowConfig).to.have.property("triggers");
      expect(workflowConfig).to.have.property("environment");
      expect(workflowConfig).to.have.property("steps");
    });

    it("should have correct workflow metadata", function () {
      expect(workflowConfig.name).to.equal("yieldprop-optimization");
      expect(workflowConfig.version).to.equal("1.0.0");
      expect(workflowConfig.description).to.be.a("string");
      expect(workflowConfig.description.length).to.be.greaterThan(0);
    });

    it("should have metadata section with required fields", function () {
      expect(workflowConfig).to.have.property("metadata");
      expect(workflowConfig.metadata).to.have.property("author");
      expect(workflowConfig.metadata).to.have.property("created");
      expect(workflowConfig.metadata).to.have.property("hackathon");
      expect(workflowConfig.metadata).to.have.property("category");
      expect(workflowConfig.metadata).to.have.property("tags");
    });
  });

  describe("Trigger Configuration", function () {
    it("should have at least one trigger defined", function () {
      expect(workflowConfig.triggers).to.be.an("array");
      expect(workflowConfig.triggers.length).to.be.greaterThan(0);
    });

    it("should have cron trigger for scheduled execution", function () {
      const cronTrigger = workflowConfig.triggers.find((t: any) => t.type === "cron");
      expect(cronTrigger).to.not.be.undefined;
      expect(cronTrigger).to.have.property("schedule");
      expect(cronTrigger.schedule).to.be.a("string");
      // Validate cron expression format (5 or 6 fields)
      const cronFields = cronTrigger.schedule.split(" ");
      expect(cronFields.length).to.be.oneOf([5, 6]);
    });

    it("should have manual trigger for on-demand execution", function () {
      const manualTrigger = workflowConfig.triggers.find((t: any) => t.type === "manual");
      expect(manualTrigger).to.not.be.undefined;
      expect(manualTrigger).to.have.property("description");
    });

    it("should have enabled flag for each trigger", function () {
      workflowConfig.triggers.forEach((trigger: any) => {
        expect(trigger).to.have.property("enabled");
        expect(trigger.enabled).to.be.a("boolean");
      });
    });
  });

  describe("Environment Variable Configuration", function () {
    it("should define all required environment variables", function () {
      expect(workflowConfig.environment).to.be.an("object");
      
      const requiredVars = [
        "RENTCAST_API_KEY",
        "RENTCAST_API_URL",
        "OPENAI_API_KEY",
        "PROPERTY_ADDRESS",
        "PROPERTY_TYPE",
        "PROPERTY_VALUATION",
        "PROPERTY_TOKEN_ADDRESS",
        "PRICE_MANAGER_ADDRESS",
        "YIELD_DISTRIBUTOR_ADDRESS",
        "ETHEREUM_RPC_URL",
        "PRIVATE_KEY",
      ];

      requiredVars.forEach((varName) => {
        expect(workflowConfig.environment).to.have.property(varName);
      });
    });

    it("should mark required variables correctly", function () {
      const requiredVars = [
        "RENTCAST_API_KEY",
        "OPENAI_API_KEY",
        "PROPERTY_ADDRESS",
        "ETHEREUM_RPC_URL",
        "PRIVATE_KEY",
      ];

      requiredVars.forEach((varName) => {
        const varConfig = workflowConfig.environment[varName];
        expect(varConfig).to.have.property("required");
        expect(varConfig.required).to.be.true;
      });
    });

    it("should have descriptions for all environment variables", function () {
      Object.keys(workflowConfig.environment).forEach((varName) => {
        const varConfig = workflowConfig.environment[varName];
        expect(varConfig).to.have.property("description");
        expect(varConfig.description).to.be.a("string");
        expect(varConfig.description.length).to.be.greaterThan(0);
      });
    });

    it("should mark sensitive variables appropriately", function () {
      const sensitiveVars = ["PRIVATE_KEY"];
      
      sensitiveVars.forEach((varName) => {
        const varConfig = workflowConfig.environment[varName];
        expect(varConfig).to.have.property("sensitive");
        expect(varConfig.sensitive).to.be.true;
      });
    });

    it("should provide default values for optional variables", function () {
      const optionalVars = ["RENTCAST_API_URL", "OPENAI_MODEL", "MARKET_DATA_RADIUS_MILES"];
      
      optionalVars.forEach((varName) => {
        if (workflowConfig.environment[varName]) {
          const varConfig = workflowConfig.environment[varName];
          if (varConfig.required === false) {
            expect(varConfig).to.have.property("default");
          }
        }
      });
    });
  });

  describe("Environment Variable Substitution", function () {
    it("should use ${VAR_NAME} syntax for variable references", function () {
      const yamlContent = fs.readFileSync(workflowPath, "utf8");
      
      // Check that environment variables are referenced with ${} syntax
      expect(yamlContent).to.include("${RENTCAST_API_KEY}");
      expect(yamlContent).to.include("${OPENAI_API_KEY}");
      expect(yamlContent).to.include("${PROPERTY_ADDRESS}");
      expect(yamlContent).to.include("${ETHEREUM_RPC_URL}");
    });

    it("should reference step outputs correctly", function () {
      const yamlContent = fs.readFileSync(workflowPath, "utf8");
      
      // Check that step outputs are referenced correctly
      expect(yamlContent).to.include("${steps.fetch-market-data.outputs");
      expect(yamlContent).to.include("${steps.analyze-pricing.outputs");
      expect(yamlContent).to.include("${steps.check-rental-payment.outputs");
    });

    it("should not have hardcoded sensitive values", function () {
      const yamlContent = fs.readFileSync(workflowPath, "utf8");
      
      // Check that no private keys or API keys are hardcoded
      expect(yamlContent).to.not.match(/0x[a-fA-F0-9]{64}/); // Private key pattern
      expect(yamlContent).to.not.match(/sk-[a-zA-Z0-9]{48}/); // OpenAI API key pattern
    });
  });

  describe("Step Configuration", function () {
    it("should have all required workflow steps", function () {
      expect(workflowConfig.steps).to.be.an("array");
      expect(workflowConfig.steps.length).to.equal(5);

      const stepIds = workflowConfig.steps.map((s: any) => s.id);
      expect(stepIds).to.include("fetch-market-data");
      expect(stepIds).to.include("analyze-pricing");
      expect(stepIds).to.include("submit-recommendation");
      expect(stepIds).to.include("check-rental-payment");
      expect(stepIds).to.include("distribute-yields");
    });

    it("should have required fields for each step", function () {
      workflowConfig.steps.forEach((step: any) => {
        expect(step).to.have.property("id");
        expect(step).to.have.property("name");
        expect(step).to.have.property("type");
        expect(step).to.have.property("description");
        expect(step).to.have.property("config");
      });
    });

    it("should have correct step types", function () {
      const stepTypes = workflowConfig.steps.map((s: any) => ({ id: s.id, type: s.type }));
      
      expect(stepTypes.find((s: any) => s.id === "fetch-market-data")?.type).to.equal("http-request");
      expect(stepTypes.find((s: any) => s.id === "analyze-pricing")?.type).to.equal("http-request");
      expect(stepTypes.find((s: any) => s.id === "submit-recommendation")?.type).to.equal("ethereum-transaction");
      expect(stepTypes.find((s: any) => s.id === "check-rental-payment")?.type).to.equal("ethereum-call");
      expect(stepTypes.find((s: any) => s.id === "distribute-yields")?.type).to.equal("ethereum-transaction");
    });

    it("should have outputs defined for each step", function () {
      workflowConfig.steps.forEach((step: any) => {
        expect(step).to.have.property("outputs");
        expect(step.outputs).to.be.an("object");
        expect(Object.keys(step.outputs).length).to.be.greaterThan(0);
      });
    });

    it("should have error handling configured for each step", function () {
      workflowConfig.steps.forEach((step: any) => {
        expect(step).to.have.property("on_error");
        expect(step.on_error).to.have.property("action");
        expect(step.on_error).to.have.property("log");
        expect(step.on_error.log).to.be.true;
      });
    });
  });

  describe("Step Dependency Resolution", function () {
    it("should have correct dependency chain", function () {
      const steps = workflowConfig.steps;
      
      // fetch-market-data should have no dependencies
      const fetchStep = steps.find((s: any) => s.id === "fetch-market-data");
      expect(fetchStep.depends_on).to.be.undefined;

      // analyze-pricing should depend on fetch-market-data
      const analyzeStep = steps.find((s: any) => s.id === "analyze-pricing");
      expect(analyzeStep.depends_on).to.include("fetch-market-data");

      // submit-recommendation should depend on analyze-pricing
      const submitStep = steps.find((s: any) => s.id === "submit-recommendation");
      expect(submitStep.depends_on).to.include("analyze-pricing");

      // check-rental-payment should depend on submit-recommendation
      const checkStep = steps.find((s: any) => s.id === "check-rental-payment");
      expect(checkStep.depends_on).to.include("submit-recommendation");

      // distribute-yields should depend on check-rental-payment
      const distributeStep = steps.find((s: any) => s.id === "distribute-yields");
      expect(distributeStep.depends_on).to.include("check-rental-payment");
    });

    it("should not have circular dependencies", function () {
      const steps = workflowConfig.steps;
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      function hasCycle(stepId: string): boolean {
        if (recursionStack.has(stepId)) return true;
        if (visited.has(stepId)) return false;

        visited.add(stepId);
        recursionStack.add(stepId);

        const step = steps.find((s: any) => s.id === stepId);
        if (step && step.depends_on) {
          for (const dep of step.depends_on) {
            if (hasCycle(dep)) return true;
          }
        }

        recursionStack.delete(stepId);
        return false;
      }

      steps.forEach((step: any) => {
        expect(hasCycle(step.id)).to.be.false;
      });
    });

    it("should reference only existing steps in dependencies", function () {
      const stepIds = new Set(workflowConfig.steps.map((s: any) => s.id));

      workflowConfig.steps.forEach((step: any) => {
        if (step.depends_on) {
          step.depends_on.forEach((depId: string) => {
            expect(stepIds.has(depId)).to.be.true;
          });
        }
      });
    });
  });

  describe("HTTP Request Configuration", function () {
    it("should configure RentCast API request correctly", function () {
      const fetchStep = workflowConfig.steps.find((s: any) => s.id === "fetch-market-data");
      
      expect(fetchStep.config.method).to.equal("GET");
      expect(fetchStep.config.url).to.include("${RENTCAST_API_URL}");
      expect(fetchStep.config.headers).to.have.property("X-API-Key");
      expect(fetchStep.config).to.have.property("query_params");
    });

    it("should configure OpenAI API request correctly", function () {
      const analyzeStep = workflowConfig.steps.find((s: any) => s.id === "analyze-pricing");
      
      expect(analyzeStep.config.method).to.equal("POST");
      expect(analyzeStep.config.url).to.include("openai.com");
      expect(analyzeStep.config.headers).to.have.property("Authorization");
      expect(analyzeStep.config).to.have.property("body");
      expect(analyzeStep.config.body).to.have.property("model");
      expect(analyzeStep.config.body).to.have.property("messages");
    });

    it("should have retry configuration for HTTP requests", function () {
      const httpSteps = workflowConfig.steps.filter((s: any) => s.type === "http-request");
      
      httpSteps.forEach((step: any) => {
        expect(step.config).to.have.property("retry");
        expect(step.config.retry).to.have.property("max_attempts");
        expect(step.config.retry).to.have.property("initial_delay");
        expect(step.config.retry).to.have.property("backoff_multiplier");
        expect(step.config.retry.max_attempts).to.be.greaterThan(0);
      });
    });

    it("should have timeout configuration for HTTP requests", function () {
      const httpSteps = workflowConfig.steps.filter((s: any) => s.type === "http-request");
      
      httpSteps.forEach((step: any) => {
        expect(step.config).to.have.property("timeout");
        expect(step.config.timeout).to.be.a("number");
        expect(step.config.timeout).to.be.greaterThan(0);
      });
    });

    it("should have cache configuration for market data fetch", function () {
      const fetchStep = workflowConfig.steps.find((s: any) => s.id === "fetch-market-data");
      
      expect(fetchStep.config).to.have.property("cache");
      expect(fetchStep.config.cache).to.have.property("enabled");
      expect(fetchStep.config.cache).to.have.property("ttl");
      expect(fetchStep.config.cache).to.have.property("use_on_error");
      expect(fetchStep.config.cache.enabled).to.be.true;
    });
  });

  describe("Ethereum Transaction Configuration", function () {
    it("should configure blockchain transactions correctly", function () {
      const txSteps = workflowConfig.steps.filter((s: any) => 
        s.type === "ethereum-transaction" || s.type === "ethereum-call"
      );
      
      txSteps.forEach((step: any) => {
        expect(step.config).to.have.property("rpc_url");
        expect(step.config).to.have.property("contract_address");
        expect(step.config).to.have.property("function_name");
        expect(step.config).to.have.property("abi");
      });
    });

    it("should have correct chain ID for Sepolia testnet", function () {
      const txSteps = workflowConfig.steps.filter((s: any) => 
        s.type === "ethereum-transaction" || s.type === "ethereum-call"
      );
      
      txSteps.forEach((step: any) => {
        if (step.config.chain_id) {
          expect(step.config.chain_id).to.equal(11155111); // Sepolia
        }
      });
    });

    it("should have gas configuration for transactions", function () {
      const txSteps = workflowConfig.steps.filter((s: any) => s.type === "ethereum-transaction");
      
      txSteps.forEach((step: any) => {
        expect(step.config).to.have.property("gas_limit");
        expect(step.config.gas_limit).to.be.a("number");
        expect(step.config.gas_limit).to.be.greaterThan(0);
      });
    });

    it("should have valid ABI for each contract call", function () {
      const contractSteps = workflowConfig.steps.filter((s: any) => 
        s.type === "ethereum-transaction" || s.type === "ethereum-call"
      );
      
      contractSteps.forEach((step: any) => {
        expect(step.config.abi).to.be.a("string");
        // Should be valid JSON
        expect(() => JSON.parse(step.config.abi)).to.not.throw();
        const abi = JSON.parse(step.config.abi);
        expect(abi).to.be.an("array");
        expect(abi.length).to.be.greaterThan(0);
      });
    });
  });

  describe("Conditional Execution", function () {
    it("should have condition for submit-recommendation step", function () {
      const submitStep = workflowConfig.steps.find((s: any) => s.id === "submit-recommendation");
      expect(submitStep).to.have.property("condition");
      expect(submitStep.condition).to.be.a("string");
      expect(submitStep.condition).to.include("recommended_price");
    });

    it("should have condition for distribute-yields step", function () {
      const distributeStep = workflowConfig.steps.find((s: any) => s.id === "distribute-yields");
      expect(distributeStep).to.have.property("condition");
      expect(distributeStep.condition).to.be.a("string");
      expect(distributeStep.condition).to.include("pool_balance");
    });
  });

  describe("Error Handling Configuration", function () {
    it("should have workflow-level error handling", function () {
      expect(workflowConfig).to.have.property("error_handling");
      expect(workflowConfig.error_handling).to.have.property("strategy");
      expect(workflowConfig.error_handling).to.have.property("log_errors");
      expect(workflowConfig.error_handling.log_errors).to.be.true;
    });

    it("should continue on errors (not halt workflow)", function () {
      expect(workflowConfig.error_handling.strategy).to.equal("continue");
      
      workflowConfig.steps.forEach((step: any) => {
        expect(step.on_error.action).to.equal("continue");
      });
    });
  });

  describe("Logging Configuration", function () {
    it("should have logging configuration", function () {
      expect(workflowConfig).to.have.property("logging");
      expect(workflowConfig.logging).to.have.property("level");
      expect(workflowConfig.logging).to.have.property("include_timestamps");
      expect(workflowConfig.logging).to.have.property("include_step_outputs");
    });

    it("should enable timestamp logging", function () {
      expect(workflowConfig.logging.include_timestamps).to.be.true;
    });

    it("should enable step output logging", function () {
      expect(workflowConfig.logging.include_step_outputs).to.be.true;
    });
  });

  describe("Monitoring Configuration", function () {
    it("should have monitoring enabled", function () {
      expect(workflowConfig).to.have.property("monitoring");
      expect(workflowConfig.monitoring).to.have.property("enabled");
      expect(workflowConfig.monitoring.enabled).to.be.true;
    });

    it("should define metrics to track", function () {
      expect(workflowConfig.monitoring).to.have.property("metrics");
      expect(workflowConfig.monitoring.metrics).to.be.an("array");
      expect(workflowConfig.monitoring.metrics.length).to.be.greaterThan(0);
    });

    it("should define alert conditions", function () {
      expect(workflowConfig.monitoring).to.have.property("alerts");
      expect(workflowConfig.monitoring.alerts).to.be.an("array");
      expect(workflowConfig.monitoring.alerts.length).to.be.greaterThan(0);
      
      workflowConfig.monitoring.alerts.forEach((alert: any) => {
        expect(alert).to.have.property("condition");
        expect(alert).to.have.property("message");
      });
    });
  });

  describe("Requirements Validation", function () {
    it("should document validated requirements in metadata", function () {
      expect(workflowConfig.metadata).to.have.property("requirements_validated");
      expect(workflowConfig.metadata.requirements_validated).to.be.an("array");
      expect(workflowConfig.metadata.requirements_validated.length).to.be.greaterThan(0);
    });

    it("should validate all Task 10 requirements", function () {
      const requirements = workflowConfig.metadata.requirements_validated;
      
      expect(requirements.some((r: string) => r.includes("2.1"))).to.be.true; // Fetch market data
      expect(requirements.some((r: string) => r.includes("2.2"))).to.be.true; // Call AI agent
      expect(requirements.some((r: string) => r.includes("2.3"))).to.be.true; // Submit recommendation
      expect(requirements.some((r: string) => r.includes("2.5"))).to.be.true; // Error handling
      expect(requirements.some((r: string) => r.includes("2.6"))).to.be.true; // Yield distribution
      expect(requirements.some((r: string) => r.includes("11.1"))).to.be.true; // YAML configuration
      expect(requirements.some((r: string) => r.includes("11.3"))).to.be.true; // Logging
    });
  });
});
