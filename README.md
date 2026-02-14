# YieldProp MVP

AI-Powered Dynamic Real Estate Yield Optimization Protocol for Chainlink Convergence Hackathon

## Overview

YieldProp MVP demonstrates the integration of blockchain, external APIs, and AI agents. The system tokenizes a single real estate property as an ERC-1400 security token, uses AI to generate optimal rental pricing recommendations based on market data, and automatically distributes rental yields to fractional token holders.

## Features

- **Property Tokenization**: ERC-1400 security token representing fractional ownership
- **AI-Powered Pricing**: OpenAI-based rental price optimization using market data
- **Automated Yield Distribution**: Proportional rental income distribution to token holders
- **Workflow Orchestration**: Node.js orchestrator for data fetching and AI analysis
- **Compliance**: Transfer restrictions and whitelist management

## Project Structure

```
.
├── contracts/          # Solidity smart contracts
├── test/              # Contract tests
├── ignition/          # Deployment scripts
├── .kiro/specs/       # Project specifications
└── hardhat.config.ts  # Hardhat configuration
```

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Compile Contracts**
   ```bash
   npm run compile
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

## Environment Variables

See `.env.example` for required configuration:
- `SEPOLIA_RPC_URL`: Ethereum Sepolia testnet RPC endpoint
- `PRIVATE_KEY`: Deployer private key
- `ETHERSCAN_API_KEY`: For contract verification
- `RENTCAST_API_KEY`: Market data API
- `OPENAI_API_KEY`: AI pricing agent

## Chainlink & Tenderly Integration

- **CRE Workflow**: `cre-workflow/` – Chainlink Runtime Environment workflow (RentCast + OpenAI → recommendation)
- **Tenderly + CRE** (Phase 6): Run CRE against Tenderly Virtual TestNets:
  1. Create Virtual TestNet at [dashboard.tenderly.co](https://dashboard.tenderly.co)
  2. Set `TENDERLY_VIRTUAL_TESTNET_RPC` in `.env`, run `node scripts/setup-tenderly-cre.js`
  3. Deploy: `npm run deploy:tenderly`
  4. Simulate: `npm run cre:simulate:tenderly`
- **Virtual TestNet Explorer**: [Tenderly Explorer](https://dashboard.tenderly.co/explorer) – view transactions, contracts, wallets. Enable Public Explorer in your TestNet settings for hackathon demos. See [cre-workflow/README.md](cre-workflow/README.md#phase-6-tenderly--cre-bonus-track).

## Development

### Compile Contracts
```bash
npm run compile
```

### Run Tests
```bash
npm test
```

### Test Coverage
```bash
npm run test:coverage
```

### Deploy to Local Network
```bash
npm run node          # Terminal 1: Start local node
npm run deploy:local  # Terminal 2: Deploy contracts
```

### Deploy to Sepolia Testnet
```bash
npm run deploy:sepolia
```

## Architecture

The system follows a hub-and-spoke architecture with CRE workflow as the orchestration hub:

1. **Workflow Orchestrator**: Central orchestrator managing data fetching and AI analysis
2. **External Data Sources**: Market data APIs, AI agents providing inputs
3. **Blockchain Spoke**: Smart contracts maintaining state and executing transactions
4. **User Interface Spoke**: Dashboard for monitoring and management

## Smart Contracts

- **PropertyToken**: ERC-1400 security token with transfer restrictions
- **PriceManager**: Receives and stores price recommendations; property manager can submit, accept, or reject
- **YieldDistributor**: Collects payments and distributes yields to token holders

## Hackathon Requirements

✅ Workflow integrating blockchain + external API + AI agent  
✅ Smart contracts deployed on Ethereum Sepolia testnet  
✅ Comprehensive testing and documentation  

## Workflow

The project uses a Node.js workflow orchestration:

| File | Purpose |
|------|---------|
| `workflows/yieldprop-optimization.yaml` | Workflow definition |
| `services/workflowOrchestrator.ts` | Orchestrator for Node.js execution |
| `services/aiPricingAgent.ts` | AI agent called by workflow |
| `services/marketDataOracle.ts` | Market data fetched by workflow |
| `contracts/PriceManager.sol` | Receives recommendations from property manager |

## Troubleshooting

**OpenAI 429 / insufficient_quota**: Add credits at [platform.openai.com/account/billing](https://platform.openai.com/account/billing). Your API key is valid but needs payment method/credits.

**API key not configured**: Ensure `.env` exists and has `RENTCAST_API_KEY` and `OPENAI_API_KEY`. Use `npm run workflow:demo` or `npm run demo:pricing` for mock data without API keys.

## License

MIT

## Hackathon

Built for Chainlink Convergence Hackathon - DeFi and Tokenization Track
