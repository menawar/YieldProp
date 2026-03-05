# YieldProp — AI-Powered Real Estate Yield Optimization

## Overview

YieldProp tokenizes real estate as **ERC-1400 security tokens**, uses a **Chainlink CRE workflow** to fetch market data and generate AI-powered rental pricing via OpenAI, and automatically distributes yields to fractional token holders. The entire workflow is orchestrated, tested, and validated on a **Tenderly Virtual TestNet** with real-time mainnet state synchronization.

### Market Data Flow

The CRE workflow calls `marketDataApiUrl` which points to the dashboard's `/api/market-data` endpoint — a smart adapter that:
- Uses **free Redfin-sourced reference data** by default (no API key needed)
- Upgrades to **live RentCast data** automatically when `RENTCAST_API_KEY` is set

This means the CRE workflow itself never needs to talk directly to RentCast.

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `PropertyToken.sol` | ERC-1400 security token — fractional ownership, whitelist, partitions |
| `PriceManager.sol` | Stores AI-generated price recommendations; accept/reject by property manager |
| `YieldDistributor.sol` | Collects rental payments, distributes yields proportionally to holders |
| `PropertySale.sol` | Token purchase mechanism with USDC payments and auto-holder registration |
| `MockERC20.sol` | Test stablecoin (USDC) for development |

## Features

- **Property Tokenization**: ERC-1400 security token with whitelist-based transfer restrictions
- **AI-Powered Pricing**: CRE workflow fetches market data → AI analysis (OpenAI) → on-chain recommendation
- **Reserve Health Monitoring**: CRE queries on-chain pool balance vs expected rent, flags risk events
- **Automated Yield Distribution**: Proportional rental income distribution to fractional token holders
- **Confidential HTTP** (Phase 5): API keys protected in secure enclave, never exposed on-chain
- **Tenderly Virtual TestNet** (Phase 6): Full deployment + CRE simulation on Tenderly fork
- **Next.js Dashboard**: Real-time investment, management, and yield distribution UI

---

