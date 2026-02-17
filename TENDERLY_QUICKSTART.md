# Tenderly Virtual TestNet - Quick Commands

## 🚀 One-Command Setup

After adding your Tenderly credentials to `.env`, run:

```bash
npm run create:tenderly-vnet
```

This creates a new Virtual TestNet and updates all config files automatically.

## 📋 Step-by-Step Commands

### 1. Create Virtual TestNet
```bash
npm run create:tenderly-vnet
```
**Output:** Admin RPC URL, Chain ID, Explorer URL

### 2. Deploy Contracts to Tenderly
```bash
npm run deploy:tenderly
```
**Deploys:** PropertyToken, PriceManager, YieldDistributor, PropertySale, MockUSDC

### 3. Verify Deployment
```bash
npm run verify:tenderly
```
**Checks:** All contracts deployed, bytecode present, config files aligned

### 4. Run CRE Simulation
```bash
npm run cre:simulate:tenderly
```
**Runs:** Full CRE workflow on your Virtual TestNet

## 🎯 Full Pipeline (All-in-One)

```bash
npm run tenderly:full
```

This runs all steps in sequence:
1. ✅ Setup Tenderly CRE config
2. ✅ Deploy all contracts
3. ✅ Verify deployment
4. ✅ Run CRE simulation

## 🔑 Prerequisites

Add to `.env` file:

```bash
TENDERLY_ACCESS_KEY=your_token_here
TENDERLY_ACCOUNT_SLUG=your_account
TENDERLY_PROJECT_SLUG=your_project
```

## 📍 Where to Get Credentials

1. **Access Token:**
   - https://dashboard.tenderly.co
   - Settings → API Access Tokens → Generate

2. **Account & Project Slugs:**
   - Look at dashboard URL: `dashboard.tenderly.co/{account}/{project}`
   - Or create new project in dashboard

## 🎬 For Your Hackathon Demo

### Quick Demo Flow:

```bash
# 1. Create fresh testnet
npm run create:tenderly-vnet

# 2. Deploy everything
npm run deploy:tenderly

# 3. Run the full workflow
npm run cre:simulate:tenderly
```

### Show Judges:

1. **Explorer URL** - Real-time transaction viewer
2. **Contract addresses** - All verified and deployed
3. **CRE simulation results** - AI-powered yield optimization
4. **Transaction traces** - Full debugging visibility

## 💡 Pro Tips

- Virtual TestNet has **unlimited faucet** - no need to request testnet ETH
- **State sync enabled** - stays updated with real Sepolia
- **Public explorer** - share the URL with anyone
- **25M Tenderly Units/month** free - more than enough for hackathon

## 🐛 Troubleshooting

```bash
# If RPC URL is wrong:
npm run create:tenderly-vnet  # Creates new one

# If contracts not deploying:
npm run verify:tenderly  # Check what's missing

# If CRE simulation fails:
npm run setup:tenderly  # Reset CRE config
```

## 📊 Check Your Usage

Visit: https://dashboard.tenderly.co/usage

See:
- Tenderly Units consumed
- RPC calls made
- Active Virtual TestNets
- Transaction count

---

**Need help?** See full guide: `TENDERLY_SETUP.md`
