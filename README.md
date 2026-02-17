# YieldProp — AI-Powered Real Estate Yield Optimization

> Built for [Chainlink Convergence Hackathon](https://chain.link/hackathon) — DeFi & Tokenization Track + Tenderly Virtual TestNets Track

## Overview

YieldProp tokenizes real estate as **ERC-1400 security tokens**, uses a **Chainlink CRE workflow** to fetch market data and generate AI-powered rental pricing via OpenAI, and automatically distributes yields to fractional token holders. The entire workflow is orchestrated, tested, and validated on a **Tenderly Virtual TestNet** with real-time mainnet state synchronization.

## Chainlink Files

> **Hackathon requirement**: Link to all files that use Chainlink.

| File | Description |
|------|-------------|
| [`cre-workflow/yieldprop-workflow/main.ts`](cre-workflow/yieldprop-workflow/main.ts) | CRE workflow entry point — cron trigger, HTTP/Confidential HTTP data fetching, consensus aggregation, EVM reserve health checks |
| [`cre-workflow/yieldprop-workflow/workflow.yaml`](cre-workflow/yieldprop-workflow/workflow.yaml) | Workflow-specific CRE config (staging, production, confidential, tenderly targets) |
| [`cre-workflow/yieldprop-workflow/abi.ts`](cre-workflow/yieldprop-workflow/abi.ts) | Contract ABIs used by CRE EVMClient for on-chain reserve health queries |
| [`cre-workflow/project.yaml`](cre-workflow/project.yaml) | Global CRE project config — RPC URLs for Sepolia, Tenderly Virtual TestNet |
| [`cre-workflow/secrets.yaml`](cre-workflow/secrets.yaml) | CRE secret declarations (RENTCAST_API_KEY, OPENAI_API_KEY) |
| [`cre-workflow/yieldprop-workflow/config.tenderly.json`](cre-workflow/yieldprop-workflow/config.tenderly.json) | CRE config for Tenderly target — contract addresses, property params |
| [`scripts/setup-tenderly-cre.js`](scripts/setup-tenderly-cre.js) | Auto-updates CRE project.yaml with Tenderly Virtual TestNet RPC URL |
| [`contracts/RecommendationConsumer.sol`](contracts/RecommendationConsumer.sol) | CRE consumer contract — receives signed reports, calls PriceManager.submitRecommendation() |
| [`contracts/IReceiver.sol`](contracts/IReceiver.sol) | Chainlink IReceiver interface for CRE on-chain write |
| [`scripts/deploy-consumer.ts`](scripts/deploy-consumer.ts) | Deploys RecommendationConsumer, grants PROPERTY_MANAGER_ROLE |
| [`scripts/create-tenderly-vnet.js`](scripts/create-tenderly-vnet.js) | Creates new Tenderly Virtual TestNet via REST API |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Chainlink CRE Workflow                           │
│                  (cre-workflow/main.ts)                             │
│                                                                     │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────────────┐  │
│  │ Cron Trigger │──▶│ RentCast API │──▶│ OpenAI Pricing Analysis │  │
│  │ (30s cycle)  │   │ Market Data  │   │ (AI Recommendation)     │  │
│  └─────────────┘   └──────────────┘   └───────────┬─────────────┘  │
│                                                     │               │
│  ┌──────────────────────────────────────────────────▼────────────┐  │
│  │              Reserve Health Check (EVMClient read)            │  │
│  │  query YieldDistributor.distributionPool()                    │  │
│  │  query PriceManager.getCurrentRentalPrice()                   │  │
│  │  log risk event when pool < expected rent                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         On-Chain Write (runtime.report + writeReport)         │  │
│  │  → KeystoneForwarder → RecommendationConsumer                │  │
│  │  → PriceManager.submitRecommendation(price, confidence, ...)  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
              ┌───────────────▼────────────────┐
              │  Tenderly Virtual TestNet       │
              │  (Sepolia fork, state synced)   │
              │                                 │
              │  ┌──────────────┐               │
              │  │PropertyToken │ ERC-1400      │
              │  └──────────────┘               │
              │  ┌──────────────┐               │
              │  │PriceManager  │ AI recs       │
              │  └──────────────┘               │
              │  ┌──────────────────┐           │
              │  │YieldDistributor  │ yields    │
              │  └──────────────────┘           │
              │  ┌──────────────┐               │
              │  │PropertySale  │ investments   │
              │  └──────────────┘               │
              │  ┌──────────────┐               │
              │  │MockUSDC      │ stablecoin    │
              │  └──────────────┘               │
              │                                 │
              │  Explorer: view txns, contracts │
              └─────────────────────────────────┘
                              │
              ┌───────────────▼────────────────┐
              │       Next.js Dashboard        │
              │  Invest · Manage · Distribute  │
              │  Real-time updates (wagmi)     │
              └────────────────────────────────┘
```

### How CRE + Tenderly Work Together

1. **Tenderly Virtual TestNet** provides a zero-setup, mainnet-state-synced Sepolia fork with unlimited faucet, built-in explorer, and debugging tools.
2. Smart contracts are deployed to the Virtual TestNet via `npm run deploy:tenderly`, which auto-updates CRE config with fresh contract addresses.
3. **CRE workflow** runs against the Virtual TestNet RPC, performing:
   - **Off-chain data fetching** — RentCast API for comparable rental data (HTTP with DON consensus)
   - **AI analysis** — OpenAI generates pricing recommendation (aggregated via median consensus)
   - **On-chain reads** — `EVMClient` queries `YieldDistributor.distributionPool()` and `PriceManager.getCurrentRentalPrice()` to check reserve health
   - **Risk monitoring** — logs `RESERVE_RISK` event when pool balance < expected monthly rent
   - **On-chain write** — `runtime.report()` + `EVMClient.writeReport()` submits the signed recommendation through the `KeystoneForwarder` → `RecommendationConsumer` → `PriceManager.submitRecommendation()`
4. The Virtual TestNet Explorer shows all deployment transactions, CRE write transactions, contract state changes, and event logs — providing full transparency for validation.

### Why This Matters

- **Rapid development**: Deploy + test full CRE workflows against real contract state without public testnet faucet limitations
- **Reproducible environment**: State-synced forks ensure consistent testing across team members
- **Full observability**: Tenderly Explorer + debugger reveals exact transaction flow, gas usage, and state changes
- **Production validation**: Same CRE workflow code runs on staging (public Sepolia) and Tenderly, proving portability

## Features

- **Property Tokenization**: ERC-1400 security token with whitelist-based transfer restrictions
- **AI-Powered Pricing**: CRE workflow fetches market data (RentCast) → AI analysis (OpenAI) → on-chain recommendation
- **Reserve Health Monitoring**: CRE queries on-chain pool balance vs expected rent, flags risk events
- **Automated Yield Distribution**: Proportional rental income distribution to fractional token holders
- **Confidential HTTP** (Phase 5): API keys protected in secure enclave, never exposed on-chain
- **Tenderly Virtual TestNet** (Phase 6): Full deployment + CRE simulation on Tenderly fork
- **Next.js Dashboard**: Real-time investment, management, and yield distribution UI

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `PropertyToken.sol` | ERC-1400 security token — fractional ownership, whitelist, partitions |
| `PriceManager.sol` | Stores AI-generated price recommendations; accept/reject by property manager |
| `YieldDistributor.sol` | Collects rental payments, distributes yields proportionally to holders |
| `PropertySale.sol` | Token purchase mechanism with USDC payments and auto-holder registration |
| `MockERC20.sol` | Test stablecoin (USDC) for development |

## Project Structure

```
.
├── contracts/                  # Solidity smart contracts
├── cre-workflow/               # Chainlink CRE workflow
│   ├── project.yaml            # RPC config (Sepolia, Tenderly)
│   ├── secrets.yaml            # API key declarations
│   └── yieldprop-workflow/
│       ├── main.ts             # CRE entry point
│       ├── workflow.yaml       # Workflow targets
│       ├── abi.ts              # Contract ABIs for EVMClient
│       ├── config.staging.json
│       ├── config.production.json
│       ├── config.tenderly.json
│       └── config.confidential.json
├── dashboard/                  # Next.js frontend
├── scripts/                    # Deployment & setup scripts
│   ├── deploy.ts               # Hardhat deploy (Sepolia + Tenderly)
│   ├── setup-tenderly-cre.js   # Update CRE config with Tenderly RPC
│   ├── create-tenderly-vnet.js # Create VNet via Tenderly REST API
│   └── verify-tenderly-deployment.js  # Post-deploy verification
├── deployments/                # Deployment artifacts (JSON)
├── test/                       # Contract & workflow tests
├── services/                   # Node.js workflow orchestrator
├── workflows/                  # YAML workflow definitions
└── hardhat.config.ts           # Hardhat config (Sepolia + Tenderly networks)
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
npm run cre:setup   # Install CRE workflow dependencies (requires Bun)
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your keys (PRIVATE_KEY, RENTCAST_API_KEY, OPENAI_API_KEY)
```

### 3. Compile & Test

```bash
npm run compile
npm test
```

### 4. Deploy to Sepolia

```bash
npm run deploy
```

## Tenderly Virtual TestNet Setup

### Option A: Create VNet via API (recommended)

```bash
# Set your Tenderly access key
# Get it at: https://dashboard.tenderly.co → Settings → API Access Tokens
TENDERLY_ACCESS_KEY=<key> node scripts/create-tenderly-vnet.js
```

This automatically creates a Sepolia-forked VNet with public explorer enabled, and updates `.env` + `cre-workflow/project.yaml`.

### Option B: Create VNet via Dashboard

1. Go to [Tenderly Dashboard](https://dashboard.tenderly.co) → **Virtual TestNets** → **Create**
2. Fork **Sepolia** (chainId 11155111), enable **Public Explorer** and **State Sync**
3. Copy the **Admin RPC URL**
4. Set in `.env`:
   ```
   TENDERLY_VIRTUAL_TESTNET_RPC=https://virtual.sepolia.rpc.tenderly.co/...
   TENDERLY_CHAIN_ID=11155111
   ```

### Deploy + Simulate (one command)

```bash
npm run tenderly:full
```

This runs the complete flow:
1. `setup:tenderly` — updates CRE project.yaml with your Tenderly RPC
2. `deploy:tenderly` — deploys all 5 contracts, auto-updates CRE config addresses
3. `verify:tenderly` — verifies all contracts are deployed and CRE config is aligned
4. `cre:simulate:tenderly` — runs the full CRE workflow against Tenderly

### Or step by step:

```bash
npm run setup:tenderly          # Configure CRE with Tenderly RPC
npm run deploy:tenderly         # Deploy contracts to Tenderly VNet
npm run verify:tenderly         # Verify deployment
npm run cre:simulate:tenderly   # Run CRE workflow simulation
```

### Virtual TestNet Explorer

After deploying, view your contracts and transactions:
- Open your VNet in the [Tenderly Dashboard](https://dashboard.tenderly.co)
- Click the **Explorer** tab to see deployed contracts and transaction history
- Enable **Public Explorer** (globe icon) for a shareable URL

## CRE Workflow Details

The CRE workflow (`cre-workflow/yieldprop-workflow/main.ts`) orchestrates:

1. **Cron Trigger** — fires every 30 seconds (configurable)
2. **Market Data Fetch** — RentCast API with DON consensus aggregation
3. **AI Pricing** — OpenAI generates recommendation (median + identical consensus)
4. **Reserve Health** — EVMClient reads on-chain contract state:
   - `YieldDistributor.distributionPool()` — current USDC in pool
   - `PriceManager.getCurrentRentalPrice()` — expected monthly rent
   - Logs `RESERVE_RISK` when pool < expected rent
5. **Output** — JSON with recommendation + reserve health status

### Three Execution Modes

| Mode | Config Flag | Description |
|------|-------------|-------------|
| Mock | `useMockRecommendation: true` | Rule-based recommendation, no API calls |
| Standard HTTP | `useMockRecommendation: false` | Real RentCast + OpenAI with DON secrets |
| Confidential HTTP | `useConfidentialHttp: true` | API keys in secure enclave (Phase 5) |

### Four CRE Targets

| Target | Command | Description |
|--------|---------|-------------|
| `staging-settings` | `npm run cre:simulate` | Public Sepolia RPC, mock mode |
| `production-settings` | — | Public Sepolia RPC, real APIs |
| `confidential-settings` | `npm run cre:simulate:confidential` | Confidential HTTP mode |
| `tenderly-settings` | `npm run cre:simulate:tenderly` | Tenderly Virtual TestNet |

## Dashboard

The Next.js dashboard provides a real-time interface for:
- **Invest**: Purchase property tokens with USDC
- **Management**: Whitelist addresses, submit/accept price recommendations, manage distributions
- **Yield Distribution**: View and trigger rental yield distributions

See [`dashboard/`](dashboard/) and [`DASHBOARD_SETUP.md`](DASHBOARD_SETUP.md) for setup instructions.

## NPM Scripts Reference

| Script | Description |
|--------|-------------|
| `npm test` | Run Hardhat tests |
| `npm run compile` | Compile Solidity contracts |
| `npm run deploy` | Deploy to Sepolia |
| `npm run deploy:tenderly` | Deploy to Tenderly Virtual TestNet |
| `npm run tenderly:full` | Full Tenderly flow (setup → deploy → verify → simulate) |
| `npm run create:tenderly-vnet` | Create new Virtual TestNet via API |
| `npm run verify:tenderly` | Verify Tenderly deployment |
| `npm run cre:setup` | Install CRE workflow dependencies |
| `npm run cre:simulate` | Run CRE simulation (staging) |
| `npm run cre:simulate:tenderly` | Run CRE simulation (Tenderly) |
| `npm run cre:simulate:confidential` | Run CRE simulation (Confidential HTTP) |

## Troubleshooting

**Tenderly quota limit**: Create a new Virtual TestNet via `npm run create:tenderly-vnet` or the [dashboard](https://dashboard.tenderly.co).

**OpenAI 429 / insufficient_quota**: Add credits at [platform.openai.com/account/billing](https://platform.openai.com/account/billing).

**CRE CLI not found**: Install from [Chainlink CRE Installation](https://docs.chain.link/cre/getting-started/cli-installation).

**Bun not found**: Required for CRE workflows. Install from [bun.sh](https://bun.sh).

## License

MIT

## Hackathon

Built for [Chainlink Convergence Hackathon](https://chain.link/hackathon) — **DeFi & Tokenization** + **Tenderly Virtual TestNets** tracks.

### Submission Checklist

- [x] CRE Workflow integrating blockchain + external API (RentCast) + AI (OpenAI)
- [x] Smart contracts deployed on Ethereum Sepolia testnet
- [x] Tenderly Virtual TestNet deployment with explorer link
- [x] CRE workflow simulation against Tenderly Virtual TestNet
- [x] GitHub repository with source code, deployment scripts, and documentation
- [x] Architecture documentation explaining CRE + Tenderly integration