## End-to-End Setup (Fresh Deployment)

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Bun | 1.2+ | `curl -fsSL https://bun.sh/install \| bash` |
| Foundry | latest | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| CRE CLI | 1.0+ | [docs.chain.link/cre/getting-started/cli-installation](https://docs.chain.link/cre/getting-started/cli-installation) |

You will also need:
- A funded **Sepolia wallet** (get ETH from [faucets.chain.link](https://faucets.chain.link))
- An **Alchemy** (or Infura) Sepolia RPC URL
- An **OpenAI** API key ([platform.openai.com](https://platform.openai.com))
- *(Optional)* A **RentCast** API key for live rental data ([rentcast.io](https://app.rentcast.io))
- *(Optional)* A **Tenderly** account for the Virtual TestNet track ([dashboard.tenderly.co](https://dashboard.tenderly.co))

---

### Step 1 — Clone & Install Dependencies

```bash
git clone <repo-url> && cd tokenise
npm install
npm run cre:setup        # Installs CRE workflow deps via Bun
cd dashboard && npm install && cd ..
```

---

### Step 2 — Configure Environment

#### Root `.env` (Hardhat + CRE CLI)

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Required
PRIVATE_KEY=0x<your-wallet-private-key>
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-alchemy-key>

# CRE CLI (same private key, NO 0x prefix)
CRE_ETH_PRIVATE_KEY=<your-64-char-hex-key-without-0x>
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-alchemy-key>

# API keys for CRE workflow
OPENAI_API_KEY=sk-...
RENTCAST_API_KEY=<optional>

# Property config (used during deployment)
PROPERTY_ADDRESS=123 Main St, San Francisco, CA
PROPERTY_TYPE=Single Family
PROPERTY_VALUATION=500000
```

#### Mirror to CRE workflow `.env`

```bash
cp .env cre-workflow/.env
```

#### Dashboard `.env.local`

```bash
cp dashboard/.env.local.example dashboard/.env.local 2>/dev/null || touch dashboard/.env.local
```

Add your RPC URL (contract addresses will be filled automatically in Step 5):

```bash
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-alchemy-key>
```

---

### Step 3 — Compile & Test

```bash
npm run compile          # Compile Solidity with Hardhat
npm run compile:forge    # Compile with Foundry (optional, runs Forge tests)
npm test                 # Run Hardhat test suite
npm run test:property    # Run Foundry tests
```

All tests should pass before deploying.

---

### Step 4 — Deploy Contracts to Sepolia

```bash
npm run deploy
```

This deploys: `MockUSDC` → `PropertyToken` → `PriceManager` → `YieldDistributor` → `PropertySale`

The script prints all contract addresses and saves a timestamped JSON to `deployments/sepolia-<timestamp>.json`.

> **Multi-property mode**: `MULTI=true npm run deploy` deploys two properties using the default config in `scripts/deploy.ts`.

---

### Step 5 — Sync Addresses to Dashboard

After deployment, run the sync script to automatically update `dashboard/.env.local` with the fresh contract addresses:

```bash
npm run sync:addresses
```

This reads the latest deployment JSON from `deployments/` and writes the correct `NEXT_PUBLIC_*` addresses into `dashboard/.env.local`. You should see output like:

```
NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_PRICE_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_YIELD_DISTRIBUTOR_ADDRESS=0x...
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x...
NEXT_PUBLIC_PROPERTY_SALE_ADDRESS=0x...

Updated dashboard/.env.local
```

> **Important**: Always run `sync:addresses` after a fresh deployment. Stale addresses in `dashboard/.env.local` will cause the dashboard to connect to old (or non-existent) contracts.

---

### Step 6 — Mint Test USDC

Mint test USDC to your wallet so you can invest and trigger yield distributions:

```bash
npm run mint:usdc
```

By default mints to the `MINT_TO` address in `.env`. Edit `MINT_AMOUNT` in `.env` to change the amount (default: 10,000 USDC).

---

### Step 7 — Run CRE Simulation

Login to CRE (one-time):

```bash
cre login
```

Run the workflow simulation (mock mode — no API keys needed):

```bash
npm run cre:simulate
```

Expected output:
```
Workflow compiled
[SIMULATION] Simulator Initialized
[USER LOG] YieldProp workflow triggered.
[USER LOG] Using mock recommendation (no API calls).
[USER LOG] Recommendation: $3000/mo, confidence 75%

Workflow Simulation Result:
{"recommendedPrice":3000,"confidenceScore":75,...}
```

**Other simulation modes:**

```bash
npm run cre:simulate:confidential   # Privacy track — Confidential HTTP mode
npm run cre:simulate:production     # Uses real RentCast + OpenAI (requires API keys)
```

---

### Step 8 — (Optional) Deploy Consumer for CRE On-Chain Writes

To enable the CRE workflow to write AI recommendations on-chain:

```bash
npm run deploy:consumer:sepolia
```

Then update `cre-workflow/yieldprop-workflow/config.staging.json` with the `recommendationConsumerAddress` printed by the script.

---

### Step 9 — (Optional) Tenderly Virtual TestNet

#### 9.1 Create a Virtual TestNet

1. Go to [dashboard.tenderly.co](https://dashboard.tenderly.co) → **Virtual TestNets** → **Create**
2. Fork **Sepolia** (chainId 11155111), enable **Public Explorer** and **State Sync**
3. Copy the **Admin RPC URL**
4. Add to **both** `.env` and `cre-workflow/.env`:
   ```bash
   TENDERLY_VIRTUAL_TESTNET_RPC=https://virtual.sepolia.rpc.tenderly.co/...
   TENDERLY_CHAIN_ID=11155111
   ```
5. Also update the `tenderly-settings` URL in `cre-workflow/project.yaml` to match.

#### 9.2 Run the Full Tenderly Pipeline

```bash
npm run tenderly:full
```

This runs three steps in sequence:
1. `deploy:tenderly` — deploys all contracts to the Virtual TestNet and auto-updates `config.tenderly.json`
2. `deploy:consumer:tenderly` — deploys the CRE consumer contract and grants role
3. `cre:simulate:tenderly` — runs the full CRE workflow against the Virtual TestNet

Or step by step:

```bash
npm run deploy:tenderly              # Step 1
npm run deploy:consumer:tenderly     # Step 2
npm run cre:simulate:tenderly        # Step 3
```

After running, open the **Tenderly Explorer** tab to view all deployment transactions, contract state reads, and CRE write transactions. Enable **Public Explorer** for a shareable URL to include in your hackathon submission.

---

### Step 10 — Start the Dashboard

```bash
cd dashboard && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The dashboard connects to the contract addresses in `dashboard/.env.local` (synced in Step 5). Features:
- **Invest**: Buy property tokens with Mock USDC
- **Manage**: Whitelist addresses, accept AI price recommendations
- **Yield**: Deposit rental income and trigger distributions to holders

---

## CRE Workflow Modes Reference

| Mode | Config | Description |
|------|--------|-------------|
| Mock | `useMockRecommendation: true` | Rule-based recommendation, no API calls. Use for demos. |
| Standard HTTP | `useMockRecommendation: false` | Real market data + OpenAI. Requires `OPENAI_API_KEY`. |
| Confidential HTTP | `useConfidentialHttp: true` | API keys injected by secure enclave. Live DON only. |

## NPM Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run compile` | Compile Solidity (Hardhat) |
| `npm run test` | Run Hardhat tests |
| `npm run test:property` | Run Foundry tests |
| `npm run deploy` | Deploy to Sepolia |
| `npm run deploy:local` | Deploy to local Hardhat node |
| `npm run deploy:tenderly` | Deploy to Tenderly Virtual TestNet |
| `npm run deploy:consumer:sepolia` | Deploy CRE consumer to Sepolia |
| `npm run deploy:consumer:tenderly` | Deploy CRE consumer to Tenderly |
| `npm run sync:addresses` | Sync latest deployment addresses into `dashboard/.env.local` |
| `npm run mint:usdc` | Mint test USDC to wallet |
| `npm run cre:setup` | Install CRE workflow Bun dependencies |
| `npm run cre:simulate` | Simulate CRE workflow (staging/mock) |
| `npm run cre:simulate:confidential` | Simulate CRE workflow (confidential HTTP) |
| `npm run cre:simulate:tenderly` | Simulate CRE workflow against Tenderly |
| `npm run tenderly:full` | Full Tenderly pipeline: deploy + consumer + CRE simulate |
| `npm run verify` | Verify contracts on Etherscan |

## Project Structure

```
.
├── contracts/                  # Solidity smart contracts
├── cre-workflow/               # Chainlink CRE workflow
│   ├── project.yaml            # RPC config (Sepolia, Tenderly)
│   ├── secrets.yaml            # API key declarations
│   ├── .env                    # CRE CLI secrets (copy from root .env)
│   └── yieldprop-workflow/
│       ├── main.ts             # CRE workflow entry point
│       ├── workflow.yaml       # Workflow targets
│       ├── abi.ts              # Contract ABIs for EVMClient
│       ├── config.staging.json      # Mock mode, Sepolia
│       ├── config.production.json   # Live APIs, Sepolia
│       ├── config.tenderly.json     # Tenderly target (auto-updated by deploy)
│       └── config.confidential.json # Confidential HTTP mode
├── dashboard/                  # Next.js frontend
│   └── .env.local              # Dashboard contract addresses (auto-synced)
├── scripts/                    # Deployment & setup scripts
│   ├── deploy.ts               # Main deploy script (Sepolia + Tenderly)
│   ├── deploy-consumer.ts      # Deploy CRE RecommendationConsumer
│   ├── sync-dashboard-addresses.js  # Sync addresses → dashboard/.env.local
│   └── mint-usdc.ts            # Mint test USDC
├── deployments/                # Deployment artifacts (JSON, auto-generated)
├── test/                       # Hardhat & Foundry tests
└── hardhat.config.ts           # Network config (Sepolia + Tenderly)
```

## Troubleshooting

**`invalid scheme in RPC URL`** — CRE CLI v1.0.x does not expand `${ENV_VAR}` in `project.yaml`. Edit the file directly with your literal RPC URL.

**`Tenderly quota limit`** — Create a new Virtual TestNet from the [Tenderly dashboard](https://dashboard.tenderly.co) and update `TENDERLY_VIRTUAL_TESTNET_RPC` in `.env`, `cre-workflow/.env`, and `cre-workflow/project.yaml`.

**`CRE CLI not found`** — Make sure `$HOME/.cre/bin` is on your PATH: `export PATH="$HOME/.cre/bin:$PATH"`. Install from [docs.chain.link/cre/getting-started/cli-installation](https://docs.chain.link/cre/getting-started/cli-installation).

**`OpenAI 429 / insufficient_quota`** — Add credits at [platform.openai.com/account/billing](https://platform.openai.com/account/billing).

**`Bun not found`** — Required for CRE workflows. Install from [bun.sh](https://bun.sh).

**Dashboard shows wrong contract data** — Run `npm run sync:addresses` to resync after any redeployment.
