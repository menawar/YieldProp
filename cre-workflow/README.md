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

## Phase 6: Tenderly + CRE (Bonus Track)

Run CRE workflows against a **Tenderly Virtual TestNet** for the Tenderly + CRE hackathon track.

### 6.1 Create Virtual TestNet

1. Go to [Tenderly Dashboard](https://dashboard.tenderly.co) → **Virtual TestNets** → **Create**
2. Fork **Sepolia** (chainId 11155111) or Mainnet
3. Copy the **RPC URL** (e.g. `https://virtual.sepolia.rpc.tenderly.co/<your-account>/<project>/<vnet-id>`)
4. Add to project `.env`:
   ```bash
   TENDERLY_VIRTUAL_TESTNET_RPC=https://virtual.sepolia.rpc.tenderly.co/...
   TENDERLY_CHAIN_ID=11155111
   ```

### 6.2 Run CRE Simulation Against Virtual TestNet

1. **Configure RPC**: `node scripts/setup-tenderly-cre.js` (updates `cre-workflow/project.yaml`)
2. **Deploy contracts** to your Virtual TestNet:
   ```bash
   npm run deploy:tenderly
   ```
3. **Update addresses** in `cre-workflow/yieldprop-workflow/config.tenderly.json`:
   - `priceManagerAddress`
   - `yieldDistributorAddress`
4. **Simulate CRE workflow**:
   ```bash
   npm run cre:simulate:tenderly
   ```

This runs the full workflow (AI recommendation + reserve health check) against your Tenderly fork.

### 6.3 Virtual TestNet Explorer

- **Dashboard**: [Tenderly Virtual TestNet Explorer](https://dashboard.tenderly.co/explorer) – view transactions, contracts, wallets
- **Your TestNet**: In the [Tenderly Dashboard](https://dashboard.tenderly.co), open your Virtual TestNet and use the **Explorer** tab. Enable **Public Explorer** (globe icon) to share a public URL for hackathon demos.
- **Docs**: [Virtual TestNet Explorer](https://docs.tenderly.co/virtual-testnets/virtual-testnet-explorer) – private/public explorers, contract visibility

## Next Steps

- [Part 4: Writing Onchain](https://docs.chain.link/cre/getting-started/part-4-writing-onchain) - Submit to `PriceManager.submitRecommendation`
- Phase 4.3 (optional): Chainlink Data Feed for ETH/USD to compare property valuation

## References

- [Chainlink CRE Documentation](https://docs.chain.link/cre)
- [Project Configuration (TypeScript)](https://docs.chain.link/cre/reference/project-configuration-ts)
- [Simulating Workflows](https://docs.chain.link/cre/guides/operations/simulating-workflows)
