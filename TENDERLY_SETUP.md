# Tenderly Virtual TestNet Setup Guide

## Quick Start for Hackathon

### Step 1: Get Tenderly Access Token

1. Go to https://dashboard.tenderly.co/register
2. Sign up with:
   - **GitHub** (recommended for hackathons - fastest)
   - Google
   - Email

3. After login, navigate to:
   ```
   Settings → API Access Tokens → Generate Access Token
   ```

4. Copy the token (you'll only see it once!)

### Step 2: Get Account & Project Slugs

After logging in, look at your dashboard URL:
```
https://dashboard.tenderly.co/{account-slug}/{project-slug}
```

Or create a new project:
1. Click "Create Project" in the dashboard
2. Name it something like "hackathon-2026" or "yieldprop"
3. Note the project slug (usually lowercase version of name)

### Step 3: Update .env File

Add these three lines to your `.env` file:

```bash
TENDERLY_ACCESS_KEY=your_actual_token_here
TENDERLY_ACCOUNT_SLUG=your_account_slug
TENDERLY_PROJECT_SLUG=your_project_slug
```

### Step 4: Create Virtual TestNet

Run the automated script:

```bash
node scripts/create-tenderly-vnet.js
```

This will:
- ✅ Create a new Sepolia-forked Virtual TestNet
- ✅ Enable state sync (keeps it updated with real Sepolia)
- ✅ Enable public explorer
- ✅ Automatically update `.env` with the Admin RPC URL
- ✅ Update `cre-workflow/project.yaml` with the new RPC
- ✅ Print the Admin RPC URL, Chain ID, and Explorer URL

### Step 5: Verify the Setup

After creation, you'll see output like:

```
Virtual TestNet created successfully!
  RPC URL:      https://virtual.sepolia.rpc.tenderly.co/xxxxx
  Chain ID:     11155111
  Explorer:     https://dashboard.tenderly.co/explorer/vnet/xxxxx
  VNet Slug:    yieldprop-vnet-1234567890
```

## What You Get (Free Tier)

- ✅ **25,000,000 Tenderly Units/month** (very generous)
- ✅ **Unlimited faucet** - instant ETH for testing
- ✅ **State sync** - stays updated with Sepolia mainnet
- ✅ **Public explorer** - share with hackathon judges
- ✅ **All debugging tools** - transaction traces, simulations
- ✅ **109 networks** to fork from

## Usage Costs (Tenderly Units)

- Read methods: 1 TU
- Compute methods: 4 TU  
- Write methods: 20 TU

With 25M TU/month, you can do ~1.25M write transactions or ~25M reads!

## Next Steps After Creation

1. **Deploy your contracts:**
   ```bash
   npm run deploy:tenderly
   ```

2. **Verify deployment:**
   ```bash
   node scripts/verify-tenderly-deployment.js
   ```

3. **Run CRE simulations:**
   ```bash
   npm run cre:simulate:tenderly
   ```

## Troubleshooting

### "TENDERLY_ACCESS_KEY not set"
- Make sure you added the token to `.env`
- No quotes needed around the value
- Run from project root directory

### "API error (401)"
- Token is invalid or expired
- Generate a new token in Tenderly dashboard

### "API error (404)"
- Account slug or project slug is wrong
- Check the URL in your Tenderly dashboard
- Make sure the project exists

### "Account slug required"
- Set `TENDERLY_ACCOUNT_SLUG` in `.env`
- Find it in your dashboard URL

## Manual Creation (Alternative)

If you prefer to create via the web UI:

1. Go to https://dashboard.tenderly.co
2. Navigate to **Virtual TestNets** (left sidebar)
3. Click **"Create Virtual TestNet"**
4. Configure:
   - **Parent Network**: Sepolia (11155111)
   - **Name**: YieldProp Hackathon TestNet
   - **Chain ID**: 11155111 (or custom like 73571)
   - **Public Explorer**: ✅ Enabled
   - **State Sync**: ✅ Enabled
5. Click **"Create"**
6. Copy the **Admin RPC URL** from the dashboard
7. Manually update `.env` with the RPC URL

## Resources

- 📚 [Tenderly Docs](https://docs.tenderly.co/virtual-testnets)
- 🚀 [Quickstart Guide](https://docs.tenderly.co/virtual-testnets/quickstart)
- 💰 [Pricing Info](https://docs.tenderly.co/virtual-testnets/pricing)
- 🔧 [API Reference](https://docs.tenderly.co/reference/api#/operations/createVnet)

## For Hackathon Judges

Share this with judges to show your testnet:

1. **Explorer URL**: (printed after creation)
2. **Chain ID**: 11155111
3. **Add to MetaMask**: Use the Admin RPC URL

They can view all transactions, contract interactions, and state changes in real-time!
