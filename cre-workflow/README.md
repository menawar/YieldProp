# Chainlink CRE - YieldProp Workflow

This directory contains the **Chainlink Runtime Environment (CRE)** workflow for YieldProp, following the [Chainlink CRE Part 1: Project Setup & Simulation](https://docs.chain.link/cre/getting-started/part-1-project-setup-ts) guide.

## Prerequisites

- **CRE CLI**: Install from [Chainlink CRE Installation](https://docs.chain.link/cre/getting-started/cli-installation)
- **Bun** 1.2.21+: Required for TypeScript workflows. Install from [bun.sh](https://bun.sh)
- **CRE account**: Sign up at [cre.chain.link](https://cre.chain.link) and run `cre login`
- **Sepolia ETH** (for EVM writes): Get testnet ETH from [faucets.chain.link](https://faucets.chain.link)

## Project Structure

```
cre-workflow/
├── project.yaml          # Global config (RPC URLs, targets)
├── secrets.yaml          # Secret declarations
├── .env.example          # Template for .env
├── README.md             # This file
└── yieldprop-workflow/
    ├── main.ts           # Workflow entry point
    ├── package.json      # Workflow dependencies
    ├── workflow.yaml     # Workflow-specific config
    ├── config.staging.json       # Staging (mock mode)
    ├── config.production.json    # Production
    ├── config.tenderly.json      # Phase 6: Tenderly Virtual TestNet
    └── config.confidential.json  # Phase 5: Confidential HTTP
```

## Quick Start

### 1. Install dependencies (from project root)

```bash
npm run cre:setup
```

Or from this directory:

```bash
cd yieldprop-workflow && bun install
```

### 2. Configure private key

The simulator needs a private key for EVM initialization. Create `cre-workflow/.env`:

```bash
# Copy from parent .env if you have one, or create fresh
cp ../.env .env 2>/dev/null || cp .env.example .env

# Add (64-char hex, NO 0x prefix):
CRE_ETH_PRIVATE_KEY=your_64_character_private_key_here
```

### 3. Run simulation (from project root)

```bash
npm run cre:simulate
```

Or from this directory:

```bash
cd /path/to/tokenise
cd cre-workflow
cre workflow simulate yieldprop-workflow --target staging-settings
```

## Configuration

- **config.staging.json**: Used for local simulation. Set `useMockRecommendation: true` to run without RentCast/OpenAI API keys.
- **config.production.json**: For deployment. Set `useMockRecommendation: false` when you have API keys configured.
- **config.confidential.json**: Phase 5 – Confidential HTTP. Set `useConfidentialHttp: true` for Privacy track (API keys never exposed).
- **project.yaml**: RPC URLs for Sepolia. Override with `SEPOLIA_RPC_URL` in `.env` if using Alchemy/Infura.

## Workflow Logic

The current workflow implements [Part 2: Fetching Offchain Data](https://docs.chain.link/cre/getting-started/part-2-fetching-data-ts) and **Phase 4: Reserve Health Check** (Risk & Compliance):

1. **Cron trigger** fires on the configured schedule (`*/30 * * * * *` = every 30s for staging)
2. **Mock mode** (`useMockRecommendation: true`): Returns rule-based recommendation, no API calls. Use for simulation without API keys.
3. **API mode** (`useMockRecommendation: false`):
   - Fetches market data from **RentCast API** (HTTP GET with `runInNodeMode` + consensus)
   - Sends market data to **OpenAI** for AI pricing (HTTP POST)
   - Falls back to mock if secrets are missing or APIs fail
4. **Reserve health check** (when `yieldDistributorAddress` and `priceManagerAddress` are set in config):
   - Queries `YieldDistributor.distributionPool()` and `PriceManager.getCurrentRentalPrice()`
   - Logs risk event when pool balance &lt; expected monthly rent
   - Output includes `reserveHealth: { poolBalanceUsd, expectedRentUsd, isHealthy, riskEvent? }`
5. **Phase 5: Confidential HTTP** (`useConfidentialHttp: true`): API keys injected in secure enclave, never exposed – for Privacy track. Run with `npm run cre:simulate:confidential`.

**Secrets required for API mode:** `RENTCAST_API_KEY`, `OPENAI_API_KEY` in `cre-workflow/.env` (or Vault DON for deployment)

### Confidential HTTP (Phase 5 – Privacy Track)

When `useConfidentialHttp: true`, RentCast and OpenAI calls use the **Confidential HTTP** capability:

- API keys are stored in Vault DON (or `.env` for simulation) and referenced by `vaultDonSecrets`
- Requests execute inside a secure enclave; keys are never exposed in workflow code or logs
- Template placeholders (`${RENTCAST_API_KEY}`, `${OPENAI_API_KEY}`) are substituted in headers by the enclave
- **Note:** Confidential HTTP is experimental; currently available for `cre workflow simulate` only. See [Confidential API Interactions](https://docs.chain.link/cre/guides/workflow/using-confidential-http-client).

## Phase 6: Tenderly + CRE (Hackathon Track)

Run CRE workflows against a **Tenderly Virtual TestNet** for the [Tenderly x CRE hackathon track](https://chain.link/hackathon/prizes).

### Why Tenderly + CRE?

| Benefit | How It Helps |
|---------|-------------|
| **Zero-setup fork** | Fork Sepolia in seconds — no faucet, no waiting for confirmations |
| **State sync** | Real-time sync with parent network keeps test data fresh |
| **Built-in explorer** | View all deployment txns, contract state, and CRE interactions |
| **Debugging** | Tenderly debugger shows exact execution trace and state changes |
| **Reproducible** | Team members share the same Virtual TestNet for consistent testing |

### 6.1 Create Virtual TestNet

**Option A — Via REST API (recommended):**

```bash
# Get access key at https://dashboard.tenderly.co → Settings → API Access Tokens
TENDERLY_ACCESS_KEY=<key> node scripts/create-tenderly-vnet.js
```

This creates a Sepolia fork with public explorer, and auto-updates `.env` + `project.yaml`.

**Option B — Via Dashboard:**

1. Go to [Tenderly Dashboard](https://dashboard.tenderly.co) → **Virtual TestNets** → **Create**
2. Fork **Sepolia** (chainId 11155111), enable **Public Explorer** and **State Sync**
3. Copy the **Admin RPC URL**
4. Add to project `.env`:
   ```bash
   TENDERLY_VIRTUAL_TESTNET_RPC=https://virtual.sepolia.rpc.tenderly.co/...
   TENDERLY_CHAIN_ID=11155111
   ```

### 6.2 Deploy + Simulate (Full Flow)

One command runs the entire pipeline:

```bash
npm run tenderly:full
```

This executes:
1. `setup:tenderly` — injects Tenderly RPC into `cre-workflow/project.yaml`
2. `deploy:tenderly` — deploys all 5 contracts, auto-updates `config.tenderly.json` with fresh addresses
3. `verify:tenderly` — checks all contracts are deployed and CRE config is aligned
4. `cre:simulate:tenderly` — runs the full CRE workflow against Tenderly

Or step by step:

```bash
npm run setup:tenderly          # 1. Configure CRE with Tenderly RPC
npm run deploy:tenderly         # 2. Deploy contracts to Tenderly VNet
npm run verify:tenderly         # 3. Verify deployment + CRE config
npm run cre:simulate:tenderly   # 4. Run CRE workflow simulation
```

### 6.3 What the CRE Workflow Does on Tenderly

When running `cre:simulate:tenderly`, the workflow:

1. **Triggers** on a 30-second cron schedule
2. **Fetches** rental market data from RentCast API (HTTP GET with consensus)
3. **Generates** AI pricing recommendation from OpenAI (HTTP POST with consensus)
4. **Reads on-chain state** from Tenderly Virtual TestNet:
   - `YieldDistributor.distributionPool()` — current USDC reserve
   - `PriceManager.getCurrentRentalPrice()` — expected monthly rent
5. **Checks reserve health** — flags `RESERVE_RISK` when pool < expected rent
6. **Outputs** JSON with recommendation + reserve health

### 6.4 Virtual TestNet Explorer

After deploying, view your contracts and transactions:

- Open your VNet in the [Tenderly Dashboard](https://dashboard.tenderly.co)
- Click the **Explorer** tab to see:
  - All deployment transactions with gas costs
  - Deployed contract addresses and bytecode
  - Contract state reads from CRE workflow
  - Wallet balances and token transfers
- Enable **Public Explorer** (globe icon) for a shareable URL

### 6.5 Deployment Artifacts

After `npm run deploy:tenderly`:
- **Deployment JSON**: `deployments/tenderly-<timestamp>.json` — all contract addresses, deployer, config
- **Verification report**: `deployments/tenderly-verification-<timestamp>.json` — bytecode checks, CRE config alignment
- **CRE config**: `cre-workflow/yieldprop-workflow/config.tenderly.json` — auto-updated with deployed addresses

## References

- [Chainlink CRE Documentation](https://docs.chain.link/cre)
- [CRE Getting Started (TypeScript)](https://docs.chain.link/cre/getting-started/part-1-project-setup-ts)
- [CRE Part 2: Fetching Offchain Data](https://docs.chain.link/cre/getting-started/part-2-fetching-data-ts)
- [CRE Confidential HTTP](https://docs.chain.link/cre/guides/workflow/using-confidential-http-client)
- [Tenderly Virtual TestNets](https://docs.tenderly.co/virtual-testnets)
- [Tenderly Virtual TestNet Explorer](https://docs.tenderly.co/virtual-testnets/virtual-testnet-explorer)
- [Tenderly REST API](https://docs.tenderly.co/virtual-testnets/develop/rest-api)
